#!/usr/bin/env bun

/**
 * pkgs/docker/install.ts
 *
 * Docker Engine 和 Docker Compose 安装脚本
 * 从官方仓库安装最新版本
 */

import { $ } from "bun";
import {
  getCurrentUser,
  aptInstall,
  aptRemove,
  addGpgKey,
  addRepository,
  addUserToGroup,
  enableService,
  startService,
  restartService,
  verifyCommand,
  getCommandVersion,
  runAsUser,
  writeUserFile
} from "@/pkg-utils";

import { logger } from "@/logger";

export default async function install(): Promise<void> {
  logger.info("🐳 开始安装 Docker 和 Docker Compose...");

  const currentUser = getCurrentUser();
  logger.info(`==> 为用户安装: ${currentUser}`);

  try {
    // 1. 移除旧版本 Docker
    logger.info("==> 移除旧版本 Docker...");
    await aptRemove(["docker", "docker-engine", "docker.io", "containerd", "runc"]);

    // 2. 安装必需的包
    await aptInstall([
      "ca-certificates",
      "curl",
      "gnupg",
      "lsb-release"
    ]);

    // 3. 添加 Docker 的官方 GPG 密钥
    await addGpgKey("https://download.docker.com/linux/ubuntu/gpg", "docker");

    // 4. 添加 Docker 仓库
    const arch = await $`dpkg --print-architecture`.text().then(s => s.trim());
    const ubuntuCodename = await $`. /etc/os-release && echo "$UBUNTU_CODENAME"`.text().then(s => s.trim());

    const dockerRepo = `deb [arch=${arch} signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${ubuntuCodename} stable`;
    await addRepository(dockerRepo);

    // 5. 安装 Docker Engine 和 Docker Compose
    await aptInstall([
      "docker-ce",
      "docker-ce-cli",
      "containerd.io",
      "docker-buildx-plugin",
      "docker-compose-plugin"
    ]);

    // 6. 将用户添加到 docker 组
    await addUserToGroup(currentUser, "docker");

    // 7. 启用并启动 Docker 服务
    await enableService("docker");
    await startService("docker");

    // 8. 配置 Docker 守护进程
    logger.info("==> 配置 Docker 守护进程...");

    const dockerDaemonConfig = `{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "storage-driver": "overlay2"
}`;

    await $`mkdir -p /etc/docker`;
    await writeUserFile("/etc/docker/daemon.json", dockerDaemonConfig, "root");
    await restartService("docker");

    // 9. 验证安装
    logger.info("==> 验证 Docker 安装...");

    const dockerVersion = await getCommandVersion("docker");
    const composeVersion = await getCommandVersion("docker", "compose version");

    logger.success("✅ Docker 和 Docker Compose 安装完成!");
    logger.info(`  > Docker: ${dockerVersion.trim()}`);
    logger.info(`  > Docker Compose: ${composeVersion.trim()}`);

    // 10. 测试 Docker（以用户身份）
    logger.info("==> 测试 Docker 安装...");
    await runAsUser("docker run --rm hello-world", currentUser);

    logger.success("🎉 Docker 安装和配置完成!");
    logger.info(`==> 注意: ${currentUser} 已添加到 docker 组`);
    logger.info("==> 您可能需要注销并重新登录以使组更改生效");

  } catch (error) {
    logger.error(`❌ Docker 安装失败: ${error.message}`);
    throw error;
  }
}
#!/usr/bin/env bun

/**
 * pkgs/docker/install.ts
 *
 * Docker Engine 和 Docker Compose 安装
 */

import {
  getUserEnv,
  aptInstall,
  aptRemove,
  addGpgKey,
  addRepository,
  addUserToGroup,
  enableService,
  startService,
  detectArch,
  logger
} from "@/pkg-utils";

export default async function install(): Promise<void> {
  logger.info("🐳 开始安装 Docker...");

  try {
    const { user } = getUserEnv();

    // 0. 清理旧版本Docker
    logger.info("==> 清理旧版本Docker...");
    await aptRemove([
      "docker.io",
      "docker-doc",
      "docker-compose",
      "docker-compose-v2",
      "podman-docker",
      "containerd",
      "runc"
    ]);

    // 1. 安装必需的包
    await aptInstall([
      "ca-certificates",
      "curl",
      "gnupg",
      "lsb-release"
    ]);

    // 2. 添加 Docker 官方 GPG 密钥
    await addGpgKey("https://download.docker.com/linux/ubuntu/gpg", "docker");

    // 3. 添加 Docker 仓库
    const arch = await detectArch();
    const ubuntuCodename = await Bun.spawn(["bash", "-c", ". /etc/os-release && echo $UBUNTU_CODENAME"]).text().then(s => s.trim());

    const dockerRepo = `deb [arch=${arch} signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${ubuntuCodename} stable`;
    await addRepository(dockerRepo);

    // 4. 安装 Docker
    await aptInstall([
      "docker-ce",
      "docker-ce-cli",
      "containerd.io",
      "docker-buildx-plugin",
      "docker-compose-plugin"
    ]);

    // 5. 启动 Docker 服务
    await enableService("docker");
    await startService("docker");

    // 6. 添加用户到 docker 组
    await addUserToGroup(user, "docker");

    logger.success("✅ Docker 安装完成!");

  } catch (error) {
    logger.error(`❌ Docker 安装失败: ${error.message}`);
    throw error;
  }
}
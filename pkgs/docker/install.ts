#!/usr/bin/env bun

/**
 * pkgs/docker/install.ts
 *
 * Docker Engine 和 Docker Compose 安装
 */

import { $ } from "bun";
import {
  getUserEnv,
  aptInstall,
  addGpgKey,
  addRepository,
  addUserToGroup,
  enableService,
  startService,
  getSystemInfo,
  isCommandAvailable,
  isPackageInstalled,
  logger
} from "../../src/pkg-utils";

export default async function install(): Promise<void> {
  logger.info("🐳 开始安装 Docker...");

  try {
    const { user } = getUserEnv();

    // 1. 检查 Docker 是否已安装
    const isDockerInstalled = await isCommandAvailable("docker");
    if (isDockerInstalled) {
      logger.success("✅ Docker 已安装，跳过安装步骤");

      // 仍需检查用户是否在 docker 组中
      try {
        const userGroups = await $`groups ${user}`.text();
        if (!userGroups.includes('docker')) {
          logger.info("==> 将用户添加到 docker 组...");
          await addUserToGroup(user, "docker");
          logger.success(`✅ 用户 ${user} 已添加到 docker 组`);
        } else {
          logger.info(`✅ 用户 ${user} 已在 docker 组中`);
        }
      } catch (error) {
        logger.warn(`⚠️  检查用户组失败: ${error.message}`);
      }

      return;
    }

    logger.info("==> Docker 未安装，开始安装...");

    // 2. 安装必需的包
    await aptInstall([
      "ca-certificates",
      "curl",
      "gnupg",
      "lsb-release"
    ]);

    // 2. 添加 Docker 官方 GPG 密钥
    await addGpgKey("https://download.docker.com/linux/ubuntu/gpg", "docker");

    // 3. 添加 Docker 仓库
    const systemInfo = await getSystemInfo();
    const { arch, ubuntuCodename } = systemInfo;

    if (!ubuntuCodename) {
      throw new Error("无法获取 Ubuntu 版本代号，可能不是 Ubuntu 系统");
    }

    const dockerRepo = `deb [arch=${arch} signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${ubuntuCodename} stable`;
    await addRepository(dockerRepo, "docker");

    // 4. 安装 Docker
    await aptInstall([
      "docker-ce",
      "docker-ce-cli",
      "containerd.io",
      "docker-buildx-plugin",
      "docker-compose-plugin"
    ]);

    // 5. 启动 Docker 服务（可按需跳过）
    const skipService = process.env.EEE_SKIP_DOCKER_SERVICE === "1" || process.env.EEE_CONTAINER_MODE === "1";
    if (skipService) {
      logger.info("==> 检测到容器模式或禁用标志，跳过 Docker 服务启用/启动");
    } else {
      await enableService("docker");
      await startService("docker");
    }

    // 6. 添加用户到 docker 组
    await addUserToGroup(user, "docker");

    logger.success("✅ Docker 安装完成!");

  } catch (error) {
    logger.error(`❌ Docker 安装失败: ${error.message}`);
    throw error;
  }
}
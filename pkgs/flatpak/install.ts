#!/usr/bin/env bun

/**
 * pkgs/flatpak/install.ts
 *
 * Flatpak 包管理器安装
 * 使用新的 runAsRootScript 架构
 */

import {
  getCurrentUser,
  getUserHome,
  runAsRootScript,
  logger
} from "@/pkg-utils";

export default async function install(): Promise<void> {
  logger.info("📱 开始安装 Flatpak...");

  const currentUser = getCurrentUser();

  try {
    // 检查 Flatpak 是否已安装
    logger.info("==> 检查 Flatpak 安装状态...");

    const checkScript = `
      if command -v flatpak >/dev/null 2>&1; then
        echo "INSTALLED"
      else
        echo "NOT_INSTALLED"
      fi
    `;

    const checkResult = await runAsRootScript(checkScript);

    if (checkResult.trim() === "INSTALLED") {
      logger.success("✅ Flatpak 已安装，跳过包安装步骤");
    } else {
      logger.info("📦 Flatpak 未安装，准备安装...");

      const installScript = `
        export DEBIAN_FRONTEND=noninteractive
        apt-get update -qq
        apt-get install -y flatpak
      `;

      await runAsRootScript(installScript);
      logger.success("✅ Flatpak 包安装完成");
    }

    // 添加 Flathub 仓库
    logger.info("==> 检查和添加 Flathub 仓库...");

    // 检查仓库是否已存在
    const checkRemoteScript = `
      # 检查用户级和系统级仓库
      if flatpak remotes --user 2>/dev/null | grep -q flathub; then
        echo "USER_EXISTS"
      elif flatpak remotes --system 2>/dev/null | grep -q flathub; then
        echo "SYSTEM_EXISTS"
      else
        echo "NOT_EXISTS"
      fi
    `;

    const remoteCheck = await runAsRootScript(checkRemoteScript);

    if (remoteCheck.includes("EXISTS")) {
      logger.success("✅ Flathub 仓库已存在，跳过添加");
    } else {
      // 使用超时和国内镜像源避免网络问题
      const flathubUrl = "https://mirrors.ustc.edu.cn/flathub";
      logger.info(`==> 使用国内镜像源: ${flathubUrl}`);

      const addRemoteScript = `
        # 尝试添加用户级仓库
        if timeout 60 flatpak remote-add --if-not-exists --user flathub ${flathubUrl} 2>/dev/null; then
          echo "USER_ADDED"
        else
          # 如果用户级失败，尝试系统级
          timeout 60 flatpak remote-add --if-not-exists --system flathub ${flathubUrl}
          echo "SYSTEM_ADDED"
        fi
      `;

      const addResult = await runAsRootScript(addRemoteScript);

      if (addResult.includes("USER_ADDED")) {
        logger.info("==> 用户级 Flathub (国内镜像) 仓库添加成功");
      } else if (addResult.includes("SYSTEM_ADDED")) {
        logger.info("==> 系统级 Flathub (国内镜像) 仓库添加成功");
      } else {
        logger.warn("⚠️  Flathub 仓库添加可能失败，但 Flatpak 基础功能可用");
      }
    }

    logger.success("✅ Flatpak 安装完成!");
    logger.info("==> Flathub 仓库已添加 (使用中科大镜像源)");
    logger.info("==> 可使用 flatpak install <app> 安装应用");
    logger.info("💡 提示: 使用国内镜像源加速下载");

  } catch (error) {
    logger.error(`❌ Flatpak 安装失败: ${error.message}`);
    throw error;
  }
}
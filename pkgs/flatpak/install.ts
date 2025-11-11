#!/usr/bin/env bun

/**
 * pkgs/flatpak/install.ts
 *
 * Flatpak 包管理器安装
 * 展示 APT 包的新安装模式
 */

import { $ } from "bun";
import { installAptPackage } from "@/pkg-utils";
import { logger } from "@/logger";

export default async function install(): Promise<void> {
  logger.info("📱 开始安装 Flatpak...");

  try {
    // 使用新的统一接口安装 APT 包
    const result = await installAptPackage(
      "Flatpak",
      "flatpak",
      "dpkg -s flatpak"  // 检查命令
    );

    if (result.installMethod === "skip") {
      logger.success("✅ Flatpak 已安装，跳过包安装步骤");
      // 即使跳过安装，也要检查 Flathub 仓库
    } else {
      logger.success("✅ Flatpak 包安装完成");
    }

    // 添加 Flathub 仓库
    logger.info("==> 检查和添加 Flathub 仓库...");

    // 首先确保 flatpak 命令可用
    const flatpakPath = await $`which flatpak`.text().catch(() => "/usr/bin/flatpak");

    // 检查仓库是否已存在
    try {
      const existingRemotes = await $`${flatpakPath.trim()} remotes --user 2>/dev/null || ${flatpakPath.trim()} remotes --system 2>/dev/null || true`.text();
      if (existingRemotes.includes("flathub")) {
        logger.success("✅ Flathub 仓库已存在，跳过添加");
        return;
      }
    } catch (e) {
      // 忽略检查错误，继续添加
      logger.info("==> 无法检查现有仓库，继续添加...");
    }

    // 使用超时和国内镜像源避免网络问题
    const flathubUrl = "https://mirrors.ustc.edu.cn/flathub";
    logger.info(`==> 使用国内镜像源: ${flathubUrl}`);

    try {
      await $`timeout 60 ${flatpakPath.trim()} remote-add --if-not-exists --user flathub ${flathubUrl}`;
      logger.info("==> 用户级 Flathub (国内镜像) 仓库添加成功");
    } catch (userError) {
      logger.warn(`⚠️  用户级仓库添加失败，尝试系统级: ${userError.message}`);
      // 如果用户级失败，尝试系统级
      await $`timeout 60 ${flatpakPath.trim()} remote-add --if-not-exists --system flathub ${flathubUrl}`;
      logger.info("==> 系统级 Flathub (国内镜像) 仓库添加成功");
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
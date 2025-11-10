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
      logger.success("✅ Flatpak 已安装，跳过安装步骤");
      return;
    }

    // 添加 Flathub 仓库
    logger.info("==> 添加 Flathub 仓库...");
    await $`flatpak remote-add --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo`;

    logger.success("✅ Flatpak 安装完成!");
    logger.info("==> Flathub 仓库已添加");
    logger.info("==> 可使用 flatpak install <app> 安装应用");

  } catch (error) {
    logger.error(`❌ Flatpak 安装失败: ${error.message}`);
    throw error;
  }
}
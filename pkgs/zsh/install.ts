#!/usr/bin/env bun

/**
 * pkgs/zsh/install.ts
 *
 * Zsh 现代 Shell 安装
 * 纯净安装，仅安装 zsh 包
 */

import { installAptPackage } from "@/pkg-utils";
import { logger } from "@/logger";

export default async function install(): Promise<void> {
  logger.info("🐚 开始安装 Zsh...");

  try {
    // 使用统一接口安装 APT 包
    const result = await installAptPackage(
      "Zsh",
      "zsh",
      "dpkg -s zsh"
    );

    if (result.installMethod === "skip") {
      logger.success("✅ Zsh 已安装，跳过安装步骤");
      return;
    }

    logger.success("✅ Zsh 安装完成!");
    logger.info("💡 提示: 这是纯净 zsh 安装，如需配置请手动执行");

  } catch (error) {
    logger.error(`❌ Zsh 安装失败: ${error.message}`);
    throw error;
  }
}


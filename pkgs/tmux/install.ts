#!/usr/bin/env bun

/**
 * pkgs/tmux/install.ts
 *
 * Tmux 终端复用器安装
 * 纯净安装，仅安装 tmux 包
 */

import { installAptPackage } from "../../src/pkg-utils";
import { logger } from "../../src/logger";

export default async function install(): Promise<void> {
  logger.info("🖥️  开始安装 Tmux...");

  try {
    // 使用统一接口安装 APT 包
    const result = await installAptPackage(
      "Tmux",
      "tmux",
      "dpkg -s tmux"
    );

    if (result.installMethod === "skip") {
      logger.success("✅ Tmux 已安装，跳过安装步骤");
      return;
    }

    logger.success("✅ Tmux 安装完成!");
    logger.info("💡 提示: 这是纯净 tmux 安装，配置文件将在 post_install 中设置");

  } catch (error) {
    logger.error(`❌ Tmux 安装失败: ${error.message}`);
    throw error;
  }
}


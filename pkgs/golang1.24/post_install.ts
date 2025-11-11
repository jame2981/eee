#!/usr/bin/env bun

/**
 * pkgs/golang1.24/post_install.ts
 *
 * Go 1.24.3 后置安装配置
 * 负责配置 ZSH 环境集成
 */

import {
  getCurrentUser,
  configureZshIntegration,
  logger
} from "@/pkg-utils";

export default async function postInstall(): Promise<void> {
  logger.info("🔧 配置 Go 1.24.3 ZSH 集成...");

  const currentUser = getCurrentUser();

  try {
    // 配置 ZSH 环境集成
    await configureZshIntegration(currentUser);

    logger.success("✅ Go 1.24.3 ZSH 集成配置完成！");
    logger.info("💡 提示: ZSH 用户现在可以正常使用 Go 环境变量");

  } catch (error) {
    logger.error(`❌ ZSH 集成配置失败: ${error.message}`);
    throw error;
  }
}
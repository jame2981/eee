#!/usr/bin/env bun

/**
 * pkgs/python3.13/post_install.ts
 *
 * Python 3.13 后置安装配置
 * 负责配置 ZSH 环境集成
 */

import {
  getCurrentUser,
  logger
} from "@/pkg-utils";

import {
  initializeEeeEnv
} from "@/env-utils";

export default async function postInstall(): Promise<void> {
  logger.info("🔧 配置 Python 3.13 ZSH 集成...");

  const currentUser = getCurrentUser();

  try {
    // 确保 EEE 环境配置已初始化，包括 ZSH 集成
    await initializeEeeEnv();

    logger.success("✅ Python 3.13 ZSH 集成配置完成！");
    logger.info("💡 提示: ZSH 用户现在可以正常使用 UV 和 Python 环境变量");
    logger.info("💡 环境配置位于: ~/.eee-env，自动集成到 .bashrc 和 .zshrc");

  } catch (error) {
    logger.error(`❌ ZSH 集成配置失败: ${error.message}`);
    throw error;
  }
}
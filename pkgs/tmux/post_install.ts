#!/usr/bin/env bun

/**
 * pkgs/tmux/post_install.ts
 *
 * Tmux 后置安装：配置文件链接
 */

import { getUserEnv, logger } from "../../src/pkg-utils";
import { execCommand, execBashWithResult } from "../../src/shell/shell-executor";
import path from "path";

export default async function postInstall(): Promise<void> {
  logger.info("🔧 开始 Tmux 后置安装...");

  try {
    const { user, home } = getUserEnv();

    // 创建 tmux 配置目录并链接配置文件
    await setupTmuxConfig(user, home);

    logger.success("✅ Tmux 后置安装完成!");
    logger.info("💡 提示: Tmux 配置文件已链接到 ~/.config/tmux/tmux.conf");

  } catch (error) {
    logger.error(`❌ Tmux 后置安装失败: ${error.message}`);
    throw error;
  }
}

/**
 * 设置 tmux 配置文件
 */
async function setupTmuxConfig(user: string, home: string): Promise<void> {
  const configDir = `${home}/.config/tmux`;
  const configPath = `${configDir}/tmux.conf`;
  
  // 获取 dot.tmux.conf 的源文件路径
  const sourceConfigPath = path.join(import.meta.dir, "dot.tmux.conf");

  logger.info("==> 设置 Tmux 配置文件...");

  try {
    // 1. 创建配置目录
    await execCommand("sudo", ["-u", user, "mkdir", "-p", configDir]);
    logger.info(`==> 创建配置目录: ${configDir}`);

    // 2. 检查配置文件是否已存在
    const configExists = await execBashWithResult(`sudo -u ${user} test -f ${configPath}`);

    if (configExists.success) {
      // 备份现有配置
      const backupPath = `${configPath}.backup.${Date.now()}`;
      await execCommand("sudo", ["-u", user, "cp", configPath, backupPath]);
      logger.info(`==> 备份现有配置: ${backupPath}`);
    }

    // 3. 创建符号链接
    await execCommand("sudo", ["-u", user, "ln", "-sf", sourceConfigPath, configPath]);
    logger.success(`==> 配置文件已链接: ${sourceConfigPath} -> ${configPath}`);

  } catch (error) {
    logger.error(`❌ 配置文件设置失败: ${error.message}`);
    throw error;
  }
}


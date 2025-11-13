#!/usr/bin/env bun

/**
 * pkgs/zsh/post_install.ts
 *
 * Zsh 后置安装：oh-my-zsh 安装和 shell 切换
 */

import { getUserEnv, logger } from "../../src/pkg-utils";
import { execBash, execBashWithResult, execCommand } from "../../src/shell/shell-executor";

export default async function postInstall(): Promise<void> {
  logger.info("🔧 开始 Zsh 后置安装...");

  try {
    const { user, home } = getUserEnv();

    // 1. 检查并安装 oh-my-zsh
    await installOhMyZsh(user, home);

    // 2. 将当前用户的 shell 更新为 zsh
    await changeUserShell(user);

    logger.success("✅ Zsh 后置安装完成!");
    logger.info("💡 提示: 请重新登录或执行 'exec zsh' 以使 shell 更改生效");

  } catch (error) {
    logger.error(`❌ Zsh 后置安装失败: ${error.message}`);
    throw error;
  }
}

/**
 * 安装 oh-my-zsh
 */
async function installOhMyZsh(user: string, home: string): Promise<void> {
  const ohmyzshDir = `${home}/.oh-my-zsh`;

  // 检查 oh-my-zsh 是否已安装
  try {
    const checkResult = await execBashWithResult(`sudo -u ${user} test -d ${ohmyzshDir}`);
    if (checkResult.success) {
      logger.info("✅ oh-my-zsh 已安装，跳过安装步骤");
      return;
    }
  } catch {
    // 目录不存在，继续安装
  }

  logger.info("==> 开始安装 oh-my-zsh...");

  try {
    // 下载并安装 oh-my-zsh
    // 使用非交互式模式安装
    const installScript = `
      export RUNZSH=no
      export CHSH=no
      export HOME=${home}
      sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"
    `;

    await execBash(`sudo -u ${user} bash -c '${installScript.replace(/'/g, "'\\''")}'`);

    logger.success("✅ oh-my-zsh 安装完成");
  } catch (error) {
    logger.error(`❌ oh-my-zsh 安装失败: ${error.message}`);
    throw error;
  }
}

/**
 * 将用户的默认 shell 更改为 zsh
 */
async function changeUserShell(user: string): Promise<void> {
  try {
    // 获取 zsh 的完整路径
    const zshPath = (await execBash("which zsh")).trim();

    if (!zshPath) {
      throw new Error("无法找到 zsh 路径");
    }

    logger.info(`==> zsh 路径: ${zshPath}`);

    // 检查当前用户的 shell
    const currentShell = (await execBash(`getent passwd ${user}`)).split(':')[6]?.trim();

    if (currentShell === zshPath) {
      logger.info("✅ 用户 shell 已经是 zsh，跳过更改步骤");
      return;
    }

    logger.info(`==> 当前 shell: ${currentShell}`);
    logger.info(`==> 将用户 ${user} 的 shell 更改为 zsh...`);

    // 确保 zsh 在 /etc/shells 中
    const shells = await execBash("cat /etc/shells");
    if (!shells.includes(zshPath)) {
      logger.info("==> 将 zsh 添加到 /etc/shells...");
      await execBash(`sudo bash -c "echo ${zshPath} >> /etc/shells"`);
    }

    // 更改用户的 shell
    await execCommand("sudo", ["chsh", "-s", zshPath, user]);

    logger.success(`✅ 用户 ${user} 的默认 shell 已更改为 zsh`);
  } catch (error) {
    logger.error(`❌ 更改用户 shell 失败: ${error.message}`);
    throw error;
  }
}

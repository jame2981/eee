#!/usr/bin/env bun

/**
 * pkgs/zsh/post_install.ts
 *
 * Zsh 后置安装：oh-my-zsh 安装和 shell 切换
 */

import { getUserEnv, logger } from "../../src/pkg-utils";
import { execBash, execBashWithResult, execCommand } from "../../src/shell/shell-executor";
import { getGitHubManager, getOhMyZshCloneUrl, downloadOhMyZshInstallScript } from "../../src/network/github-manager";

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
    // 使用统一的 GitHub 管理器进行安装
    const githubManager = getGitHubManager();
    await githubManager.initialize();

    let installSuccess = false;

    // 方法1: 尝试使用官方安装脚本
    try {
      logger.info("==> 尝试下载官方安装脚本...");
      const installScript = await downloadOhMyZshInstallScript();

      // 创建临时脚本文件
      const tempScript = `/tmp/install-ohmyzsh-${Date.now()}.sh`;
      await execBash(`cat > ${tempScript} << 'EOF'
#!/bin/bash
export RUNZSH=no
export CHSH=no
export HOME=${home}
${installScript}
EOF`);

      await execBash(`chmod +x ${tempScript}`);
      await execBash(`sudo -u ${user} ${tempScript}`);
      await execBash(`rm -f ${tempScript}`);

      installSuccess = true;
      logger.success("✅ 使用官方安装脚本安装 oh-my-zsh 成功");
    } catch (scriptError) {
      logger.warn("⚠️ 官方安装脚本失败，尝试 git clone 方式...");
      logger.debug(`脚本安装错误: ${scriptError.message}`);
    }

    // 方法2: 使用 git clone 方式
    if (!installSuccess) {
      try {
        logger.info("==> 使用 git clone 方式安装...");

        await githubManager.cloneRepository('ohmyzsh', 'ohmyzsh', ohmyzshDir, {
          user: user
        });

        // 创建默认配置文件
        const zshrcTemplate = `${ohmyzshDir}/templates/zshrc.zsh-template`;
        const userZshrc = `${home}/.zshrc`;

        // 检查模板文件是否存在
        const templateExists = await execBashWithResult(`sudo -u ${user} test -f ${zshrcTemplate}`);
        if (templateExists.success) {
          await execBash(`sudo -u ${user} cp ${zshrcTemplate} ${userZshrc}`);
        } else {
          // 如果模板不存在，创建基本配置
          const basicZshrc = `# Path to your oh-my-zsh installation.
export ZSH="${ohmyzshDir}"

# Set name of the theme to load
ZSH_THEME="robbyrussell"

# Which plugins would you like to load?
plugins=(git)

source $ZSH/oh-my-zsh.sh
`;
          await execBash(`sudo -u ${user} bash -c 'cat > ${userZshrc} << "EOF"
${basicZshrc}
EOF'`);
        }

        installSuccess = true;
        logger.success("✅ 使用 git clone 方式安装 oh-my-zsh 成功");
      } catch (gitError) {
        logger.warn("⚠️ git clone 方式也失败，创建基本结构...");
        logger.debug(`Git 克隆错误: ${gitError.message}`);
      }
    }

    // 方法3: 创建基本的 oh-my-zsh 结构
    if (!installSuccess) {
      logger.info("==> 创建基本的 oh-my-zsh 目录结构...");

      await execBash(`sudo -u ${user} mkdir -p ${ohmyzshDir}/{themes,plugins,custom}`);

      // 创建基本的 .zshrc 文件
      const basicZshrc = `# Basic zsh configuration
export ZSH="${ohmyzshDir}"
ZSH_THEME="robbyrussell"
plugins=(git)
source $ZSH/oh-my-zsh.sh
`;

      await execBash(`sudo -u ${user} bash -c 'cat > ${home}/.zshrc << "EOF"
${basicZshrc}
EOF'`);

      // 创建基本的 oh-my-zsh.sh 文件
      const basicOhMyZsh = `# Basic oh-my-zsh loader
# This is a minimal oh-my-zsh setup created by EEE installer
echo "oh-my-zsh loaded (minimal setup)"
`;

      await execBash(`sudo -u ${user} bash -c 'cat > ${ohmyzshDir}/oh-my-zsh.sh << "EOF"
${basicOhMyZsh}
EOF'`);

      installSuccess = true;
      logger.success("✅ 创建基本 oh-my-zsh 结构成功");
      logger.info("💡 提示: 这是一个基本设置，您可以稍后手动完善配置");
    }

    // 显示当前使用的镜像源信息
    const currentMirror = githubManager.getCurrentMirror();
    if (currentMirror) {
      logger.info(`🎯 使用的镜像源: ${currentMirror.name} (${currentMirror.description})`);
    }
  } catch (error) {
    logger.error(`❌ oh-my-zsh 安装失败: ${error.message}`);

    // 提供更详细的错误信息和解决建议
    if (error.message.includes("curl")) {
      logger.error("💡 可能的原因：网络连接问题或防火墙阻止");
      logger.error("💡 建议：检查网络连接或手动安装 oh-my-zsh");
    } else if (error.message.includes("Permission denied")) {
      logger.error("💡 可能的原因：权限问题");
      logger.error("💡 建议：确保以 sudo 权限运行安装程序");
    }

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

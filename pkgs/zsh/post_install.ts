#!/usr/bin/env bun

/**
 * pkgs/zsh/post_install.ts
 *
 * Zsh后置安装脚本：
 * 1. 安装 Oh My Zsh
 * 2. 配置用户默认 shell 为 zsh
 * 3. 安装 zsh 配置文件到用户目录
 */

import { $ } from "bun";
import { existsSync } from "fs";
import { join } from "path";
import { logger } from "../../src/logger";

// Handle sudo environment - use the real user, not root
const CURRENT_USER = process.env.REAL_USER || process.env.SUDO_USER || process.env.USER || process.env.LOGNAME || "root";
const HOME_DIR = process.env.REAL_HOME || process.env.HOME || `/home/${CURRENT_USER}`;

async function main() {
  try {
    logger.info("🐚 开始配置 Zsh 环境...");

    // 1. 检查 Oh My Zsh 是否已安装
    const ohmyzshDir = join(HOME_DIR, ".oh-my-zsh");
    if (existsSync(ohmyzshDir)) {
      logger.success("✅ Oh My Zsh 已安装，跳过安装步骤");
    } else {
      logger.info("📦 开始安装 Oh My Zsh...");

      // 下载并安装 Oh My Zsh (非交互式安装)
      await $`sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" "" --unattended`;
      logger.success("✅ Oh My Zsh 安装完成");
    }

    // 2. 安装 zsh 配置文件
    logger.info("📝 安装 Zsh 配置文件...");
    const pkgDir = __dirname;
    const configFiles = [
      { src: "dot.zshrc", dest: ".zshrc" },
      { src: "dot.zshenv", dest: ".zshenv" }
    ];

    for (const { src, dest } of configFiles) {
      const srcPath = join(pkgDir, src);
      const destPath = join(HOME_DIR, dest);

      if (existsSync(srcPath)) {
        // 备份原文件
        if (existsSync(destPath)) {
          await $`cp "${destPath}" "${destPath}.bak"`;
          logger.info(`  > 已备份原有 ${dest} 为 ${dest}.bak`);
        }

        // 复制新配置
        await $`cp "${srcPath}" "${destPath}"`;
        await $`chown ${CURRENT_USER}:${CURRENT_USER} "${destPath}"`;
        logger.success(`  ✓ 已安装 ${dest}`);
      } else {
        logger.warn(`  ⚠️  配置文件 ${src} 不存在，跳过`);
      }
    }

    // 3. 更改用户默认 shell 为 zsh
    logger.info("🔧 设置默认 shell 为 zsh...");

    // 获取当前用户的默认 shell
    const currentShell = await $`getent passwd ${CURRENT_USER} | cut -d: -f7`.text();

    if (currentShell.trim() === "/usr/bin/zsh" || currentShell.trim() === "/bin/zsh") {
      logger.success("✅ 用户默认 shell 已是 zsh");
    } else {
      // 检查 zsh 是否在 /etc/shells 中
      const shells = await $`cat /etc/shells`.text();
      const zshPath = existsSync("/usr/bin/zsh") ? "/usr/bin/zsh" : "/bin/zsh";

      if (!shells.includes(zshPath)) {
        logger.info(`  > 添加 ${zshPath} 到 /etc/shells...`);
        await $`echo "${zshPath}" | sudo tee -a /etc/shells`;
      }

      // 更改默认 shell
      await $`sudo chsh -s ${zshPath} ${CURRENT_USER}`;
      logger.success(`✅ 已设置默认 shell 为 ${zshPath}`);
      logger.info("💡 注意：需要重新登录或启动新终端会话才能生效");
    }

    // 4. 安装一些实用的 Oh My Zsh 插件
    logger.info("🔌 安装 Oh My Zsh 插件...");

    const customPluginsDir = join(ohmyzshDir, "custom", "plugins");
    const plugins = [
      {
        name: "zsh-autosuggestions",
        repo: "https://github.com/zsh-users/zsh-autosuggestions"
      },
      {
        name: "zsh-syntax-highlighting",
        repo: "https://github.com/zsh-users/zsh-syntax-highlighting"
      }
    ];

    for (const plugin of plugins) {
      const pluginDir = join(customPluginsDir, plugin.name);
      if (existsSync(pluginDir)) {
        logger.info(`  > ${plugin.name} 已安装，跳过`);
      } else {
        await $`git clone ${plugin.repo} ${pluginDir}`;
        logger.success(`  ✓ 已安装 ${plugin.name}`);
      }
    }

    logger.success("🎉 Zsh 环境配置完成！");
    logger.info("📌 建议执行以下命令以立即使用 zsh：");
    logger.info("   exec zsh");

  } catch (error) {
    logger.error("❌ Zsh 配置过程中出现错误：", error.message);
    process.exit(1);
  }
}

main();
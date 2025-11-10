#!/usr/bin/env bun

/**
 * pkgs/nodejs22/post_install.ts
 *
 * Node.js 22 后置安装脚本：
 * 1. 配置 npm 全局包路径到用户目录
 * 2. 安装常用的全局工具包
 * 3. 优化 npm 配置
 */

import { $ } from "bun";
import { existsSync } from "fs";
import { logger } from "../../src/logger";

// Handle sudo environment - use the real user, not root
const CURRENT_USER = process.env.REAL_USER || process.env.SUDO_USER || process.env.USER || process.env.LOGNAME || "root";
const HOME_DIR = process.env.REAL_HOME || process.env.HOME || `/home/${CURRENT_USER}`;

async function main() {
  try {
    logger.info("📦 开始配置 Node.js 22 环境...");

    // 1. 设置 NVM 环境
    logger.info("🔧 配置 NVM 环境...");
    const nvmDir = `${HOME_DIR}/.nvm`;

    // 确保 NVM 目录权限正确
    await $`chown -R ${CURRENT_USER}:${CURRENT_USER} ${nvmDir}`;
    logger.success("✅ NVM 环境配置完成");

    // 2. 安装常用的全局工具包
    logger.info("🛠️  安装常用全局工具包...");

    const globalPackages = [
      "yarn",           // 包管理器
      "pnpm",           // 包管理器
      "pm2",            // 进程管理器
      "nodemon",        // 开发热重载
      "typescript",     // TypeScript 编译器
      "ts-node",        // TypeScript 执行器
      "@types/node",    // Node.js 类型定义
      "eslint",         // 代码检查
      "prettier",       // 代码格式化
      "jest",           // 测试框架
    ];

    for (const pkg of globalPackages) {
      try {
        logger.info(`  > 安装 ${pkg}...`);
        await $`sudo -u ${CURRENT_USER} bash -c "
          export NVM_DIR='${nvmDir}'
          [ -s '$NVM_DIR/nvm.sh' ] && source '$NVM_DIR/nvm.sh'
          npm install -g ${pkg}
        "`;
        logger.success(`  ✓ 已安装 ${pkg}`);
      } catch (error) {
        logger.warn(`  ⚠️  安装 ${pkg} 失败: ${error.message}`);
      }
    }

    // 3. 优化 npm 配置
    logger.info("⚙️  优化 npm 配置...");

    // 设置 npm 镜像源（可选）
    try {
      await $`sudo -u ${CURRENT_USER} bash -c "
        export NVM_DIR='${nvmDir}'
        [ -s '$NVM_DIR/nvm.sh' ] && source '$NVM_DIR/nvm.sh'
        npm config set registry https://registry.npmmirror.com/
      "`;
      logger.success("✅ 已设置 npm 淘宝镜像源");
    } catch (error) {
      logger.warn("⚠️  设置 npm 镜像源失败，使用默认源");
    }

    // 其他有用的配置
    await $`sudo -u ${CURRENT_USER} bash -c "
      export NVM_DIR='${nvmDir}'
      [ -s '$NVM_DIR/nvm.sh' ] && source '$NVM_DIR/nvm.sh'
      npm config set save-exact true
      npm config set init-version '1.0.0'
      npm config set init-license 'MIT'
    "`;

    logger.success("✅ npm 配置优化完成");

    // 4. 创建有用的别名文件
    logger.info("📝 创建 Node.js 别名和环境配置...");

    const nodeAliases = `
# Node.js 别名和快捷方式
alias npmi='npm install'
alias npmid='npm install --save-dev'
alias npms='npm start'
alias npmt='npm test'
alias npmr='npm run'
alias npmb='npm run build'
alias npmd='npm run dev'
alias npmw='npm run watch'
alias npmc='npm run clean'

# Yarn 别名
alias yi='yarn install'
alias ya='yarn add'
alias yad='yarn add --dev'
alias yr='yarn run'
alias yb='yarn build'
alias yd='yarn dev'
alias yt='yarn test'

# pnpm 别名
alias pi='pnpm install'
alias pa='pnpm add'
alias pad='pnpm add --save-dev'
alias pr='pnpm run'
alias pb='pnpm run build'
alias pd='pnpm run dev'
alias pt='pnpm test'

# Node.js 工具
alias node-version='node --version && npm --version && yarn --version && pnpm --version'
alias npm-global='npm list -g --depth=0'
alias npm-outdated='npm outdated'
alias npm-audit='npm audit'

# 项目初始化
alias npm-init='npm init -y'
alias yarn-init='yarn init -y'
alias pnpm-init='pnpm init'
`;

    const nodeEnvConfig = `
# Node.js 环境配置
export NODE_ENV=development

# NVM 配置
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

# Node.js 内存优化
export NODE_OPTIONS="--max-old-space-size=4096"

# 启用 Node.js 实验性功能
# export NODE_OPTIONS="$NODE_OPTIONS --experimental-modules"

# NVM 别名
alias nvm-list='nvm list'
alias nvm-use='nvm use'
alias nvm-install='nvm install'
alias nvm-current='nvm current'
`;

    // 写入别名文件
    const aliasFile = `${HOME_DIR}/.node_aliases`;
    await Bun.write(aliasFile, nodeAliases);
    await $`chown ${CURRENT_USER}:${CURRENT_USER} ${aliasFile}`;

    // 写入环境配置文件
    const envFile = `${HOME_DIR}/.node_env`;
    await Bun.write(envFile, nodeEnvConfig);
    await $`chown ${CURRENT_USER}:${CURRENT_USER} ${envFile}`;

    logger.success("✅ 别名和环境配置文件创建完成");
    logger.info(`  > 别名文件: ${aliasFile}`);
    logger.info(`  > 环境文件: ${envFile}`);
    logger.info("💡 提示: 在 ~/.bashrc 或 ~/.zshrc 中添加以下行来加载配置:");
    logger.info(`   source ${aliasFile}`);
    logger.info(`   source ${envFile}`);

    // 5. 验证安装
    logger.info("🔍 验证安装结果...");
    const versions = await $`sudo -u ${CURRENT_USER} bash -c "
      export NVM_DIR='${nvmDir}'
      [ -s '$NVM_DIR/nvm.sh' ] && source '$NVM_DIR/nvm.sh'
      echo 'node:' \$(node --version)
      echo 'npm:' \$(npm --version)
      echo 'nvm:' \$(nvm --version)
    "`.text();

    logger.success("🎉 Node.js 22 (via NVM) 环境配置完成！");
    logger.info(`📊 安装信息:`);
    versions.trim().split('\n').forEach(line => {
      if (line.trim()) logger.info(`  > ${line.trim()}`);
    });
    logger.info(`  > NVM 目录: ${nvmDir}`);
    logger.info("📝 建议执行以下命令重新加载环境变量:");
    logger.info("   source ~/.bashrc  # 或 source ~/.zshrc");

  } catch (error) {
    logger.error("❌ Node.js 22 配置过程中出现错误：", error.message);
    process.exit(1);
  }
}

main();
#!/usr/bin/env bun

/**
 * pkgs/nodejs22/install.ts
 *
 * Node.js 22.x 安装脚本
 * 通过已安装的 NVM 安装 Node.js（NVM 在 pre_install.ts 中安装）
 */

import {
  getCurrentUser,
  getUserHome,
  runAsUserScript,
  createSymlink
} from "@/pkg-utils";

import { logger } from "@/logger";

export default async function install(): Promise<void> {
  logger.info("📦 开始安装 Node.js 22.x...");

  const currentUser = getCurrentUser();
  const userHome = getUserHome(currentUser);
  const nvmDir = `${userHome}/.nvm`;

  logger.info(`==> 为用户 ${currentUser} 通过 NVM 安装 Node.js`);

  try {
    // 1. 验证 NVM 已安装
    logger.info("==> 验证 NVM 依赖...");
    const nvmExists = await runAsUserScript(
      `test -f "${nvmDir}/nvm.sh" && echo "exists" || echo "missing"`,
      currentUser
    );

    if (nvmExists.trim() !== "exists") {
      throw new Error("NVM 未安装。请确保 pre_install.ts 已成功执行");
    }

    logger.info("✅ NVM 依赖验证通过");

    // 2. 安装 Node.js 22
    logger.info("==> 使用 NVM 安装 Node.js 22...");

    const nodeInstallScript = `#!/bin/bash
      # NVM Node.js 安装脚本 - 强制使用 bash
      set -e  # 遇到错误立即退出

      echo "==> 开始 Node.js 安装"

      # 环境变量设置
      export NVM_DIR='${nvmDir}'
      echo "==> NVM目录: $NVM_DIR"

      # 验证 NVM 安装
      if [ ! -d "$NVM_DIR" ]; then
        echo "❌ NVM 目录不存在: $NVM_DIR"
        exit 1
      fi

      if [ ! -f "$NVM_DIR/nvm.sh" ]; then
        echo "❌ NVM 脚本不存在: $NVM_DIR/nvm.sh"
        exit 1
      fi

      # 加载 NVM - 关键步骤
      echo "==> 加载 NVM 环境"
      . "$NVM_DIR/nvm.sh"

      # 验证 NVM 是否可用
      if ! command -v nvm >/dev/null 2>&1; then
        echo "❌ NVM 命令不可用"
        exit 127
      fi

      echo "✅ NVM 加载成功: $(nvm --version)"

      # Node.js 安装逻辑
      echo "==> 检查 Node.js 22 安装状态"
      if nvm ls 22 >/dev/null 2>&1; then
        echo "✅ Node.js 22 已安装"
        nvm use 22
      else
        echo "==> 安装 Node.js 22"
        nvm install 22
        nvm use 22
      fi

      # 设置默认版本
      nvm alias default 22

      # 验证安装
      echo "==> 验证 Node.js 和 npm"
      node_version=$(node --version)
      npm_version=$(npm --version)

      echo "✅ Node.js: $node_version"
      echo "✅ npm: $npm_version"
      echo "✅ Node.js 22 安装完成"
    `;

    try {
      const result = await runAsUserScript(nodeInstallScript, currentUser);
      logger.info("==> Node.js 安装结果:");
      result.split('\n').forEach(line => {
        if (line.trim()) {
          logger.info(`    ${line.trim()}`);
        }
      });
    } catch (scriptError) {
      logger.error(`==> Node.js 安装失败: ${scriptError.message}`);
      throw scriptError;
    }

    // 3. 创建系统级符号链接（可选）
    logger.info("==> 创建系统级符号链接...");

    try {
      const getPathsScript = `
        export NVM_DIR='${nvmDir}'
        [ -s '$NVM_DIR/nvm.sh' ] && source '$NVM_DIR/nvm.sh'
        echo "NODE_PATH:$(which node)"
        echo "NPM_PATH:$(which npm)"
      `;

      const pathsResult = await runAsUserScript(getPathsScript, currentUser);

      let nodePath = "";
      let npmPath = "";

      pathsResult.split('\n').forEach(line => {
        if (line.startsWith('NODE_PATH:')) {
          nodePath = line.replace('NODE_PATH:', '').trim();
        } else if (line.startsWith('NPM_PATH:')) {
          npmPath = line.replace('NPM_PATH:', '').trim();
        }
      });

      if (nodePath && npmPath) {
        await createSymlink(nodePath, "/usr/local/bin/node");
        await createSymlink(npmPath, "/usr/local/bin/npm");
        logger.success("==> 系统级符号链接创建成功");
      } else {
        logger.warn("⚠️  无法获取 Node.js/npm 路径，跳过符号链接创建");
      }
    } catch (error) {
      logger.warn(`⚠️  符号链接创建失败: ${error.message}`);
      logger.info("💡 提示: Node.js 仍可通过 NVM 正常使用");
    }

    // 4. 最终验证
    logger.info("==> 最终验证 Node.js 安装...");

    const finalVerifyScript = `
      export NVM_DIR='${nvmDir}'
      [ -s '$NVM_DIR/nvm.sh' ] && source '$NVM_DIR/nvm.sh'
      echo "Node.js: $(node --version)"
      echo "npm: $(npm --version)"
      echo "默认版本: $(nvm current)"
    `;

    const versionInfo = await runAsUserScript(finalVerifyScript, currentUser);

    logger.success("✅ Node.js 22.x 安装完成!");
    versionInfo.trim().split('\n').forEach(line => {
      if (line.trim()) {
        logger.info(`  ${line.trim()}`);
      }
    });

    logger.info("💡 提示:");
    logger.info("  - 使用 'source ~/.bashrc' 或重新登录以加载 NVM 环境");
    logger.info("  - NVM 已配置，可使用 'nvm use <version>' 切换版本");

  } catch (error) {
    logger.error(`❌ Node.js 安装失败: ${error.message}`);
    throw error;
  }
}
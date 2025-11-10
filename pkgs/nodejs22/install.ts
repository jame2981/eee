#!/usr/bin/env bun

/**
 * pkgs/nodejs22/install.ts
 *
 * Node.js 22.x 安装脚本
 * 通过 NVM (Node Version Manager) 安装
 */

import {
  getCurrentUser,
  getUserHome,
  curlInstall,
  runAsUserScript,
  runAsUserWithEnv,
  createSymlink,
  verifyCommand,
  getCommandVersion,
  testUserCommand
} from "@/pkg-utils";

import { logger } from "@/logger";

export default async function install(): Promise<void> {
  logger.info("📦 开始安装 NVM 和 Node.js 22.x...");

  const currentUser = getCurrentUser();
  const userHome = getUserHome(currentUser);
  const nvmDir = `${userHome}/.nvm`;

  logger.info(`==> 为用户 ${currentUser} 安装到 ${userHome}`);

  try {
    // 1. 下载并安装 NVM
    logger.info("==> 下载并安装 NVM...");
    await runAsUserScript(
      `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash`,
      currentUser
    );

    // 2. 设置 NVM 环境
    logger.info("==> 设置 NVM 环境...");
    const nvmEnv = {
      NVM_DIR: nvmDir
    };

    // 3. 安装 Node.js 22
    logger.info("==> 使用 NVM 安装 Node.js 22...");
    const installScript = `
      export NVM_DIR='${nvmDir}'
      [ -s '$NVM_DIR/nvm.sh' ] && source '$NVM_DIR/nvm.sh'
      nvm install 22
      nvm use 22
      nvm alias default 22
    `;

    await runAsUserScript(installScript, currentUser);

    // 4. 获取 Node.js 和 npm 路径
    logger.info("==> 创建系统级符号链接...");

    const getNodePath = `
      export NVM_DIR='${nvmDir}'
      [ -s '$NVM_DIR/nvm.sh' ] && source '$NVM_DIR/nvm.sh'
      which node
    `;

    const getNpmPath = `
      export NVM_DIR='${nvmDir}'
      [ -s '$NVM_DIR/nvm.sh' ] && source '$NVM_DIR/nvm.sh'
      which npm
    `;

    try {
      const nodePath = await runAsUserScript(getNodePath, currentUser);
      const npmPath = await runAsUserScript(getNpmPath, currentUser);

      if (nodePath.trim() && npmPath.trim()) {
        await createSymlink(nodePath.trim(), "/usr/local/bin/node");
        await createSymlink(npmPath.trim(), "/usr/local/bin/npm");
        logger.success("==> 创建了系统级访问符号链接");
      }
    } catch (error) {
      logger.warn(`⚠️  创建符号链接失败: ${error.message}`);
    }

    // 5. 验证安装
    logger.info("==> 验证 Node.js 安装...");

    const verifyScript = `
      export NVM_DIR='${nvmDir}'
      [ -s '$NVM_DIR/nvm.sh' ] && source '$NVM_DIR/nvm.sh'
      echo "Node.js version: $(node --version)"
      echo "npm version: $(npm --version)"
      echo "NVM version: $(nvm --version)"
    `;

    const versionInfo = await runAsUserScript(verifyScript, currentUser);

    logger.success("✅ NVM 和 Node.js 22.x 安装完成!");
    versionInfo.trim().split('\n').forEach(line => {
      if (line.trim()) {
        logger.info(`  > ${line.trim()}`);
      }
    });

  } catch (error) {
    logger.error(`❌ Node.js 安装失败: ${error.message}`);
    throw error;
  }
}
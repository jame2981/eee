#!/usr/bin/env bun

/**
 * pkgs/nodejs22/pre_install.ts
 *
 * Node.js 22.x 依赖预安装
 * 负责安装 NVM (Node Version Manager)
 */

import {
  getCurrentUser,
  getUserHome,
  runAsUserScript,
  reloadEnv
} from "@/pkg-utils";

import { logger } from "@/logger";

export default async function preInstall(): Promise<void> {
  logger.info("🔧 开始安装 Node.js 依赖: NVM...");

  const currentUser = getCurrentUser();
  const userHome = getUserHome(currentUser);
  const nvmDir = `${userHome}/.nvm`;

  logger.info(`==> 为用户 ${currentUser} 安装 NVM 到 ${userHome}`);

  try {
    // 检查 NVM 是否已经安装
    const nvmExists = await runAsUserScript(
      `test -d "${nvmDir}" && echo "exists" || echo "not_exists"`,
      currentUser
    ).catch(() => "not_exists");

    if (nvmExists.trim() === "exists") {
      logger.success("✅ NVM 已安装，跳过安装步骤");
      return;
    }

    // 1. 下载并安装 NVM
    logger.info("==> 下载并安装 NVM...");
    logger.info("==> 调试: 即将执行 NVM 安装脚本");

    const nvmInstallResult = await runAsUserScript(
      `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash`,
      currentUser
    );

    logger.info("==> 调试: NVM 安装脚本执行结果:");
    nvmInstallResult.split('\n').forEach(line => {
      if (line.trim()) {
        logger.info(`    ${line.trim()}`);
      }
    });

    // 2. 验证 NVM 安装
    logger.info("==> 验证 NVM 安装...");
    const nvmVerifyResult = await runAsUserScript(
      `test -f "${nvmDir}/nvm.sh" && echo "NVM installed successfully" || echo "NVM installation failed"`,
      currentUser
    );

    logger.info(`==> 调试: NVM 验证结果: ${nvmVerifyResult.trim()}`);

    if (!nvmVerifyResult.includes("successfully")) {
      throw new Error("NVM 安装验证失败");
    }

    // 3. 重新加载环境变量以使 NVM 可用
    logger.info("==> NVM 安装完成，重新加载环境变量...");
    await reloadEnv(currentUser);

    // 4. 验证 NVM 功能
    logger.info("==> 测试 NVM 功能...");
    const nvmTestResult = await runAsUserScript(`
      export NVM_DIR='${nvmDir}'
      [ -s '$NVM_DIR/nvm.sh' ] && source '$NVM_DIR/nvm.sh'
      nvm --version
    `, currentUser);

    logger.success("✅ NVM 依赖安装完成!");
    logger.info(`==> NVM 版本: ${nvmTestResult.trim()}`);
    logger.info("==> 可以继续安装 Node.js 22.x");

  } catch (error) {
    logger.error(`❌ NVM 依赖安装失败: ${error.message}`);
    throw error;
  }
}
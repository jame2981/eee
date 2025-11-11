#!/usr/bin/env bun

/**
 * pkgs/python3.13/pre_install.ts
 *
 * Python 3.13 依赖预安装
 * 负责安装 UV (Python Package Manager)
 * 参考 Node.js + NVM 架构模式
 */

import {
  getCurrentUser,
  getUserHome,
  runAsUserScript,
  reloadEnv,
  isCommandAvailable,
  logger
} from "@/pkg-utils";

export default async function preInstall(): Promise<void> {
  logger.info("🔧 开始安装 Python 依赖: UV...");

  const currentUser = getCurrentUser();
  const userHome = getUserHome(currentUser);

  logger.info(`==> 为用户 ${currentUser} 安装 UV 到 ${userHome}`);

  try {
    // 检查 UV 是否已经安装
    const uvExists = await isCommandAvailable("uv");

    if (uvExists) {
      logger.success("✅ UV 已安装，跳过安装步骤");
      return;
    }

    // 1. 下载并安装 UV
    logger.info("==> 下载并安装 UV...");
    logger.info("==> 调试: 即将执行 UV 安装脚本");

    const uvInstallScript = `set -e
echo "==> 开始安装 UV"

# 下载并安装 UV
curl -LsSf https://astral.sh/uv/install.sh | sh

echo "==> UV 安装脚本执行完成"`;

    const uvInstallResult = await runAsUserScript(uvInstallScript, currentUser);

    logger.info("==> 调试: UV 安装脚本执行结果:");
    uvInstallResult.split('\n').forEach(line => {
      if (line.trim()) {
        logger.info(`    ${line.trim()}`);
      }
    });

    // 2. 重新加载环境变量以使 UV 可用
    logger.info("==> UV 安装完成，重新加载环境变量...");
    await reloadEnv(currentUser);

    // 3. 验证 UV 安装
    logger.info("==> 验证 UV 安装...");
    const uvVerifyScript = `set -e
export PATH="$HOME/.cargo/bin:$PATH"
if command -v uv >/dev/null 2>&1; then
  echo "UV installed successfully: $(uv --version)"
else
  echo "UV installation failed"
  exit 1
fi`;

    const uvVerifyResult = await runAsUserScript(uvVerifyScript, currentUser);

    logger.info(`==> 调试: UV 验证结果: ${uvVerifyResult.trim()}`);

    if (!uvVerifyResult.includes("UV installed successfully")) {
      throw new Error("UV 安装验证失败");
    }

    // 4. 测试 UV 功能
    logger.info("==> 测试 UV 功能...");
    const uvTestScript = `set -e
export PATH="$HOME/.cargo/bin:$PATH"
uv --version`;

    const uvTestResult = await runAsUserScript(uvTestScript, currentUser);

    logger.success("✅ UV 依赖安装完成!");
    logger.info(`==> UV 版本: ${uvTestResult.trim()}`);
    logger.info("==> 可以继续安装 Python 3.13");

  } catch (error) {
    logger.error(`❌ UV 依赖安装失败: ${error.message}`);
    throw error;
  }
}
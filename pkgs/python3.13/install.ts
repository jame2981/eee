#!/usr/bin/env bun

/**
 * pkgs/python3.13/install.ts
 *
 * Python 3.13 安装脚本
 * 通过已安装的 UV 安装 Python 3.13（UV 在 pre_install.ts 中安装）
 * 参考 Node.js + NVM 架构模式
 */

import {
  getCurrentUser,
  getUserHome,
  runAsUserScript,
  createSymlink,
  isCommandAvailable,
  logger
} from "@/pkg-utils";

export default async function install(): Promise<void> {
  logger.info("🐍 开始安装 Python 3.13...");

  const currentUser = getCurrentUser();
  const userHome = getUserHome(currentUser);

  logger.info(`==> 为用户 ${currentUser} 通过 UV 安装 Python 3.13`);

  try {
    // 1. 验证 UV 已安装
    logger.info("==> 验证 UV 依赖...");
    const uvVerifyScript = `set -e
export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"
if command -v uv >/dev/null 2>&1; then
  echo "exists"
else
  echo "missing"
fi`;

    const uvExists = await runAsUserScript(uvVerifyScript, currentUser);

    if (uvExists.trim() !== "exists") {
      throw new Error("UV 未安装。请确保 pre_install.ts 已成功执行");
    }

    logger.info("✅ UV 依赖验证通过");

    // 2. 检查 Python 3.13 是否已安装
    logger.info("==> 检查 Python 3.13 安装状态...");
    const pythonCheckScript = `set -e
export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"

# 检查是否已安装 Python 3.13
if uv python list | grep -q "3.13"; then
  echo "Python 3.13 already installed"
  uv python list | grep "3.13" | head -1
else
  echo "Python 3.13 not installed"
fi`;

    const pythonCheckResult = await runAsUserScript(pythonCheckScript, currentUser);

    if (pythonCheckResult.includes("already installed")) {
      logger.success("✅ Python 3.13 已安装");
      logger.info(`    ${pythonCheckResult.trim()}`);

      // 仍需创建符号链接
      await createSystemLinks(currentUser);
      return;
    }

    logger.info("==> Python 3.13 未安装，开始安装...");

    // 3. 使用 UV 安装 Python 3.13
    const pythonInstallScript = `#!/bin/bash
# UV Python 安装脚本 - 强制使用 bash
set -e  # 遇到错误立即退出

echo "==> 开始 Python 3.13 安装"

# 环境变量设置
export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"
echo "==> PATH: $PATH"

# 验证 UV 安装
if ! command -v uv >/dev/null 2>&1; then
  echo "❌ UV 命令不可用"
  exit 127
fi

echo "✅ UV 可用: $(uv --version)"

# 安装 Python 3.13
echo "==> 安装 Python 3.13"
uv python install 3.13

# 验证安装
echo "==> 验证 Python 3.13 安装"
uv python list | grep "3.13" | head -1

# 设置默认 Python
echo "==> 设置 Python 3.13 为当前项目默认版本"
uv python pin 3.13

echo "✅ Python 3.13 安装完成"`;

    try {
      const result = await runAsUserScript(pythonInstallScript, currentUser);
      logger.info("==> Python 3.13 安装结果:");
      result.split('\n').forEach(line => {
        if (line.trim()) {
          logger.info(`    ${line.trim()}`);
        }
      });
    } catch (scriptError) {
      logger.error(`==> Python 3.13 安装失败: ${scriptError.message}`);
      throw scriptError;
    }

    // 4. 创建系统级符号链接
    await createSystemLinks(currentUser);

    // 5. 最终验证
    logger.info("==> 最终验证 Python 3.13 安装...");

    const finalVerifyScript = `set -e
export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"
echo "UV 版本: $(uv --version)"
echo "已安装的 Python 版本:"
uv python list | grep "3.13" | head -3`;

    const versionInfo = await runAsUserScript(finalVerifyScript, currentUser);

    logger.success("✅ Python 3.13 安装完成!");
    versionInfo.trim().split('\n').forEach(line => {
      if (line.trim()) {
        logger.info(`  ${line.trim()}`);
      }
    });

    logger.info("💡 提示:");
    logger.info("  - 使用 'uv python list' 查看已安装的 Python 版本");
    logger.info("  - 使用 'uv python pin <version>' 设置项目默认版本");
    logger.info("  - 使用 'uv venv' 创建虚拟环境");

  } catch (error) {
    logger.error(`❌ Python 3.13 安装失败: ${error.message}`);
    throw error;
  }
}

/**
 * 创建系统级符号链接
 */
async function createSystemLinks(currentUser: string): Promise<void> {
  logger.info("==> 创建系统级符号链接...");

  try {
    const getPathsScript = `set -e
export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"

# 获取 UV 管理的 Python 3.13 路径
UV_PYTHON_PATH=$(uv python find 3.13)
echo "PYTHON_PATH:$UV_PYTHON_PATH"`;

    const pathsResult = await runAsUserScript(getPathsScript, currentUser);

    let pythonPath = "";

    pathsResult.split('\n').forEach(line => {
      if (line.startsWith('PYTHON_PATH:')) {
        pythonPath = line.replace('PYTHON_PATH:', '').trim();
      }
    });

    if (pythonPath) {
      await createSymlink(pythonPath, "/usr/local/bin/python3.13");
      // 也创建一个通用的 python3 链接
      await createSymlink(pythonPath, "/usr/local/bin/python3");
      logger.success("==> 系统级符号链接创建成功");
    } else {
      logger.warn("⚠️  无法获取 Python 3.13 路径，跳过符号链接创建");
    }
  } catch (error) {
    logger.warn(`⚠️  符号链接创建失败: ${error.message}`);
    logger.info("💡 提示: Python 3.13 仍可通过 UV 正常使用");
  }
}
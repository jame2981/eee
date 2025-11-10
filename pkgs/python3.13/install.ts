#!/usr/bin/env bun

/**
 * pkgs/python3.13/install.ts
 *
 * Python 3.13 核心安装逻辑
 * 使用 pkg-utils 简化安装过程
 */

import {
  addPpa,
  aptInstall,
  createSymlink,
  verifyCommand,
  getCommandVersion,
  curlInstall,
  getCurrentUser,
  shouldInstallPackage
} from "@/pkg-utils";

import { logger } from "@/logger";

export default async function install(): Promise<void> {
  // 首先检查是否已安装
  const checkResult = await shouldInstallPackage(
    "Python 3.13",
    "python3.13 --version | grep -E '^Python 3\\.13\\.' && pip3.13 --version"
  );

  if (checkResult.installed) {
    logger.success(`✅ Python 3.13 已安装: ${checkResult.version}`);
    return;
  }

  logger.info("🐍 开始安装 Python 3.13...");

  try {
    // 1. 添加 deadsnakes PPA
    await addPpa("ppa:deadsnakes/ppa");

    // 2. 安装 Python 3.13 和相关包
    await aptInstall([
      "python3.13",
      "python3.13-dev",
      "python3.13-venv",
      "python3.13-distutils",
      "python3.13-gdbm",
      "python3.13-tk",
      "python3-pip"
    ]);

    // 3. 安装 pip for Python 3.13
    logger.info("==> 安装 pip for Python 3.13...");
    await curlInstall("https://bootstrap.pypa.io/get-pip.py | python3.13");

    // 4. 创建便于访问的符号链接
    await createSymlink("/usr/bin/python3.13", "/usr/local/bin/python3.13");

    if (await verifyCommand("pip3.13")) {
      await createSymlink("/usr/local/bin/pip3.13", "/usr/local/bin/pip3.13");
    }

    // 5. 验证安装
    logger.info("==> 验证 Python 3.13 安装...");

    const pythonVersion = await getCommandVersion("python3.13");
    const pipVersion = await getCommandVersion("pip3.13");

    logger.success("✅ Python 3.13 安装完成!");
    logger.info(`  > Python: ${pythonVersion.trim()}`);
    logger.info(`  > pip: ${pipVersion.trim()}`);

  } catch (error) {
    logger.error(`❌ Python 3.13 安装失败: ${error.message}`);
    throw error;
  }
}
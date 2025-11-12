#!/usr/bin/env bun

/**
 * pkgs/build-essential/install.ts
 *
 * 安装编译工具链和开发依赖
 */

import { aptInstall } from "../../src/pkg-utils";
import { logger } from "../../src/logger";

export default async function install(): Promise<void> {
  logger.info("🔧 开始安装编译工具链...");

  try {

    // 安装基础编译工具
    await aptInstall([
      "build-essential",  // GCC, Make, 等基础编译工具
      "cmake",           // 现代构建系统
      "pkg-config",      // 库依赖管理
      "autoconf",        // 自动配置工具
      "automake",        // 自动化构建
      "libtool",         // 库工具
      "git",             // 版本控制
      "curl",            // 下载工具
      "wget",            // 下载工具
      "unzip",           // 压缩工具
      "zip",             // 压缩工具
      "tar",             // 归档工具
      "gzip",            // 压缩工具
      "bzip2",           // 压缩工具
      "xz-utils"         // 压缩工具
    ]);

    logger.success("✅ 编译工具链安装完成!");

  } catch (error) {
    logger.error(`❌ 编译工具链安装失败: ${error.message}`);
    throw error;
  }
}
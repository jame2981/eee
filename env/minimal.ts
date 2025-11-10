#!/usr/bin/env bun

/**
 * env/minimal.ts
 *
 * 最小化环境配置
 * 仅包含基础系统工具
 */

import { installEnvironment } from "@/installer";

const minimalEnvironment = {
  name: "最小化环境",
  description: "基础系统环境，仅包含必需的系统工具",
  packages: [
    "apt-base",        // 🔄 系统包更新
    "build-essential"  // 🔧 编译工具链
  ]
};

if (import.meta.main) {
  installEnvironment(minimalEnvironment).catch(err => {
    console.error("安装过程中发生严重错误:", err);
    process.exit(1);
  });
}
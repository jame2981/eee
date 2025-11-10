#!/usr/bin/env bun

/**
 * env/server.ts
 *
 * 服务器环境配置
 * 提供生产服务器必需的工具和服务
 */

import { installEnvironment } from "@/installer";

const serverEnvironment = {
  name: "服务器环境",
  description: "生产服务器运行环境，包含基础服务和容器化支持",
  packages: [
    "apt-base",        // 🔄 系统包更新
    "build-essential", // 🔧 编译工具链
    "docker",          // 🐳 容器化运行时
    "nodejs22",        // 🟢 Node.js 运行时
    "python3.13"       // 🐍 Python 运行时
  ]
};

if (import.meta.main) {
  installEnvironment(serverEnvironment).catch(err => {
    console.error("安装过程中发生严重错误:", err);
    process.exit(1);
  });
}
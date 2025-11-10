#!/usr/bin/env bun

/**
 * env/coding.ts
 *
 * 开发环境配置
 * 提供完整的软件开发工具链
 */

import { installEnvironment } from "@/installer";

const codingEnvironment = {
  name: "开发环境",
  description: "完整的软件开发工具链，支持多语言开发",
  packages: [
    "apt-base",        // 🔄 系统包更新
    "build-essential", // 🔧 编译工具链
    "flatpak",         // 📱 现代包管理
    "zsh",             // 🐚 现代 Shell
    "nodejs22",        // 🟢 Node.js 开发环境
    "docker",          // 🐳 容器化开发
    "python3.13",      // 🐍 Python 开发环境
    "golang1.24"       // 🐹 Go 开发环境
  ]
};

if (import.meta.main) {
  installEnvironment(codingEnvironment).catch(err => {
    console.error("安装过程中发生严重错误:", err);
    process.exit(1);
  });
}
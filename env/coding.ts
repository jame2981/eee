#!/usr/bin/env bun

/**
 * env/coding.ts
 *
 * 开发环境配置
 * 提供完整的软件开发工具链
 */

import { installEnvironment } from "@/installer";

function parseArgs(argv: string[]) {
  const res = { skip: [] as string[], only: [] as string[], container: false, noDockerService: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") { res.help = true; }
    else if (arg.startsWith("--skip=")) { res.skip = arg.split("=")[1].split(",").filter(Boolean); }
    else if (arg === "--skip") { const v = argv[i+1]; if (v && !v.startsWith("--")) { res.skip = v.split(","); i++; } }
    else if (arg.startsWith("--only=")) { res.only = arg.split("=")[1].split(",").filter(Boolean); }
    else if (arg === "--only") { const v = argv[i+1]; if (v && !v.startsWith("--")) { res.only = v.split(","); i++; } }
    else if (arg === "--container") { res.container = true; }
    else if (arg === "--no-docker-service") { res.noDockerService = true; }
  }
  return res;
}

const basePackages = [
  "apt-base",        // 🔄 系统包更新
  "build-essential", // 🔧 编译工具链
  "flatpak",         // 📱 现代包管理
  "zsh",             // 🐚 现代 Shell
  "nodejs22",        // 🟢 Node.js 开发环境
  "docker",          // 🐳 容器化开发
  "python3.13",      // 🐍 Python 开发环境
  "tmux",
  "golang1.24"       // 🐹 Go 开发环境
];

const args = parseArgs(process.argv.slice(2));

let selectedPackages = basePackages.slice();
if (args.only.length > 0) {
  selectedPackages = basePackages.filter(p => args.only.includes(p));
}
if (args.skip.length > 0) {
  selectedPackages = selectedPackages.filter(p => !args.skip.includes(p));
}

if (args.container) process.env.EEE_CONTAINER_MODE = "1";
if (args.noDockerService) process.env.EEE_SKIP_DOCKER_SERVICE = "1";

if (args.help) {
  console.log(`\n用法: sudo bun env/coding.ts [选项]\n\n选项:\n  --skip a,b,c            跳过指定包\n  --only a,b,c            仅安装指定包\n  --container             容器模式（启用容器内兼容行为）\n  --no-docker-service     不启用/启动 docker 服务\n  -h, --help              显示帮助\n\n可用包: ${basePackages.join(", ")}\n`);
  process.exit(0);
}

const codingEnvironment = {
  name: "开发环境",
  description: "完整的软件开发工具链，支持多语言开发",
  packages: selectedPackages
};

if (import.meta.main) {
  installEnvironment(codingEnvironment).catch(err => {
    console.error("安装过程中发生严重错误:", err);
    process.exit(1);
  });
}

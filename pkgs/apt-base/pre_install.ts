// pkgs/apt-base/pre_install.ts

import { $ } from "bun";
import { exists } from 'node:fs/promises';

console.log("🚀 准备更换 APT 源为清华大学镜像源...");

const sourcesListPath = "/etc/apt/sources.list.d/official-package-repositories.list";
const backupPath = "/etc/apt/sources.list.d/official-package-repositories.list.bak";

try {
  // 检查是否已经备份过，避免重复操作
  if (await exists(backupPath)) {
    console.log("✅ 检测到已存在备份文件，跳过更换源操作。");
  } else {
    console.log(`  > 正在备份 ${sourcesListPath} 到 ${backupPath}...`);
    await $`sudo cp ${sourcesListPath} ${backupPath}`;

    // 使用 tee 命令和 here-document 写入新内容，这比 sed 更可靠
    // 注意：请根据你的系统版本（如 focal, jammy）修改下面的源
    const newSources = `
deb https://mirrors.tuna.tsinghua.edu.cn/linuxmint/ zara main upstream import backport

deb https://mirrors.tuna.tsinghua.edu.cn/ubuntu/ noble main restricted universe multiverse
deb https://mirrors.tuna.tsinghua.edu.cn/ubuntu/ noble-updates main restricted universe multiverse
deb https://mirrors.tuna.tsinghua.edu.cn/ubuntu/ noble-backports main restricted universe multiverse
deb https://mirrors.tuna.tsinghua.edu.cn/ubuntu/ noble-security main restricted universe multiverse
`;

    // Bun Shell 会自动处理引号和换行符
    await $`echo ${newSources} | sudo tee ${sourcesListPath}`;
    
    console.log("✅ APT 源更换成功！");
  }
} catch (error) {
  console.error("❌ 更换 APT 源失败:", error);
  process.exit(1);
}

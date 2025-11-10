#!/usr/bin/env bun

/**
 * pkgs/apt-base/pre_install.ts
 *
 * APT 源更换为清华大学镜像源
 */

import { $ } from "bun";
import { exists } from "node:fs/promises";
import { logger } from "@/logger";

export default async function preInstall(): Promise<void> {
  logger.info("🚀 准备更换 APT 源为清华大学镜像源...");

  const sourcesListPath = "/etc/apt/sources.list.d/official-package-repositories.list";
  const backupPath = "/etc/apt/sources.list.d/official-package-repositories.list.bak";

  try {
    // 检查是否已经备份过，避免重复操作
    if (await exists(backupPath)) {
      logger.info("✅ 检测到已存在备份文件，跳过更换源操作");
      return;
    }

    logger.info(`==> 正在备份 ${sourcesListPath} 到 ${backupPath}...`);
    await $`sudo cp ${sourcesListPath} ${backupPath}`;

    // 使用统一的源配置
    const newSources = `
deb https://mirrors.tuna.tsinghua.edu.cn/linuxmint/ zara main upstream import backport

deb https://mirrors.tuna.tsinghua.edu.cn/ubuntu/ noble main restricted universe multiverse
deb https://mirrors.tuna.tsinghua.edu.cn/ubuntu/ noble-updates main restricted universe multiverse
deb https://mirrors.tuna.tsinghua.edu.cn/ubuntu/ noble-backports main restricted universe multiverse
deb https://mirrors.tuna.tsinghua.edu.cn/ubuntu/ noble-security main restricted universe multiverse
`;

    logger.info("==> 写入新的APT源配置...");
    await $`echo ${newSources} | sudo tee ${sourcesListPath}`;

    logger.success("✅ APT 源更换成功！");

  } catch (error) {
    logger.error(`❌ 更换 APT 源失败: ${error.message}`);
    throw error;
  }
}

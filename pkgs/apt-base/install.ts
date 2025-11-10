#!/usr/bin/env bun

/**
 * pkgs/apt-base/install.ts
 *
 * APT 基础包更新和升级
 */

import { $ } from "bun";
import { _aptUpdate, aptInstall } from "@/pkg-utils";
import { logger } from "@/logger";

export default async function install(): Promise<void> {
  logger.info("📦 开始更新和升级系统包...");

  try {
    // 更新包索引
    await _aptUpdate();

    // 安装 apt-utils 以消除 debconf 警告
    logger.info("==> 安装 apt-utils...");
    await aptInstall("apt-utils");

    // 升级所有包
    logger.info("==> 升级系统包...");
    await $`APT_LISTCHANGES_FRONTEND=none DEBIAN_FRONTEND=noninteractive apt upgrade -y`;

    logger.success("✅ 系统包更新和升级完成!");

  } catch (error) {
    logger.error(`❌ 系统包更新失败: ${error.message}`);
    throw error;
  }
}

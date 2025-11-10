/**
 * src/installer.ts
 *
 * 通用环境安装器
 * 提供可复用的安装逻辑，支持任意环境配置
 */

import { $ } from "bun";
import { logger } from "@/logger";
import { requireRoot, getSystemInfo } from "@/pkg-utils";

export interface EnvironmentConfig {
  name: string;                   // 环境名称，如 "开发环境"、"服务器环境"
  description?: string;           // 环境描述
  packages: string[];            // 包列表
}

/**
 * 安装环境配置
 * @param config 环境配置
 */
export async function installEnvironment(config: EnvironmentConfig) {
  const { name, description, packages } = config;

  logger.info(`🚀 开始安装${name}`);
  if (description) {
    logger.info(`📖 ${description}`);
  }

  // 检查权限
  requireRoot();

  // 显示系统信息
  const systemInfo = await getSystemInfo();
  logger.info(`📋 系统信息: ${systemInfo.distro} ${systemInfo.version} (${systemInfo.arch})`);

  logger.info(`📦 将安装 ${packages.length} 个软件包:`);
  packages.forEach((pkg, index) => {
    logger.info(`  ${index + 1}. ${pkg}`);
  });

  logger.info("\\n⏳ 开始安装...");

  // 依次安装每个包
  for (const [index, pkg] of packages.entries()) {
    const current = index + 1;
    const total = packages.length;

    logger.info(`\\n[${current}/${total}] 🔧 正在安装: ${pkg}`);

    try {
      const installPath = `./pkgs/${pkg}/install.ts`;
      await $`bun ${installPath}`;
      logger.success(`✅ ${pkg} 安装完成`);
    } catch (error) {
      logger.error(`❌ ${pkg} 安装失败:`, error);
      logger.error("后续安装已中止");
      process.exit(1);
    }
  }

  logger.success(`\\n🎉 ${name}安装完成！`);
  logger.info("\\n💡 提示:");
  logger.info("  - 重新登录或运行 'source ~/.bashrc' 来加载新的环境变量");
  logger.info("  - 检查各个工具的安装状态和配置");
}

/**
 * 简化的包安装接口（向后兼容）
 * @param packages 包名列表
 * @param envName 环境名称
 */
export async function installPackages(packages: string[], envName = "环境") {
  await installEnvironment({
    name: envName,
    packages
  });
}

export default installEnvironment;
#!/usr/bin/env bun

/**
 * src/env-utils.ts
 *
 * EEE 环境变量管理工具函数 - 兼容层
 *
 * ⚠️ 本文件为向后兼容层，内部使用 eee-env-manager.ts 实现
 * ⚠️ 新代码建议直接使用 EeeEnvManager 类获得更强大的功能
 *
 * 提供简单的函数式API，适合快速使用
 */

import { EeeEnvManager } from "./eee-env-manager";
import { getCurrentUser } from "./pkg-utils";
import { logger } from "./logger";

// 全局管理器实例（用于兼容层）
let sharedManager: EeeEnvManager | null = null;

/**
 * 获取共享的环境管理器实例
 */
function getSharedManager(): EeeEnvManager {
  if (!sharedManager) {
    sharedManager = new EeeEnvManager({
      shellIntegration: {
        bash: true,
        zsh: true,
        fish: false,
      },
      backup: {
        enabled: true,
        maxBackups: 5,
      },
    });
  }
  return sharedManager;
}

/**
 * 生成唯一的模块名称（用于临时模块）
 */
let moduleCounter = 0;
function generateModuleName(prefix: string): string {
  return `${prefix}-${Date.now()}-${++moduleCounter}`;
}

/**
 * insertPath - 追加路径到 PATH 开头，防止重复追加
 *
 * @param pathToAdd - 要添加到 PATH 的路径
 * @param comment - 可选的注释说明
 */
export async function insertPath(pathToAdd: string, comment?: string): Promise<void> {
  const manager = getSharedManager();
  const moduleName = generateModuleName("path");

  try {
    await manager.addModule({
      name: moduleName,
      description: comment || `Add ${pathToAdd} to PATH`,
      config: {
        paths: [pathToAdd],
        priority: 10, // 路径配置优先级较高
      },
    });

    await manager.applyConfiguration();
    logger.success(`成功添加路径到 PATH: ${pathToAdd}`);
  } catch (error) {
    // 如果模块已存在或路径已存在，这是正常的
    if (error.message?.includes("已存在") || error.message?.includes("already exists")) {
      logger.info(`路径 ${pathToAdd} 已存在，跳过添加`);
    } else {
      throw error;
    }
  }
}

/**
 * addSource - 追加 source 文件到结尾，需要判断文件存在才执行
 *
 * @param sourceFile - 要 source 的文件路径
 * @param comment - 可选的注释说明
 * @param checkExists - 是否需要检查文件存在（默认 true）
 */
export async function addSource(sourceFile: string, comment?: string, checkExists: boolean = true): Promise<void> {
  const manager = getSharedManager();
  const moduleName = generateModuleName("source");

  try {
    // 构建 source 命令
    const sourceLine = checkExists
      ? `[ -s "${sourceFile}" ] && source "${sourceFile}"`
      : `source "${sourceFile}"`;

    await manager.addModule({
      name: moduleName,
      description: comment || `Source ${sourceFile}`,
      config: {
        customCode: [sourceLine],
        priority: 50, // source 配置使用中等优先级
      },
    });

    await manager.applyConfiguration();
    logger.success(`成功添加 source 配置: ${sourceFile}`);
  } catch (error) {
    if (error.message?.includes("已存在") || error.message?.includes("already exists")) {
      logger.info(`Source 配置 ${sourceFile} 已存在，跳过添加`);
    } else {
      throw error;
    }
  }
}

/**
 * addEnvironmentVariable - 添加环境变量
 *
 * @param name - 环境变量名
 * @param value - 环境变量值
 * @param comment - 可选的注释说明
 */
export async function addEnvironmentVariable(name: string, value: string, comment?: string): Promise<void> {
  const manager = getSharedManager();
  const moduleName = generateModuleName("env");

  try {
    await manager.addModule({
      name: moduleName,
      description: comment || `Set ${name} environment variable`,
      config: {
        environment: {
          [name]: value,
        },
        priority: 30, // 环境变量使用较高优先级
      },
    });

    await manager.applyConfiguration();
    logger.success(`成功添加环境变量: ${name}=${value}`);
  } catch (error) {
    if (error.message?.includes("已存在") || error.message?.includes("already exists")) {
      logger.info(`环境变量 ${name} 已存在，跳过添加`);
    } else {
      throw error;
    }
  }
}

/**
 * initializeEeeEnv - 初始化 ~/.eee-env 文件和 shell 集成
 * 确保 .bashrc 和 .zshrc 会加载 ~/.eee-env
 */
export async function initializeEeeEnv(): Promise<void> {
  const manager = getSharedManager();

  try {
    // applyConfiguration() 会自动处理配置文件创建和 shell 集成
    await manager.applyConfiguration();
    logger.success(`EEE 环境配置初始化完成`);
  } catch (error) {
    logger.warn(`EEE 环境配置初始化失败: ${error.message}`);
    throw error;
  }
}

/**
 * getEeeEnvContent - 获取当前 ~/.eee-env 文件内容
 */
export async function getEeeEnvContent(): Promise<string> {
  const manager = getSharedManager();

  try {
    // 读取配置文件内容
    const content = await Bun.file(manager.getConfigPath()).text();
    return content;
  } catch (error) {
    logger.info(`环境配置文件不存在或无法读取`);
    return '';
  }
}

/**
 * clearEeeEnv - 清空 ~/.eee-env 文件内容（保留文件结构）
 *
 * ⚠️ 注意：此操作会清空所有已配置的环境模块
 */
export async function clearEeeEnv(): Promise<void> {
  const manager = getSharedManager();

  try {
    // 清空所有模块并重新应用配置
    manager.clearAllModules();
    await manager.applyConfiguration();

    logger.success(`清空环境配置文件完成`);
  } catch (error) {
    logger.warn(`清空环境配置文件失败: ${error.message}`);
    throw error;
  }
}

/**
 * 导出 EeeEnvManager 类，供需要更高级功能的代码使用
 */
export { EeeEnvManager } from "./eee-env-manager";

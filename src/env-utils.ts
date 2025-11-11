#!/usr/bin/env bun

/**
 * src/env-utils.ts
 *
 * EEE 环境变量管理工具函数
 * 提供简单实用的环境配置操作
 */

import {
  getCurrentUser,
  getUserHome,
  logger
} from "@/pkg-utils";

import { promises as fs } from "fs";
import { join } from "path";

/**
 * 获取用户的 ~/.eee-env 文件路径
 */
function getEeeEnvPath(): string {
  const currentUser = getCurrentUser();
  const userHome = getUserHome(currentUser);
  return join(userHome, ".eee-env");
}

/**
 * insertPath - 追加路径到 PATH 开头，防止重复追加
 * 参照 shell 脚本的 case 语句实现，使用 :${PATH}: 模式检查
 *
 * @param pathToAdd - 要添加到 PATH 的路径
 * @param comment - 可选的注释说明
 */
export async function insertPath(pathToAdd: string, comment?: string): Promise<void> {
  const eeeEnvPath = getEeeEnvPath();

  try {
    // 读取现有文件内容，如果文件不存在则创建空内容
    let content = '';
    try {
      content = await fs.readFile(eeeEnvPath, 'utf-8');
    } catch (error) {
      // 文件不存在，创建新文件
      logger.info(`创建新的环境配置文件: ${eeeEnvPath}`);
    }

    // 检查是否已经有相同路径的配置块，避免重复添加整个配置
    const pathConfigPattern = new RegExp(`case.*${pathToAdd.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*esac`, 's');
    if (pathConfigPattern.test(content)) {
      logger.info(`路径 ${pathToAdd} 的配置块已存在，跳过添加`);
      return;
    }

    // 构建新的 PATH 配置块（参照您提供的 shell 脚本）
    const pathConfigLines = [];

    if (comment) {
      pathConfigLines.push(`# ${comment}`);
    }

    pathConfigLines.push(
      `case ":$\{PATH}:" in`,
      `    *:"${pathToAdd}":*)`,
      `        ;;`,
      `    *)`,
      `        # Prepending path to prioritize development tools over system binaries`,
      `        export PATH="${pathToAdd}:$PATH"`,
      `        ;;`,
      `esac`
    );

    // 在文件末尾添加新的 PATH 配置块
    const separator = content && !content.endsWith('\n') ? '\n' : '';
    const newContent = content + separator + pathConfigLines.join('\n') + '\n';

    // 写入文件
    await fs.writeFile(eeeEnvPath, newContent, 'utf-8');

    logger.success(`✅ 成功添加路径到 PATH: ${pathToAdd}`);

  } catch (error) {
    logger.error(`❌ 添加路径到 PATH 失败: ${error.message}`);
    throw error;
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
  const eeeEnvPath = getEeeEnvPath();

  try {
    // 读取现有文件内容，如果文件不存在则创建空内容
    let content = '';
    try {
      content = await fs.readFile(eeeEnvPath, 'utf-8');
    } catch (error) {
      // 文件不存在，创建新文件
      logger.info(`创建新的环境配置文件: ${eeeEnvPath}`);
    }

    // 检查是否已经存在相同的 source 配置，避免重复添加
    const sourcePattern = new RegExp(`source\\s+["']?${sourceFile.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');
    if (sourcePattern.test(content)) {
      logger.info(`Source 配置 ${sourceFile} 已存在，跳过添加`);
      return;
    }

    // 构建 source 配置行
    let sourceLine: string;
    if (checkExists) {
      // 添加文件存在性检查
      sourceLine = `[ -s "${sourceFile}" ] && source "${sourceFile}"`;
    } else {
      // 直接 source
      sourceLine = `source "${sourceFile}"`;
    }

    // 构建要添加的内容
    const newLines = [];
    if (comment) {
      newLines.push(`# ${comment}`);
    }
    newLines.push(sourceLine);

    // 在文件末尾添加新的 source 配置
    const separator = content && !content.endsWith('\n') ? '\n' : '';
    const newContent = content + separator + newLines.join('\n') + '\n';

    // 写入文件
    await fs.writeFile(eeeEnvPath, newContent, 'utf-8');

    logger.success(`✅ 成功添加 source 配置: ${sourceFile}`);

  } catch (error) {
    logger.error(`❌ 添加 source 配置失败: ${error.message}`);
    throw error;
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
  const eeeEnvPath = getEeeEnvPath();

  try {
    // 读取现有文件内容
    let content = '';
    try {
      content = await fs.readFile(eeeEnvPath, 'utf-8');
    } catch (error) {
      logger.info(`创建新的环境配置文件: ${eeeEnvPath}`);
    }

    // 检查环境变量是否已经存在
    const envPattern = new RegExp(`export\\s+${name}=`, 'g');
    if (envPattern.test(content)) {
      logger.info(`环境变量 ${name} 已存在，跳过添加`);
      return;
    }

    // 构建环境变量配置行
    const envLine = `export ${name}="${value}"`;

    // 构建要添加的内容
    const newLines = [];
    if (comment) {
      newLines.push(`# ${comment}`);
    }
    newLines.push(envLine);

    // 在文件末尾添加新的环境变量配置
    const separator = content && !content.endsWith('\n') ? '\n' : '';
    const newContent = content + separator + newLines.join('\n') + '\n';

    // 写入文件
    await fs.writeFile(eeeEnvPath, newContent, 'utf-8');

    logger.success(`✅ 成功添加环境变量: ${name}=${value}`);

  } catch (error) {
    logger.error(`❌ 添加环境变量失败: ${error.message}`);
    throw error;
  }
}

/**
 * initializeEeeEnv - 初始化 ~/.eee-env 文件和 shell 集成
 * 确保 .bashrc 和 .zshrc 会加载 ~/.eee-env
 */
export async function initializeEeeEnv(): Promise<void> {
  const currentUser = getCurrentUser();
  const userHome = getUserHome(currentUser);
  const eeeEnvPath = getEeeEnvPath();

  try {
    // 1. 创建 ~/.eee-env 文件（如果不存在）
    try {
      await fs.access(eeeEnvPath);
      logger.info(`环境配置文件已存在: ${eeeEnvPath}`);
    } catch {
      // 文件不存在，创建文件并添加头部注释
      const initialContent = `#!/bin/bash
# EEE Environment Configuration
# This file is automatically managed by EEE (Easy Environment Everywhere)
# It contains all environment variables, PATH configurations, and shell integrations
#
# Generated on: ${new Date().toISOString()}
#

`;
      await fs.writeFile(eeeEnvPath, initialContent, 'utf-8');
      logger.success(`✅ 创建环境配置文件: ${eeeEnvPath}`);
    }

    // 2. 确保 .bashrc 加载 ~/.eee-env
    const bashrcPath = join(userHome, '.bashrc');
    await ensureShellIntegration(bashrcPath, '~/.eee-env', 'Bash');

    // 3. 确保 .zshrc 加载 ~/.eee-env
    const zshrcPath = join(userHome, '.zshrc');
    await ensureShellIntegration(zshrcPath, '~/.eee-env', 'ZSH');

    logger.success(`✅ EEE 环境配置初始化完成`);

  } catch (error) {
    logger.error(`❌ EEE 环境配置初始化失败: ${error.message}`);
    throw error;
  }
}

/**
 * 确保指定的 shell 配置文件会加载 ~/.eee-env
 */
async function ensureShellIntegration(shellConfigPath: string, eeeEnvFile: string, shellName: string): Promise<void> {
  try {
    // 读取现有配置文件内容
    let content = '';
    try {
      content = await fs.readFile(shellConfigPath, 'utf-8');
    } catch {
      // 配置文件不存在，创建新文件
      logger.info(`创建新的 ${shellName} 配置文件: ${shellConfigPath}`);
    }

    // 检查是否已经有 eee-env 集成配置
    const sourcePattern = new RegExp(`source\\s+["']?~?\\/?\\.eee-env`, 'g');
    if (sourcePattern.test(content)) {
      logger.info(`${shellName} 已配置 EEE 环境集成，跳过配置`);
      return;
    }

    // 添加 EEE 环境集成配置
    const integrationLines = [
      '',
      '# EEE Environment Integration',
      '# Load all EEE environment configurations',
      `[ -f "${eeeEnvFile}" ] && source "${eeeEnvFile}"`,
      ''
    ];

    const newContent = content + integrationLines.join('\n');
    await fs.writeFile(shellConfigPath, newContent, 'utf-8');

    logger.success(`✅ 配置 ${shellName} EEE 环境集成: ${shellConfigPath}`);

  } catch (error) {
    logger.error(`❌ 配置 ${shellName} 环境集成失败: ${error.message}`);
    throw error;
  }
}

/**
 * getEeeEnvContent - 获取当前 ~/.eee-env 文件内容
 */
export async function getEeeEnvContent(): Promise<string> {
  const eeeEnvPath = getEeeEnvPath();

  try {
    return await fs.readFile(eeeEnvPath, 'utf-8');
  } catch (error) {
    logger.info(`环境配置文件不存在: ${eeeEnvPath}`);
    return '';
  }
}

/**
 * clearEeeEnv - 清空 ~/.eee-env 文件内容（保留文件结构）
 */
export async function clearEeeEnv(): Promise<void> {
  const eeeEnvPath = getEeeEnvPath();

  try {
    const headerContent = `#!/bin/bash
# EEE Environment Configuration
# This file is automatically managed by EEE (Easy Environment Everywhere)
# It contains all environment variables, PATH configurations, and shell integrations
#
# Cleared on: ${new Date().toISOString()}
#

`;

    await fs.writeFile(eeeEnvPath, headerContent, 'utf-8');
    logger.success(`✅ 清空环境配置文件: ${eeeEnvPath}`);

  } catch (error) {
    logger.error(`❌ 清空环境配置文件失败: ${error.message}`);
    throw error;
  }
}
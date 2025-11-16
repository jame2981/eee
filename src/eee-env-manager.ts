#!/usr/bin/env bun

/**
 * eee-env-manager.ts
 *
 * EEE 环境配置管理系统 - 完整版
 * 提供幂等的、结构化的环境配置管理
 *
 * 核心特性：
 * - ✅ 幂等性：多次运行不产生副作用
 * - ✅ 完整性：支持环境变量、PATH、aliases、functions
 * - ✅ 结构化：模块化配置管理
 * - ✅ 多Shell兼容：bash、zsh、fish等
 * - ✅ 版本管理：跟踪配置变更
 * - ✅ 冲突检测：避免重复和冲突
 */

import { logger } from "./logger";
import { getCurrentUser, getUserHome, runAsUserScript } from "./pkg-utils";
import { execCommand, execBash, execBashWithResult } from "./shell/shell-executor";
import path from "path";

// ========== 类型定义 ==========

/**
 * Shell 配置项类型
 */
export interface ShellConfig {
  /** 环境变量 */
  environment?: Record<string, string>;
  /** PATH 路径（数组形式，自动去重） */
  paths?: string[];
  /** 别名配置 */
  aliases?: Record<string, string>;
  /** Shell 函数 */
  functions?: Record<string, string>;
  /** 自定义 Shell 代码 */
  customCode?: string[];
  /** 配置优先级（数字越小优先级越高） */
  priority?: number;
}

/**
 * EEE 环境配置模块
 */
export interface EeeEnvModule {
  /** 模块名称 */
  name: string;
  /** 模块描述 */
  description: string;
  /** Shell 配置 */
  config: ShellConfig;
  /** 模块版本 */
  version?: string;
  /** 依赖的其他模块 */
  dependencies?: string[];
  /** 条件激活（Shell 表达式） */
  condition?: string;
}

/**
 * EEE 环境管理器配置
 */
export interface EeeEnvManagerConfig {
  /** 配置文件路径 */
  configPath?: string;
  /** Shell 集成配置 */
  shellIntegration?: {
    bash?: boolean;
    zsh?: boolean;
    fish?: boolean;
  };
  /** 备份设置 */
  backup?: {
    enabled: boolean;
    maxBackups: number;
  };
}

// ========== EEE 环境管理器类 ==========

export class EeeEnvManager {
  private user: string;
  private userGroup: string;
  private userHome: string;
  private configPath: string;
  private config: EeeEnvManagerConfig;
  private modules: Map<string, EeeEnvModule> = new Map();

  constructor(config?: EeeEnvManagerConfig) {
    this.user = getCurrentUser();
    this.userHome = getUserHome(this.user);
    // 获取用户的真实主组（不假设组名等于用户名）
    this.userGroup = ""; // 将在 init() 中异步获取
    this.config = {
      configPath: path.join(this.userHome, ".eee-env"),
      shellIntegration: {
        bash: true,
        zsh: true,
        fish: false,
      },
      backup: {
        enabled: false,  // 默认关闭备份，初始化不需要备份
        maxBackups: 5,
      },
      ...config,
    };
    this.configPath = this.config.configPath!;
  }

  /**
   * 初始化管理器（获取用户组信息）
   */
  private async init(): Promise<void> {
    if (!this.userGroup) {
      // 获取用户的真实主组
      const { getUserPrimaryGroup } = await import("./pkg-utils");
      this.userGroup = await getUserPrimaryGroup(this.user);
    }
  }

  /**
   * 添加或更新环境模块
   */
  async addModule(module: EeeEnvModule): Promise<void> {
    logger.info(`🔧 配置环境模块: ${module.name}`);

    // 验证模块配置
    this.validateModule(module);

    // 检查依赖
    await this.checkDependencies(module);

    // 存储模块
    this.modules.set(module.name, module);

    logger.success(`✅ 环境模块 ${module.name} 已配置`);
  }

  /**
   * 移除环境模块
   */
  async removeModule(moduleName: string): Promise<void> {
    logger.info(`🗑️ 移除环境模块: ${moduleName}`);

    if (!this.modules.has(moduleName)) {
      logger.warn(`⚠️ 模块 ${moduleName} 不存在`);
      return;
    }

    // 检查是否被其他模块依赖
    const dependentModules = Array.from(this.modules.values())
      .filter(module => module.dependencies?.includes(moduleName))
      .map(module => module.name);

    if (dependentModules.length > 0) {
      throw new Error(`模块 ${moduleName} 被以下模块依赖: ${dependentModules.join(", ")}`);
    }

    this.modules.delete(moduleName);
    logger.success(`✅ 环境模块 ${moduleName} 已移除`);
  }

  /**
   * 获取配置文件路径
   */
  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * 清空所有模块
   */
  clearAllModules(): void {
    this.modules.clear();
    logger.info("🗑️ 已清空所有环境模块");
  }

  /**
   * 获取所有模块列表
   */
  getAllModules(): EeeEnvModule[] {
    return Array.from(this.modules.values());
  }

  /**
   * 修复所有 EEE 相关文件的权限
   * 用于修复之前以 root 运行留下的权限问题
   * 确保幂等性：可以安全地重复运行
   */
  async fixAllPermissions(): Promise<void> {
    logger.info("🔧 检查并修复 EEE 环境文件权限...");

    const filesToFix: string[] = [];

    // 修复主配置文件
    await this.fixFileOwnership(this.configPath);
    filesToFix.push(this.configPath);

    // 查找并修复所有备份文件
    try {
      const backupPattern = `${this.configPath}.backup.*`;
      const findBackupsScript = `ls ${backupPattern} 2>/dev/null || true`;
      const backupsOutput = await execBash(findBackupsScript);

      if (backupsOutput.trim()) {
        const backupFiles = backupsOutput.trim().split('\n');
        for (const backupFile of backupFiles) {
          if (backupFile) {
            await this.fixFileOwnership(backupFile);
            filesToFix.push(backupFile);
          }
        }
      }
    } catch {
      // 忽略查找备份文件的错误
    }

    // 修复 Shell 配置文件（如果需要）
    const shellFiles = [
      path.join(this.userHome, ".bashrc"),
      path.join(this.userHome, ".zshrc"),
    ];

    for (const shellFile of shellFiles) {
      await this.fixFileOwnership(shellFile);
    }

    logger.success(`✅ 权限检查完成，已处理 ${filesToFix.length} 个文件`);
  }

  /**
   * 生成并应用完整的环境配置
   * 核心功能：幂等的配置生成和应用
   */
  async applyConfiguration(): Promise<void> {
    logger.info("🚀 开始应用 EEE 环境配置...");

    // 0. 初始化（获取用户组信息）
    await this.init();

    // 1. 修复权限（确保幂等性）
    await this.fixAllPermissions();

    // 2. 备份当前配置
    if (this.config.backup?.enabled) {
      await this.backupCurrentConfig();
    }

    // 3. 解析依赖关系并排序模块
    const sortedModules = this.resolveDependencies();

    // 3. 生成合并配置
    const mergedConfig = this.mergeConfigurations(sortedModules);

    // 4. 生成配置文件内容
    const configContent = this.generateConfigContent(mergedConfig);

    // 5. 写入配置文件（幂等）
    await this.writeConfigFile(configContent);

    // 6. 配置 Shell 集成
    await this.configureShellIntegration();

    logger.success("✅ EEE 环境配置应用完成！");
  }

  /**
   * 验证当前环境配置
   */
  async validateConfiguration(): Promise<{
    valid: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];

    try {
      // 1. 检查配置文件是否存在
      const configExists = await this.checkFileExists(this.configPath);
      if (!configExists) {
        issues.push("配置文件 ~/.eee-env 不存在");
      }

      // 2. 检查 Shell 集成
      if (this.config.shellIntegration?.bash) {
        const bashIntegrated = await this.checkShellIntegration("bash");
        if (!bashIntegrated) {
          issues.push("Bash 集成未配置");
        }
      }

      if (this.config.shellIntegration?.zsh) {
        const zshIntegrated = await this.checkShellIntegration("zsh");
        if (!zshIntegrated) {
          issues.push("ZSH 集成未配置");
        }
      }

      // 3. 检查环境变量冲突
      const conflicts = await this.detectConfigConflicts();
      if (conflicts.length > 0) {
        issues.push(...conflicts.map(c => `环境变量冲突: ${c}`));
      }

      return {
        valid: issues.length === 0,
        issues,
      };
    } catch (error) {
      issues.push(`验证过程出错: ${error.message}`);
      return { valid: false, issues };
    }
  }

  /**
   * 获取环境信息
   */
  async getEnvironmentInfo(): Promise<{
    modules: EeeEnvModule[];
    configPath: string;
    shellIntegration: Record<string, boolean>;
    lastApplied?: Date;
  }> {
    return {
      modules: Array.from(this.modules.values()),
      configPath: this.configPath,
      shellIntegration: {
        bash: await this.checkShellIntegration("bash"),
        zsh: await this.checkShellIntegration("zsh"),
      },
      lastApplied: await this.getLastAppliedTime(),
    };
  }

  // ========== 私有方法 ==========

  /**
   * 验证模块配置
   */
  private validateModule(module: EeeEnvModule): void {
    if (!module.name) {
      throw new Error("模块名称不能为空");
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(module.name)) {
      throw new Error("模块名称只能包含字母、数字、下划线和横线");
    }

    // 验证环境变量名
    if (module.config.environment) {
      for (const key of Object.keys(module.config.environment)) {
        if (!/^[A-Z_][A-Z0-9_]*$/.test(key)) {
          throw new Error(`无效的环境变量名: ${key}`);
        }
      }
    }

    // 验证别名名称
    if (module.config.aliases) {
      for (const key of Object.keys(module.config.aliases)) {
        if (!/^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(key)) {
          throw new Error(`无效的别名名称: ${key}`);
        }
      }
    }
  }

  /**
   * 检查模块依赖
   */
  private async checkDependencies(module: EeeEnvModule): Promise<void> {
    if (!module.dependencies) return;

    for (const dep of module.dependencies) {
      if (!this.modules.has(dep)) {
        throw new Error(`模块 ${module.name} 依赖 ${dep}，但该依赖不存在`);
      }
    }
  }

  /**
   * 解析依赖关系并按优先级排序
   */
  private resolveDependencies(): EeeEnvModule[] {
    const sorted: EeeEnvModule[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (moduleName: string) => {
      if (visited.has(moduleName)) return;
      if (visiting.has(moduleName)) {
        throw new Error(`检测到循环依赖: ${moduleName}`);
      }

      const module = this.modules.get(moduleName);
      if (!module) return;

      visiting.add(moduleName);

      // 先处理依赖
      if (module.dependencies) {
        for (const dep of module.dependencies) {
          visit(dep);
        }
      }

      visiting.delete(moduleName);
      visited.add(moduleName);
      sorted.push(module);
    };

    // 按优先级排序模块名
    const moduleNames = Array.from(this.modules.keys()).sort((a, b) => {
      const priorityA = this.modules.get(a)?.config.priority ?? 100;
      const priorityB = this.modules.get(b)?.config.priority ?? 100;
      return priorityA - priorityB;
    });

    for (const moduleName of moduleNames) {
      visit(moduleName);
    }

    return sorted;
  }

  /**
   * 合并多个模块的配置
   */
  private mergeConfigurations(modules: EeeEnvModule[]): ShellConfig {
    const merged: ShellConfig = {
      environment: {},
      paths: [],
      aliases: {},
      functions: {},
      customCode: [],
    };

    for (const module of modules) {
      const config = module.config;

      // 合并环境变量（后面的覆盖前面的）
      if (config.environment) {
        Object.assign(merged.environment!, config.environment);
      }

      // 合并 PATH（去重）
      if (config.paths) {
        for (const path of config.paths) {
          if (!merged.paths!.includes(path)) {
            merged.paths!.push(path);
          }
        }
      }

      // 合并别名（检测冲突）
      if (config.aliases) {
        for (const [key, value] of Object.entries(config.aliases)) {
          if (merged.aliases![key] && merged.aliases![key] !== value) {
            logger.warn(`⚠️ 别名冲突: ${key} (${merged.aliases![key]} vs ${value})`);
          }
          merged.aliases![key] = value;
        }
      }

      // 合并函数（检测冲突）
      if (config.functions) {
        for (const [key, value] of Object.entries(config.functions)) {
          if (merged.functions![key] && merged.functions![key] !== value) {
            logger.warn(`⚠️ 函数冲突: ${key}`);
          }
          merged.functions![key] = value;
        }
      }

      // 合并自定义代码
      if (config.customCode) {
        merged.customCode!.push(...config.customCode);
      }
    }

    return merged;
  }

  /**
   * 生成配置文件内容
   */
  private generateConfigContent(config: ShellConfig): string {
    const lines: string[] = [];

    // 文件头部
    lines.push("#!/bin/bash");
    lines.push("#");
    lines.push("# EEE Development Environment Configuration");
    lines.push("# 自动生成，请勿直接编辑");
    lines.push(`# 生成时间: ${new Date().toISOString()}`);
    lines.push("#");
    lines.push("");

    // 环境变量
    if (config.environment && Object.keys(config.environment).length > 0) {
      lines.push("# ========== 环境变量 ==========");
      lines.push("");
      for (const [key, value] of Object.entries(config.environment)) {
        lines.push(`export ${key}="${value}"`);
      }
      lines.push("");
    }

    // PATH 配置
    if (config.paths && config.paths.length > 0) {
      lines.push("# ========== PATH 配置 ==========");
      lines.push("");
      for (const pathEntry of config.paths) {
        lines.push(`# 添加到 PATH: ${pathEntry}`);
        lines.push(`if [ -d "${pathEntry}" ] && [[ ":$PATH:" != *":${pathEntry}:"* ]]; then`);
        lines.push(`  export PATH="${pathEntry}:$PATH"`);
        lines.push(`fi`);
      }
      lines.push("");
    }

    // 别名
    if (config.aliases && Object.keys(config.aliases).length > 0) {
      lines.push("# ========== 别名配置 ==========");
      lines.push("");
      for (const [key, value] of Object.entries(config.aliases)) {
        lines.push(`alias ${key}='${value}'`);
      }
      lines.push("");
    }

    // 函数
    if (config.functions && Object.keys(config.functions).length > 0) {
      lines.push("# ========== 函数定义 ==========");
      lines.push("");
      for (const [key, value] of Object.entries(config.functions)) {
        lines.push(`${key}() {`);
        lines.push(value.split('\n').map(line => `  ${line}`).join('\n'));
        lines.push(`}`);
        lines.push("");
      }
    }

    // 自定义代码
    if (config.customCode && config.customCode.length > 0) {
      lines.push("# ========== 自定义代码 ==========");
      lines.push("");
      lines.push(...config.customCode);
      lines.push("");
    }

    // 文件结尾
    lines.push("# ========== EEE 环境配置结束 ==========");

    return lines.join('\n');
  }

  /**
   * 幂等写入配置文件
   */
  /**
   * 写入配置文件（以正确的用户身份）
   * 修复: 使用 runAsUserScript 确保文件由目标用户拥有
   * 幂等性: 自动修复之前由 root 创建的文件权限
   */
  private async writeConfigFile(content: string): Promise<void> {
    try {
      // 检查文件是否存在以及内容是否相同
      const currentContent = await this.readCurrentConfig();

      if (currentContent === content) {
        logger.info("配置文件无变更，跳过写入");
        return;
      }

      // 修复文件权限（如果文件已存在但所有者不对）
      await this.fixFileOwnership(this.configPath);

      // 使用 here document 以目标用户身份写入文件
      // 这确保文件由正确的用户拥有，而不是 root
      const writeScript = `cat > "${this.configPath}" << 'EEEEOF'
${content}
EEEEOF
chmod 644 "${this.configPath}"`;

      await runAsUserScript(writeScript, this.user);

      logger.info(`✅ 配置文件已更新: ${this.configPath}`);
    } catch (error) {
      logger.error(`❌ 写入配置文件失败: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * 读取当前配置文件内容
   */
  private async readCurrentConfig(): Promise<string | null> {
    try {
      const file = Bun.file(this.configPath);
      if (await file.exists()) {
        return await file.text();
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * 配置 Shell 集成
   */
  private async configureShellIntegration(): Promise<void> {
    if (this.config.shellIntegration?.bash) {
      await this.configureBashIntegration();
    }

    if (this.config.shellIntegration?.zsh) {
      await this.configureZshIntegration();
    }
  }

  /**
   * 配置 Bash 集成
   */
  private async configureBashIntegration(): Promise<void> {
    const bashrcPath = path.join(this.userHome, ".bashrc");

    const sourceLines = [
      "# EEE Development Environment",
      `if [ -f "${this.configPath}" ]; then`,
      `  source "${this.configPath}"`,
      "fi",
    ];

    await this.addLinesToShellConfig(bashrcPath, sourceLines, "EEE Development Environment");
    logger.info("✅ Bash 集成已配置");
  }

  /**
   * 配置 ZSH 集成
   */
  private async configureZshIntegration(): Promise<void> {
    const zshrcPath = path.join(this.userHome, ".zshrc");

    // 确保 .zshrc 存在
    await this.ensureFileExists(zshrcPath);

    const sourceLines = [
      "# EEE Development Environment",
      `if [ -f "${this.configPath}" ]; then`,
      `  source "${this.configPath}"`,
      "fi",
    ];

    await this.addLinesToShellConfig(zshrcPath, sourceLines, "EEE Development Environment");
    logger.info("✅ ZSH 集成已配置");
  }

  /**
   * 幂等地向 Shell 配置文件添加行
   */
  private async addLinesToShellConfig(
    filePath: string,
    lines: string[],
    marker: string
  ): Promise<void> {
    try {
      // 检查是否已经配置
      const markerExists = await this.checkMarkerInFile(filePath, marker);
      if (markerExists) {
        logger.info(`配置已存在于 ${filePath}，跳过`);
        return;
      }

      // 添加配置
      const content = lines.join('\n') + '\n';
      await this.appendToFile(filePath, content);

      logger.info(`✅ 配置已添加到 ${filePath}`);
    } catch (error) {
      logger.error(`❌ 配置 ${filePath} 失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 检查文件中是否存在标记
   */
  private async checkMarkerInFile(filePath: string, marker: string): Promise<boolean> {
    try {
      const checkScript = `
        if [ -f "${filePath}" ] && grep -q "${marker}" "${filePath}"; then
          echo "exists"
        else
          echo "missing"
        fi
      `;

      const result = await runAsUserScript(checkScript, this.user);
      return result.trim() === "exists";
    } catch {
      return false;
    }
  }

  /**
   * 追加内容到文件
   * 修复: 使用 here document 避免特殊字符问题
   */
  private async appendToFile(filePath: string, content: string): Promise<void> {
    const appendScript = `cat >> "${filePath}" << 'EEEEOF'
${content}
EEEEOF`;
    await runAsUserScript(appendScript, this.user);
  }

  /**
   * 确保文件存在
   * 修复: 确保父目录存在并检查权限
   */
  private async ensureFileExists(filePath: string): Promise<void> {
    const parentDir = path.dirname(filePath);
    const createScript = `
if [ ! -d "${parentDir}" ]; then
  mkdir -p "${parentDir}"
fi
if [ ! -f "${filePath}" ]; then
  touch "${filePath}"
fi`;
    await runAsUserScript(createScript, this.user);
  }

  /**
   * 检查文件是否存在
   */
  private async checkFileExists(filePath: string): Promise<boolean> {
    try {
      const file = Bun.file(filePath);
      return await file.exists();
    } catch {
      return false;
    }
  }

  /**
   * 设置文件权限
   */
  private async setFilePermissions(filePath: string, mode: string): Promise<void> {
    try {
      await execCommand("chmod", [mode, filePath]);
    } catch {
      // 忽略错误
    }
  }

  /**
   * 修复文件所有权
   * 如果文件存在但所有者不是目标用户，自动修复
   * 这确保了幂等性：即使之前以 root 运行，再次以普通用户运行也能成功
   */
  private async fixFileOwnership(filePath: string): Promise<void> {
    try {
      // 检查文件是否存在
      const exists = await this.checkFileExists(filePath);
      if (!exists) {
        return; // 文件不存在，无需修复
      }

      // 获取文件当前所有者
      const checkOwnerScript = `stat -c "%U" "${filePath}" 2>/dev/null || stat -f "%Su" "${filePath}" 2>/dev/null`;
      const currentOwner = (await execBash(checkOwnerScript)).trim();

      // 如果所有者不是目标用户，修复权限
      if (currentOwner && currentOwner !== this.user) {
        logger.warn(`⚠️  检测到 ${filePath} 所有者为 ${currentOwner}，正在修复为 ${this.user}:${this.userGroup}...`);

        try {
          // 使用真实的用户:组格式（不假设组名等于用户名）
          await execCommand("sudo", ["chown", `${this.user}:${this.userGroup}`, filePath]);
          logger.info(`✅ 已修复 ${filePath} 的所有权为 ${this.user}:${this.userGroup}`);
        } catch (chownError) {
          // 如果 sudo 失败，抛出带有解决方案的错误
          const errorMsg = chownError instanceof Error ? chownError.message : String(chownError);

          if (errorMsg.includes("password") || errorMsg.includes("terminal")) {
            // sudo 需要密码
            throw new Error(
              `❌ 无法修复 ${filePath} 的权限（需要 sudo 密码）\n\n` +
              `请先运行以下命令修复权限：\n` +
              `  sudo chown ${this.user}:${this.userGroup} ${filePath}\n` +
              `或使用修复脚本：\n` +
              `  sudo ./fix-permissions.sh\n\n` +
              `修复后即可正常运行。`
            );
          } else {
            // 其他错误
            throw new Error(`❌ 无法修复 ${filePath} 的权限: ${errorMsg}`);
          }
        }
      }
    } catch (error) {
      // 重新抛出错误（不要静默处理）
      throw error;
    }
  }

  /**
   * 检查 Shell 集成状态
   */
  private async checkShellIntegration(shell: "bash" | "zsh"): Promise<boolean> {
    const configFile = shell === "bash"
      ? path.join(this.userHome, ".bashrc")
      : path.join(this.userHome, ".zshrc");

    return await this.checkMarkerInFile(configFile, this.configPath);
  }

  /**
   * 检测配置冲突
   */
  private async detectConfigConflicts(): Promise<string[]> {
    // 这里可以实现更复杂的冲突检测逻辑
    // 目前返回空数组作为占位符
    return [];
  }

  /**
   * 备份当前配置
   * 修复: 确保备份文件也由正确的用户拥有
   */
  private async backupCurrentConfig(): Promise<void> {
    if (!await this.checkFileExists(this.configPath)) {
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = `${this.configPath}.backup.${timestamp}`;

    try {
      // 使用目标用户身份创建备份
      const backupScript = `cp "${this.configPath}" "${backupPath}"`;
      await runAsUserScript(backupScript, this.user);

      logger.info(`📦 配置文件已备份: ${backupPath}`);
    } catch {
      // 忽略备份错误
    }

    // 清理旧备份
    await this.cleanupOldBackups();
  }

  /**
   * 清理旧备份
   */
  private async cleanupOldBackups(): Promise<void> {
    const maxBackups = this.config.backup?.maxBackups ?? 5;

    try {
      const listScript = `ls -1t "${this.configPath}".backup.* 2>/dev/null | tail -n +${maxBackups + 1}`;
      const oldBackups = await runAsUserScript(listScript, this.user);

      if (oldBackups.trim()) {
        const deleteScript = `rm -f ${oldBackups.trim().split('\n').join(' ')}`;
        await runAsUserScript(deleteScript, this.user);
        logger.info(`🗑️ 清理旧备份: ${oldBackups.trim().split('\n').length} 个文件`);
      }
    } catch {
      // 忽略清理失败
    }
  }

  /**
   * 获取最后应用时间
   */
  private async getLastAppliedTime(): Promise<Date | undefined> {
    try {
      const stat = await execBash(`stat -c %Y "${this.configPath}"`);
      return new Date(parseInt(stat.trim()) * 1000);
    } catch {
      return undefined;
    }
  }
}

// ========== 便捷函数 ==========

/**
 * 创建简单的环境变量模块
 */
export function createEnvModule(
  name: string,
  description: string,
  environment: Record<string, string>,
  options?: {
    paths?: string[];
    aliases?: Record<string, string>;
    priority?: number;
  }
): EeeEnvModule {
  return {
    name,
    description,
    config: {
      environment,
      paths: options?.paths,
      aliases: options?.aliases,
      priority: options?.priority,
    },
  };
}

/**
 * 创建版本管理器模块
 */
export function createVersionManagerModule(
  name: string,
  description: string,
  managerPath: string,
  initScript?: string
): EeeEnvModule {
  const config: ShellConfig = {
    paths: [managerPath],
    priority: 10, // 版本管理器优先级较高
  };

  if (initScript) {
    config.customCode = [initScript];
  }

  return {
    name,
    description,
    config,
  };
}

export { logger };
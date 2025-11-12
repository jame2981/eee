// src/version-manager-installer.ts

/**
 * 版本管理器安装抽象基类
 *
 * 统一 goup (Go), nvm (Node.js), uv (Python) 等版本管理器的安装流程
 *
 * 使用方法：
 * ```typescript
 * class GoupInstaller extends VersionManagerInstaller {
 *   // 实现抽象方法
 * }
 *
 * const installer = new GoupInstaller();
 * await installer.install();
 * ```
 */

import { logger } from "./logger";
import { withStep } from "./logging-utils";
import { ShellScriptBuilder } from "./shell-script-builder";
import { runAsUserScript, getCurrentUser, getUserHome } from "./user/user-env";
import { initializeEeeEnv, addEnvironmentVariable, insertPath, addSource } from "./env-utils";

/**
 * 版本管理器配置
 */
export interface VersionManagerConfig {
  /** 版本管理器名称 (如 "goup", "nvm", "uv") */
  name: string;
  /** 要安装的语言/工具名称 (如 "Go", "Node.js", "Python") */
  toolName: string;
  /** 要安装的版本 */
  version: string;
  /** 版本管理器安装目录 */
  installDir?: string;
  /** 环境变量配置 */
  envVars?: Record<string, string>;
  /** PATH 路径列表 */
  paths?: string[];
  /** 需要 source 的文件列表 */
  sourceFiles?: Array<{ path: string; checkExists?: boolean }>;
}

/**
 * 版本管理器安装抽象基类
 */
export abstract class VersionManagerInstaller {
  protected config: VersionManagerConfig;
  protected currentUser: string;
  protected userHome: string;

  constructor(config: VersionManagerConfig) {
    this.config = config;
    this.currentUser = getCurrentUser();
    this.userHome = getUserHome();
  }

  /**
   * 完整的安装流程
   */
  async install(): Promise<void> {
    logger.step(`开始安装 ${this.config.toolName} 版本管理器: ${this.config.name}`);

    try {
      // 1. 检查是否已安装
      const isInstalled = await this.checkInstalled();
      if (isInstalled) {
        logger.info(`${this.config.name} 已安装，跳过安装步骤`);
      } else {
        // 2. 安装版本管理器
        await withStep(`安装 ${this.config.name}`, async () => {
          await this.installManager();
        });
      }

      // 3. 安装指定版本
      await withStep(`安装 ${this.config.toolName} ${this.config.version}`, async () => {
        await this.installVersion(this.config.version);
      });

      // 4. 配置环境
      await withStep(`配置 ${this.config.name} 环境`, async () => {
        await this.configureEnvironment();
      });

      // 5. 验证安装
      await withStep(`验证 ${this.config.toolName} 安装`, async () => {
        await this.verifyInstallation();
      });

      logger.success(`✅ ${this.config.toolName} 安装完成！`);
    } catch (error) {
      logger.warn(`❌ ${this.config.toolName} 安装失败: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * 检查版本管理器是否已安装
   */
  protected abstract checkInstalled(): Promise<boolean>;

  /**
   * 安装版本管理器
   */
  protected abstract installManager(): Promise<void>;

  /**
   * 安装指定版本的工具
   */
  protected abstract installVersion(version: string): Promise<void>;

  /**
   * 验证安装是否成功
   */
  protected abstract verifyInstallation(): Promise<void>;

  /**
   * 配置环境变量（通用实现）
   */
  protected async configureEnvironment(): Promise<void> {
    // 初始化 EEE 环境
    await initializeEeeEnv();

    // 配置环境变量
    if (this.config.envVars) {
      for (const [key, value] of Object.entries(this.config.envVars)) {
        await addEnvironmentVariable(
          key,
          value,
          `${this.config.name} - ${key}`
        );
      }
    }

    // 配置 PATH
    if (this.config.paths) {
      for (const pathEntry of this.config.paths) {
        await insertPath(pathEntry, `${this.config.name} - ${pathEntry}`);
      }
    }

    // 配置 source 文件
    if (this.config.sourceFiles) {
      for (const sourceFile of this.config.sourceFiles) {
        await addSource(
          sourceFile.path,
          `${this.config.name} - ${sourceFile.path}`,
          sourceFile.checkExists ?? true
        );
      }
    }
  }

  /**
   * 创建安装脚本构建器（带默认配置）
   */
  protected createScriptBuilder(): ShellScriptBuilder {
    return new ShellScriptBuilder()
      .addShebang("bash")
      .setStrictMode()
      .exportPath("$HOME/.local/bin");
  }

  /**
   * 执行脚本（以当前用户身份）
   */
  protected async runScript(script: string): Promise<string> {
    return await runAsUserScript(script, this.currentUser);
  }

  /**
   * 检查命令是否可用
   */
  protected async isCommandAvailable(command: string): Promise<boolean> {
    try {
      const script = this.createScriptBuilder()
        .addCommand(`command -v ${command} > /dev/null 2>&1`)
        .build();

      await this.runScript(script);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取命令版本
   */
  protected async getCommandVersion(command: string, versionFlag = "--version"): Promise<string> {
    try {
      const script = this.createScriptBuilder()
        .addCommand(`${command} ${versionFlag} 2>&1`)
        .build();

      const output = await this.runScript(script);
      return output.trim();
    } catch (error) {
      throw new Error(`无法获取 ${command} 版本: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * 便捷函数：从配置创建并安装版本管理器
 */
export async function installVersionManager(
  InstallerClass: new (config: VersionManagerConfig) => VersionManagerInstaller,
  config: VersionManagerConfig
): Promise<void> {
  const installer = new InstallerClass(config);
  await installer.install();
}

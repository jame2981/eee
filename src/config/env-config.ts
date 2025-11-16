/**
 * src/config/env-config.ts
 * 
 * 统一的环境配置管理系统
 * 支持 .env 文件和环境变量
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { logger } from '../logger';

/**
 * EEE 配置接口
 */
export interface EeeConfig {
  // 代理配置
  proxy?: {
    http?: string;
    https?: string;
    ftp?: string;
    noProxy?: string[];
    enabled?: boolean;
  };
  
  // GitHub 配置
  github?: {
    preferredMirrors?: string[];
    timeout?: number;
    retryCount?: number;
  };
  
  // 日志配置
  logging?: {
    level?: 'debug' | 'info' | 'warn' | 'error';
    file?: string;
  };
  
  // 安装配置
  install?: {
    containerMode?: boolean;
    skipDockerService?: boolean;
    defaultShell?: string;
  };
  
  // 网络配置
  network?: {
    timeout?: number;
    retryCount?: number;
    userAgent?: string;
  };
}

/**
 * 环境配置管理器
 */
export class EnvConfigManager {
  private config: EeeConfig = {};
  private loaded = false;
  private envFilePath: string;

  constructor(envFilePath?: string) {
    this.envFilePath = envFilePath || this.findEnvFile();
  }

  /**
   * 查找 .env 文件
   */
  private findEnvFile(): string {
    const possiblePaths = [
      join(process.cwd(), '.env'),
      join(process.cwd(), '.env.local'),
      join(process.env.HOME || '~', '.eee', '.env'),
    ];

    for (const path of possiblePaths) {
      if (existsSync(path)) {
        return path;
      }
    }

    return join(process.cwd(), '.env'); // 默认路径
  }

  /**
   * 解析 .env 文件内容
   */
  private parseEnvFile(content: string): Record<string, string> {
    const result: Record<string, string> = {};
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      
      // 跳过注释和空行
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      // 解析 KEY=VALUE 格式
      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match) {
        const [, key, value] = match;
        const cleanKey = key.trim();
        let cleanValue = value.trim();

        // 移除引号
        if ((cleanValue.startsWith('"') && cleanValue.endsWith('"')) ||
            (cleanValue.startsWith("'") && cleanValue.endsWith("'"))) {
          cleanValue = cleanValue.slice(1, -1);
        }

        result[cleanKey] = cleanValue;
      }
    }

    return result;
  }

  /**
   * 加载配置
   */
  public load(): void {
    if (this.loaded) return;

    // 1. 从 .env 文件加载
    this.loadFromEnvFile();
    
    // 2. 从环境变量覆盖
    this.loadFromEnvironmentVariables();
    
    this.loaded = true;
    logger.debug('环境配置已加载', this.config);
  }

  /**
   * 从 .env 文件加载配置
   */
  private loadFromEnvFile(): void {
    if (!existsSync(this.envFilePath)) {
      logger.debug(`环境文件不存在: ${this.envFilePath}`);
      return;
    }

    try {
      const content = readFileSync(this.envFilePath, 'utf-8');
      const envVars = this.parseEnvFile(content);
      
      // 将环境变量临时设置到 process.env 中
      Object.entries(envVars).forEach(([key, value]) => {
        if (!process.env[key]) { // 不覆盖已存在的环境变量
          process.env[key] = value;
        }
      });
      
      logger.debug(`从 .env 文件加载了 ${Object.keys(envVars).length} 个配置项`);
    } catch (error) {
      logger.warn(`读取 .env 文件失败: ${error.message}`);
    }
  }

  /**
   * 从环境变量加载配置
   */
  private loadFromEnvironmentVariables(): void {
    // 代理配置
    this.config.proxy = {
      enabled: this.getBooleanEnv('EEE_PROXY_ENABLED', true),
      http: process.env.HTTP_PROXY || process.env.http_proxy,
      https: process.env.HTTPS_PROXY || process.env.https_proxy,
      ftp: process.env.FTP_PROXY || process.env.ftp_proxy,
      noProxy: this.getArrayEnv('NO_PROXY') || this.getArrayEnv('no_proxy')
    };

    // GitHub 配置
    this.config.github = {
      preferredMirrors: this.getArrayEnv('EEE_GITHUB_MIRROR'),
      timeout: this.getNumberEnv('EEE_GITHUB_TIMEOUT', 15),
      retryCount: this.getNumberEnv('EEE_GITHUB_RETRY', 3)
    };

    // 日志配置
    this.config.logging = {
      level: (process.env.EEE_LOG_LEVEL as any) || 'info',
      file: process.env.EEE_LOG_FILE
    };

    // 安装配置
    this.config.install = {
      containerMode: this.getBooleanEnv('EEE_CONTAINER_MODE', false),
      skipDockerService: this.getBooleanEnv('EEE_SKIP_DOCKER_SERVICE', false),
      defaultShell: process.env.EEE_DEFAULT_SHELL || 'zsh'
    };

    // 网络配置
    this.config.network = {
      timeout: this.getNumberEnv('EEE_NETWORK_TIMEOUT', 30),
      retryCount: this.getNumberEnv('EEE_NETWORK_RETRY', 3),
      userAgent: process.env.EEE_USER_AGENT || 'EEE-Installer/1.0'
    };
  }

  /**
   * 获取布尔值环境变量
   */
  private getBooleanEnv(key: string, defaultValue: boolean = false): boolean {
    const value = process.env[key];
    if (!value) return defaultValue;
    return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
  }

  /**
   * 获取数字环境变量
   */
  private getNumberEnv(key: string, defaultValue: number = 0): number {
    const value = process.env[key];
    if (!value) return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  /**
   * 获取数组环境变量（逗号分隔）
   */
  private getArrayEnv(key: string): string[] | undefined {
    const value = process.env[key];
    if (!value) return undefined;
    return value.split(',').map(s => s.trim()).filter(s => s.length > 0);
  }

  /**
   * 获取完整配置
   */
  public getConfig(): EeeConfig {
    if (!this.loaded) this.load();
    return { ...this.config };
  }

  /**
   * 获取特定配置部分
   */
  public getProxyConfig() {
    if (!this.loaded) this.load();
    return this.config.proxy;
  }

  public getGitHubConfig() {
    if (!this.loaded) this.load();
    return this.config.github;
  }

  public getLoggingConfig() {
    if (!this.loaded) this.load();
    return this.config.logging;
  }

  public getInstallConfig() {
    if (!this.loaded) this.load();
    return this.config.install;
  }

  public getNetworkConfig() {
    if (!this.loaded) this.load();
    return this.config.network;
  }

  /**
   * 重新加载配置
   */
  public reload(): void {
    this.loaded = false;
    this.config = {};
    this.load();
  }

  /**
   * 验证配置
   */
  public validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.loaded) this.load();

    // 验证代理配置
    if (this.config.proxy?.enabled) {
      if (this.config.proxy.http && !this.isValidUrl(this.config.proxy.http)) {
        errors.push('HTTP_PROXY 不是有效的 URL');
      }
      if (this.config.proxy.https && !this.isValidUrl(this.config.proxy.https)) {
        errors.push('HTTPS_PROXY 不是有效的 URL');
      }
      if (this.config.proxy.ftp && !this.isValidUrl(this.config.proxy.ftp)) {
        errors.push('FTP_PROXY 不是有效的 URL');
      }
    }

    // 验证 GitHub 配置
    if (this.config.github?.preferredMirrors) {
      const validMirrors = ['github', 'gitee', 'fastgit', 'ghproxy', 'jsdelivr', 'gitclone', 'cnpmjs'];
      const invalidMirrors = this.config.github.preferredMirrors.filter(
        mirror => !validMirrors.includes(mirror)
      );
      if (invalidMirrors.length > 0) {
        errors.push(`无效的镜像源: ${invalidMirrors.join(', ')}`);
      }
    }

    if (this.config.github?.timeout && this.config.github.timeout <= 0) {
      errors.push('GitHub 超时时间必须大于 0');
    }

    if (this.config.github?.retryCount && this.config.github.retryCount < 0) {
      errors.push('GitHub 重试次数不能为负数');
    }

    // 验证日志配置
    if (this.config.logging?.level) {
      const validLevels = ['debug', 'info', 'warn', 'error'];
      if (!validLevels.includes(this.config.logging.level)) {
        errors.push(`无效的日志级别: ${this.config.logging.level}`);
      }
    }

    // 验证网络配置
    if (this.config.network?.timeout && this.config.network.timeout <= 0) {
      errors.push('网络超时时间必须大于 0');
    }

    if (this.config.network?.retryCount && this.config.network.retryCount < 0) {
      errors.push('网络重试次数不能为负数');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 验证 URL 格式
   */
  private isValidUrl(urlString: string): boolean {
    try {
      new URL(urlString);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取配置摘要（用于日志）
   */
  public getConfigSummary(): string {
    if (!this.loaded) this.load();

    const summary: string[] = [];

    if (this.config.proxy?.enabled) {
      summary.push('代理: 启用');
    }

    if (this.config.github?.preferredMirrors?.length) {
      summary.push(`GitHub镜像: ${this.config.github.preferredMirrors[0]}`);
    }

    if (this.config.install?.containerMode) {
      summary.push('容器模式: 启用');
    }

    return summary.length > 0 ? summary.join(', ') : '默认配置';
  }
}

// 全局配置管理器实例
let globalConfigManager: EnvConfigManager | undefined;

/**
 * 获取全局配置管理器
 */
export function getConfigManager(): EnvConfigManager {
  if (!globalConfigManager) {
    globalConfigManager = new EnvConfigManager();
  }
  return globalConfigManager;
}

/**
 * 便捷函数：获取配置
 */
export function getConfig(): EeeConfig {
  return getConfigManager().getConfig();
}

/**
 * 便捷函数：获取代理配置
 */
export function getProxyConfig() {
  return getConfigManager().getProxyConfig();
}

/**
 * 便捷函数：获取 GitHub 配置
 */
export function getGitHubConfig() {
  return getConfigManager().getGitHubConfig();
}

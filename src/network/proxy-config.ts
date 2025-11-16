/**
 * src/network/proxy-config.ts
 * 
 * 代理配置管理系统
 * 支持环境变量、配置文件和运行时配置
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { logger } from '../logger';
import { getConfigManager } from '../config/env-config';

/**
 * 代理配置接口
 */
export interface ProxySettings {
  http?: string;
  https?: string;
  ftp?: string;
  noProxy?: string[];
  enabled?: boolean;
}

/**
 * EEE 网络配置
 */
export interface EeeNetworkConfig {
  proxy?: ProxySettings;
  github?: {
    preferredMirrors?: string[];
    timeout?: number;
    retryCount?: number;
  };
}

/**
 * 代理配置管理器
 */
export class ProxyConfigManager {
  private configPath: string;
  private config: EeeNetworkConfig = {};

  constructor(configPath?: string) {
    this.configPath = configPath || join(homedir(), '.eee', 'network.json');
    this.loadConfig();
  }

  /**
   * 加载配置（优先级：.env 文件 > 环境变量 > 配置文件 > 默认值）
   */
  private loadConfig(): void {
    // 1. 从配置文件加载
    this.loadFromFile();

    // 2. 从 .env 文件和环境变量加载（通过统一配置管理器）
    this.loadFromEnvConfig();

    logger.debug('代理配置已加载:', this.config);
  }

  /**
   * 从配置文件加载
   */
  private loadFromFile(): void {
    if (existsSync(this.configPath)) {
      try {
        const content = readFileSync(this.configPath, 'utf-8');
        this.config = JSON.parse(content);
        logger.debug(`从配置文件加载: ${this.configPath}`);
      } catch (error) {
        logger.warn(`配置文件解析失败: ${error.message}`);
        this.config = {};
      }
    }
  }

  /**
   * 从统一配置管理器加载（包含 .env 文件和环境变量）
   */
  private loadFromEnvConfig(): void {
    const configManager = getConfigManager();

    // 获取代理配置
    const proxyConfig = configManager.getProxyConfig();
    if (proxyConfig) {
      this.config.proxy = { ...this.config.proxy, ...proxyConfig };
      logger.debug('从统一配置管理器加载代理配置');
    }

    // 获取 GitHub 配置
    const githubConfig = configManager.getGitHubConfig();
    if (githubConfig) {
      this.config.github = { ...this.config.github, ...githubConfig };
      logger.debug('从统一配置管理器加载 GitHub 配置');
    }
  }

  /**
   * 保存配置到文件
   */
  public saveConfig(): void {
    try {
      // 确保目录存在
      const configDir = join(homedir(), '.eee');
      if (!existsSync(configDir)) {
        require('fs').mkdirSync(configDir, { recursive: true });
      }
      
      writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
      logger.info(`配置已保存到: ${this.configPath}`);
    } catch (error) {
      logger.error(`保存配置失败: ${error.message}`);
    }
  }

  /**
   * 获取代理配置
   */
  public getProxyConfig(): ProxySettings | undefined {
    return this.config.proxy;
  }

  /**
   * 设置代理配置
   */
  public setProxyConfig(proxy: ProxySettings): void {
    this.config.proxy = proxy;
  }

  /**
   * 获取 GitHub 配置
   */
  public getGitHubConfig(): EeeNetworkConfig['github'] {
    return this.config.github;
  }

  /**
   * 设置 GitHub 配置
   */
  public setGitHubConfig(github: EeeNetworkConfig['github']): void {
    this.config.github = github;
  }

  /**
   * 获取完整配置
   */
  public getConfig(): EeeNetworkConfig {
    return { ...this.config };
  }

  /**
   * 检查代理是否启用
   */
  public isProxyEnabled(): boolean {
    return this.config.proxy?.enabled !== false; // 默认启用
  }
}

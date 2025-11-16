/**
 * src/network/github-manager.ts
 * 
 * GitHub 链接统一管理系统
 * 支持代理配置、镜像源切换和网络容错
 */

import { logger } from "../logger";
import { execBash } from "../shell/shell-executor";
import { ProxyConfigManager, type ProxySettings } from "./proxy-config";
import { getConfigManager } from "../config/env-config";

/**
 * GitHub 镜像源配置
 */
export interface GitHubMirror {
  name: string;
  baseUrl: string;
  rawUrl: string;
  description: string;
  priority: number; // 优先级，数字越小优先级越高
}

/**
 * 代理配置
 */
export interface ProxyConfig {
  http?: string;
  https?: string;
  noProxy?: string[];
}

/**
 * GitHub 管理器配置
 */
export interface GitHubManagerConfig {
  proxy?: ProxyConfig;
  preferredMirrors?: string[]; // 优先使用的镜像源名称
  timeout?: number; // 连接超时时间（秒）
  retryCount?: number; // 重试次数
}

/**
 * 预定义的 GitHub 镜像源
 */
const GITHUB_MIRRORS: GitHubMirror[] = [
  {
    name: "github",
    baseUrl: "https://github.com",
    rawUrl: "https://raw.githubusercontent.com",
    description: "GitHub 官方源",
    priority: 1
  },
  {
    name: "gitee",
    baseUrl: "https://gitee.com",
    rawUrl: "https://gitee.com",
    description: "Gitee 镜像源（国内推荐）",
    priority: 2
  },
  {
    name: "fastgit",
    baseUrl: "https://hub.fastgit.xyz",
    rawUrl: "https://raw.fastgit.org",
    description: "FastGit 镜像源",
    priority: 3
  },
  {
    name: "ghproxy",
    baseUrl: "https://ghproxy.com/https://github.com",
    rawUrl: "https://ghproxy.com/https://raw.githubusercontent.com",
    description: "GHProxy 代理源",
    priority: 4
  },
  {
    name: "jsdelivr",
    baseUrl: "https://github.com", // JSDelivr 不支持 git clone，仅用于 raw 文件
    rawUrl: "https://cdn.jsdelivr.net/gh",
    description: "JSDelivr CDN（仅支持文件下载）",
    priority: 5
  },
  {
    name: "gitclone",
    baseUrl: "https://gitclone.com/github.com",
    rawUrl: "https://raw.githubusercontents.com",
    description: "GitClone 镜像源",
    priority: 6
  },
  {
    name: "cnpmjs",
    baseUrl: "https://github.com.cnpmjs.org",
    rawUrl: "https://raw.githubusercontent.com.cnpmjs.org",
    description: "CNPM 镜像源",
    priority: 7
  }
];

/**
 * GitHub 管理器类
 */
export class GitHubManager {
  private config: GitHubManagerConfig;
  private availableMirrors: GitHubMirror[] = [];
  private currentMirror?: GitHubMirror;
  private proxyManager: ProxyConfigManager;

  constructor(config: GitHubManagerConfig = {}) {
    this.proxyManager = new ProxyConfigManager();
    this.config = {
      timeout: 10,
      retryCount: 3,
      ...config
    };

    this.loadConfiguration();
  }

  /**
   * 加载配置（从统一配置管理器）
   */
  private loadConfiguration(): void {
    // 从统一配置管理器获取配置
    const configManager = getConfigManager();
    const proxyConfig = configManager.getProxyConfig();
    const githubConfig = configManager.getGitHubConfig();
    const networkConfig = configManager.getNetworkConfig();

    // 合并代理配置
    if (proxyConfig && proxyConfig.enabled !== false) {
      this.config.proxy = {
        http: proxyConfig.http,
        https: proxyConfig.https,
        noProxy: proxyConfig.noProxy
      };
    }

    // 合并 GitHub 配置
    if (githubConfig) {
      if (githubConfig.preferredMirrors) {
        this.config.preferredMirrors = githubConfig.preferredMirrors;
      }
      if (githubConfig.timeout) {
        this.config.timeout = githubConfig.timeout;
      }
      if (githubConfig.retryCount) {
        this.config.retryCount = githubConfig.retryCount;
      }
    }

    // 合并网络配置
    if (networkConfig) {
      if (networkConfig.timeout && !this.config.timeout) {
        this.config.timeout = networkConfig.timeout;
      }
      if (networkConfig.retryCount && !this.config.retryCount) {
        this.config.retryCount = networkConfig.retryCount;
      }
    }
  }

  /**
   * 测试镜像源可用性
   */
  private async testMirror(mirror: GitHubMirror): Promise<boolean> {
    try {
      let testUrl: string;

      // 根据不同镜像源选择合适的测试 URL
      switch (mirror.name) {
        case 'gitee':
          testUrl = `${mirror.baseUrl}/mirrors/oh-my-zsh.git`;
          break;
        case 'jsdelivr':
          testUrl = `${mirror.rawUrl}/ohmyzsh/ohmyzsh@master/README.md`;
          break;
        case 'fastgit':
          testUrl = `${mirror.rawUrl}/ohmyzsh/ohmyzsh/master/README.md`;
          break;
        default:
          testUrl = `${mirror.rawUrl}/ohmyzsh/ohmyzsh/master/README.md`;
      }

      const command = this.buildCurlCommand(testUrl, { timeout: this.config.timeout });
      await execBash(command);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 构建 curl 命令，包含代理设置
   */
  private buildCurlCommand(url: string, options: { timeout?: number } = {}): string {
    const parts = ['curl', '-fsSL'];

    // 添加超时设置
    if (options.timeout) {
      parts.push(`--connect-timeout ${options.timeout}`);
    }

    // 添加代理设置
    if (this.config.proxy?.https && url.startsWith('https://')) {
      parts.push(`--proxy "${this.config.proxy.https}"`);
    } else if (this.config.proxy?.http && url.startsWith('http://')) {
      parts.push(`--proxy "${this.config.proxy.http}"`);
    }

    parts.push(`"${url}"`);
    return parts.join(' ');
  }

  /**
   * 初始化可用的镜像源
   */
  public async initialize(): Promise<void> {
    logger.info("🔍 检测可用的 GitHub 镜像源...");

    // 获取排序后的镜像源列表
    const sortedMirrors = this.getSortedMirrors();

    // 测试每个镜像源的可用性
    for (const mirror of sortedMirrors) {
      logger.debug(`测试镜像源: ${mirror.name} (${mirror.description})`);

      if (await this.testMirror(mirror)) {
        this.availableMirrors.push(mirror);
        logger.debug(`✅ ${mirror.name} 可用`);

        // 设置第一个可用的镜像源为当前镜像源
        if (!this.currentMirror) {
          this.currentMirror = mirror;
          logger.info(`🎯 使用镜像源: ${mirror.name} (${mirror.description})`);
        }
      } else {
        logger.debug(`❌ ${mirror.name} 不可用`);
      }
    }

    if (this.availableMirrors.length === 0) {
      logger.warn("⚠️ 没有找到可用的 GitHub 镜像源");
    } else {
      logger.info(`✅ 找到 ${this.availableMirrors.length} 个可用镜像源`);
    }
  }

  /**
   * 获取排序后的镜像源列表（按优先级和用户偏好）
   */
  private getSortedMirrors(): GitHubMirror[] {
    const mirrors = [...GITHUB_MIRRORS];

    // 如果用户指定了首选镜像源，调整优先级
    if (this.config.preferredMirrors?.length) {
      mirrors.forEach(mirror => {
        const preferredIndex = this.config.preferredMirrors!.indexOf(mirror.name);
        if (preferredIndex !== -1) {
          // 将首选镜像源的优先级设置为负数，确保排在前面
          mirror.priority = -(this.config.preferredMirrors!.length - preferredIndex);
        }
      });
    }

    // 按优先级排序
    return mirrors.sort((a, b) => a.priority - b.priority);
  }

  /**
   * 获取 GitHub 仓库的克隆 URL
   */
  public getCloneUrl(owner: string, repo: string): string {
    if (!this.currentMirror) {
      throw new Error("没有可用的 GitHub 镜像源，请先调用 initialize()");
    }

    // 根据不同镜像源生成克隆 URL
    switch (this.currentMirror.name) {
      case 'gitee':
        return `${this.currentMirror.baseUrl}/mirrors/${repo}.git`;
      case 'jsdelivr':
        throw new Error("JSDelivr 不支持 git clone，请使用其他镜像源");
      default:
        return `${this.currentMirror.baseUrl}/${owner}/${repo}.git`;
    }
  }

  /**
   * 获取 GitHub raw 文件的 URL
   */
  public getRawUrl(owner: string, repo: string, branch: string, path: string): string {
    if (!this.currentMirror) {
      throw new Error("没有可用的 GitHub 镜像源，请先调用 initialize()");
    }

    // 根据不同镜像源生成 raw 文件 URL
    switch (this.currentMirror.name) {
      case 'gitee':
        return `${this.currentMirror.rawUrl}/mirrors/${repo}/raw/${branch}/${path}`;
      case 'jsdelivr':
        return `${this.currentMirror.rawUrl}/${owner}/${repo}@${branch}/${path}`;
      default:
        return `${this.currentMirror.rawUrl}/${owner}/${repo}/${branch}/${path}`;
    }
  }

  /**
   * 下载文件内容
   */
  public async downloadFile(owner: string, repo: string, branch: string, path: string): Promise<string> {
    const url = this.getRawUrl(owner, repo, branch, path);
    const command = this.buildCurlCommand(url, { timeout: this.config.timeout });

    let lastError: Error | undefined;

    // 尝试当前镜像源
    for (let i = 0; i < (this.config.retryCount || 1); i++) {
      try {
        return await execBash(command);
      } catch (error) {
        lastError = error as Error;
        logger.debug(`下载失败 (尝试 ${i + 1}/${this.config.retryCount}): ${error.message}`);
      }
    }

    // 如果当前镜像源失败，尝试其他可用镜像源
    for (const mirror of this.availableMirrors) {
      if (mirror === this.currentMirror) continue;

      try {
        logger.debug(`尝试备用镜像源: ${mirror.name}`);
        const backupUrl = mirror.name === 'gitee'
          ? `${mirror.rawUrl}/mirrors/${repo}/raw/${branch}/${path}`
          : `${mirror.rawUrl}/${owner}/${repo}/${branch}/${path}`;

        const backupCommand = this.buildCurlCommand(backupUrl, { timeout: this.config.timeout });
        return await execBash(backupCommand);
      } catch (error) {
        logger.debug(`备用镜像源 ${mirror.name} 也失败: ${error.message}`);
      }
    }

    throw lastError || new Error("所有镜像源都不可用");
  }

  /**
   * 克隆 GitHub 仓库
   */
  public async cloneRepository(owner: string, repo: string, targetDir: string, options: {
    branch?: string;
    depth?: number;
    user?: string; // 以指定用户身份执行
  } = {}): Promise<void> {
    const cloneUrl = this.getCloneUrl(owner, repo);
    const gitCommand = ['git', 'clone'];

    if (options.branch) {
      gitCommand.push('-b', options.branch);
    }

    if (options.depth) {
      gitCommand.push('--depth', options.depth.toString());
    }

    gitCommand.push(cloneUrl, targetDir);

    const command = options.user
      ? `sudo -u ${options.user} ${gitCommand.join(' ')}`
      : gitCommand.join(' ');

    let lastError: Error | undefined;

    // 尝试当前镜像源
    try {
      await execBash(command);
      return;
    } catch (error) {
      lastError = error as Error;
      logger.debug(`克隆失败，尝试备用镜像源: ${error.message}`);
    }

    // 尝试其他可用镜像源
    for (const mirror of this.availableMirrors) {
      if (mirror === this.currentMirror) continue;

      try {
        logger.debug(`尝试备用镜像源: ${mirror.name}`);
        const backupUrl = mirror.name === 'gitee'
          ? `${mirror.baseUrl}/mirrors/${repo}.git`
          : `${mirror.baseUrl}/${owner}/${repo}.git`;

        const backupGitCommand = [...gitCommand];
        backupGitCommand[backupGitCommand.length - 2] = backupUrl; // 替换 URL

        const backupCommand = options.user
          ? `sudo -u ${options.user} ${backupGitCommand.join(' ')}`
          : backupGitCommand.join(' ');

        await execBash(backupCommand);
        return;
      } catch (error) {
        logger.debug(`备用镜像源 ${mirror.name} 克隆失败: ${error.message}`);
      }
    }

    throw lastError || new Error("所有镜像源都无法克隆仓库");
  }

  /**
   * 获取当前使用的镜像源信息
   */
  public getCurrentMirror(): GitHubMirror | undefined {
    return this.currentMirror;
  }

  /**
   * 获取所有可用的镜像源
   */
  public getAvailableMirrors(): GitHubMirror[] {
    return [...this.availableMirrors];
  }

  /**
   * 手动切换到指定的镜像源
   */
  public switchToMirror(mirrorName: string): boolean {
    const mirror = this.availableMirrors.find(m => m.name === mirrorName);
    if (mirror) {
      this.currentMirror = mirror;
      logger.info(`🔄 切换到镜像源: ${mirror.name} (${mirror.description})`);
      return true;
    }
    return false;
  }
}

// 单例实例
let globalGitHubManager: GitHubManager | undefined;

/**
 * 获取全局 GitHub 管理器实例
 */
export function getGitHubManager(config?: GitHubManagerConfig): GitHubManager {
  if (!globalGitHubManager) {
    globalGitHubManager = new GitHubManager(config);
  }
  return globalGitHubManager;
}

/**
 * 便捷函数：获取 oh-my-zsh 克隆 URL
 */
export async function getOhMyZshCloneUrl(): Promise<string> {
  const manager = getGitHubManager();
  if (!manager.getCurrentMirror()) {
    await manager.initialize();
  }
  return manager.getCloneUrl('ohmyzsh', 'ohmyzsh');
}

/**
 * 便捷函数：获取 oh-my-zsh 安装脚本 URL
 */
export async function getOhMyZshInstallScriptUrl(): Promise<string> {
  const manager = getGitHubManager();
  if (!manager.getCurrentMirror()) {
    await manager.initialize();
  }
  return manager.getRawUrl('ohmyzsh', 'ohmyzsh', 'master', 'tools/install.sh');
}

/**
 * 便捷函数：下载 oh-my-zsh 安装脚本
 */
export async function downloadOhMyZshInstallScript(): Promise<string> {
  const manager = getGitHubManager();
  if (!manager.getCurrentMirror()) {
    await manager.initialize();
  }
  return manager.downloadFile('ohmyzsh', 'ohmyzsh', 'master', 'tools/install.sh');
}

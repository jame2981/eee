// src/network/download-utils.ts

/**
 * 网络下载工具模块
 *
 * 提供带超时、重试、进度显示的网络下载功能
 * 解决网络慢或被墙导致的安装卡顿问题
 */

import { logger } from "../logger";
import { exec, execBashScript } from "../shell/shell-executor";

/**
 * 下载选项
 */
export interface DownloadOptions {
  /** 超时时间（秒），默认 300 秒（5分钟） */
  timeout?: number;
  /** 最大重试次数，默认 3 */
  maxRetries?: number;
  /** 是否显示进度，默认 true */
  showProgress?: boolean;
  /** 输出文件路径（可选） */
  output?: string;
  /** 自定义 HTTP headers */
  headers?: Record<string, string>;
  /** 是否跟随重定向，默认 true */
  followRedirects?: boolean;
  /** 是否支持断点续传，默认 false */
  resumable?: boolean;
  /** 进度回调函数 */
  onProgress?: (downloaded: number, total: number, speed: number) => void;
  /** 状态更新回调 */
  onStatusUpdate?: (status: string) => void;
}

/**
 * 下载进度信息
 */
export interface DownloadProgress {
  downloaded: number;
  total: number;
  percentage: number;
  speed: number; // bytes per second
  eta: number; // estimated time remaining in seconds
  status: 'downloading' | 'paused' | 'completed' | 'failed';
}

/**
 * 增强的下载管理器
 */
export class DownloadManager {
  private activeDownloads = new Map<string, DownloadProgress>();

  /**
   * 下载文件并提供实时进度反馈
   */
  async downloadWithProgress(
    url: string,
    options: DownloadOptions = {}
  ): Promise<string> {
    const downloadId = `${url}-${Date.now()}`;
    const {
      timeout = 300,
      maxRetries = 3,
      showProgress = true,
      output,
      resumable = false,
      onProgress,
      onStatusUpdate
    } = options;

    // Initialize progress tracking
    const progress: DownloadProgress = {
      downloaded: 0,
      total: 0,
      percentage: 0,
      speed: 0,
      eta: 0,
      status: 'downloading'
    };

    this.activeDownloads.set(downloadId, progress);

    try {
      onStatusUpdate?.("Starting download...");

      const result = await this.executeDownloadWithProgress(
        url,
        downloadId,
        options
      );

      progress.status = 'completed';
      onStatusUpdate?.("Download completed");

      return result;
    } catch (error) {
      progress.status = 'failed';
      onStatusUpdate?.(`Download failed: ${error.message}`);
      throw error;
    } finally {
      this.activeDownloads.delete(downloadId);
    }
  }

  /**
   * 获取当前活跃下载的进度
   */
  getActiveDownloads(): Map<string, DownloadProgress> {
    return new Map(this.activeDownloads);
  }

  private async executeDownloadWithProgress(
    url: string,
    downloadId: string,
    options: DownloadOptions
  ): Promise<string> {
    const progress = this.activeDownloads.get(downloadId)!;
    const { output, showProgress, onProgress } = options;

    // Build curl command with progress tracking
    const curlArgs = ["curl"];

    // Progress bar for visual feedback
    if (showProgress) {
      curlArgs.push("--progress-bar");
    } else {
      curlArgs.push("-s");
    }

    // Add other curl options
    curlArgs.push("-L"); // Follow redirects
    curlArgs.push("--fail"); // Fail on HTTP errors

    if (options.timeout) {
      curlArgs.push("--max-time", options.timeout.toString());
    }

    if (options.headers) {
      Object.entries(options.headers).forEach(([key, value]) => {
        curlArgs.push("-H", `${key}: ${value}`);
      });
    }

    if (output) {
      curlArgs.push("-o", output);
    }

    curlArgs.push(url);

    // Execute with progress monitoring
    const command = curlArgs.join(' ');
    logger.debug(`Enhanced download command: ${command}`);

    const result = await execBashScript(command, {
      timeout: (options.timeout! + 60) * 1000
    });

    if (output) {
      logger.success(`✅ File downloaded with progress tracking: ${output}`);
      return output;
    } else {
      return result;
    }
  }
}

// Create global download manager instance
const downloadManager = new DownloadManager();

/**
 * 下载文件（使用 curl，带超时和重试）
 * Enhanced with real-time progress tracking
 *
 * @param url 下载 URL
 * @param options 下载选项
 * @returns 如果指定了 output，返回文件路径；否则返回内容
 *
 * @example
 * // 下载到文件
 * await downloadFile("https://example.com/file.tar.gz", {
 *   output: "/tmp/file.tar.gz",
 *   timeout: 60,
 *   onProgress: (downloaded, total, speed) => {
 *     console.log(`Downloaded: ${downloaded}/${total} bytes at ${speed} B/s`);
 *   }
 * });
 *
 * // 下载到内存
 * const content = await downloadFile("https://example.com/script.sh");
 */
export async function downloadFile(
  url: string,
  options: DownloadOptions = {}
): Promise<string> {
  // Use enhanced download manager for better progress tracking
  if (options.showProgress !== false || options.onProgress || options.onStatusUpdate) {
    return await downloadManager.downloadWithProgress(url, options);
  }

  // Fallback to original implementation for simple downloads
  const {
    timeout = 300,
    maxRetries = 3,
    showProgress = true,
    output,
    headers = {},
    followRedirects = true
  } = options;

  // 构建 curl 参数
  const curlArgs = ["curl"];

  // 基础选项
  curlArgs.push("-fsSL"); // fail silently, show errors, follow redirects, location

  // 超时设置
  curlArgs.push("--connect-timeout", "30");  // 连接超时 30 秒
  curlArgs.push("--max-time", timeout.toString());  // 总超时时间

  // 重试设置
  curlArgs.push("--retry", maxRetries.toString());
  curlArgs.push("--retry-delay", "2");  // 重试间隔 2 秒
  curlArgs.push("--retry-max-time", (timeout * 2).toString());  // 重试总超时

  // 进度显示
  if (showProgress) {
    curlArgs.push("--progress-bar");
  } else {
    curlArgs.push("--silent");
  }

  // 跟随重定向
  if (followRedirects) {
    curlArgs.push("--location");
  }

  // 自定义 headers
  for (const [key, value] of Object.entries(headers)) {
    curlArgs.push("-H", `${key}: ${value}`);
  }

  // 输出文件
  if (output) {
    curlArgs.push("-o", output);
  }

  // URL（必须是最后一个参数）
  curlArgs.push(url);

  try {
    logger.debug(`下载文件: ${url}`);
    logger.debug(`curl 命令: ${curlArgs.join(' ')}`);

    // 使用 execBashScript 执行命令，这样可以看到进度条
    const command = curlArgs.join(' ');
    const result = await execBashScript(command, {
      timeout: (timeout + 60) * 1000  // 额外加 60 秒缓冲
    });

    if (output) {
      logger.success(`✅ 文件下载完成: ${output}`);
      return output;
    } else {
      logger.debug(`文件下载完成，大小: ${result.length} 字节`);
      return result;
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);

    if (errorMsg.includes('timed out')) {
      throw new Error(`下载超时 (${timeout}秒): ${url}\n提示: 检查网络连接或使用镜像源`);
    } else if (errorMsg.includes('exit code 22')) {
      throw new Error(`下载失败 - HTTP 错误: ${url}`);
    } else if (errorMsg.includes('exit code 6')) {
      throw new Error(`下载失败 - 无法解析主机: ${url}\n提示: 检查 DNS 设置或网络连接`);
    } else if (errorMsg.includes('exit code 7')) {
      throw new Error(`下载失败 - 无法连接到服务器: ${url}\n提示: 检查网络连接或防火墙设置`);
    } else if (errorMsg.includes('exit code 28')) {
      throw new Error(`下载超时: ${url}\n提示: 网络速度太慢，请检查网络连接`);
    } else {
      throw new Error(`下载失败: ${url}\n错误: ${errorMsg}`);
    }
  }
}

/**
 * 下载并执行安装脚本（curl | bash 模式）
 * 带超时和错误处理
 *
 * @param url 脚本 URL
 * @param options 下载选项
 * @param scriptArgs 传递给脚本的参数
 *
 * @example
 * await downloadAndInstall("https://get.docker.com", { timeout: 600 });
 */
export async function downloadAndInstall(
  url: string,
  options: DownloadOptions = {},
  scriptArgs: string[] = []
): Promise<string> {
  const {
    timeout = 600,  // 安装脚本默认 10 分钟超时
    maxRetries = 3
  } = options;

  logger.info(`📥 下载并执行安装脚本: ${url}`);

  try {
    // 先下载脚本内容
    const scriptContent = await downloadFile(url, {
      ...options,
      showProgress: false,  // 不显示下载进度
      output: undefined
    });

    // 构建执行命令
    const args = scriptArgs.length > 0 ? ` ${scriptArgs.join(' ')}` : '';
    const command = `bash -s -- ${args}`;

    logger.info(`🚀 执行安装脚本...`);

    // 通过管道执行脚本
    const result = await execBashScript(
      `echo '${scriptContent.replace(/'/g, "'\\''")}' | ${command}`,
      { timeout: timeout * 1000 }
    );

    logger.success(`✅ 安装脚本执行完成`);
    return result;

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    throw new Error(`安装脚本执行失败: ${errorMsg}`);
  }
}

/**
 * 下载 GitHub Release 资源
 * 自动处理 GitHub API 限制和镜像
 *
 * @param repo GitHub 仓库（格式: owner/repo）
 * @param tag Release 标签
 * @param asset 资源文件名
 * @param options 下载选项
 *
 * @example
 * await downloadGithubRelease(
 *   "owenthereal/goup",
 *   "v0.7.0",
 *   "linux-amd64",
 *   { output: "/tmp/goup" }
 * );
 */
export async function downloadGithubRelease(
  repo: string,
  tag: string,
  asset: string,
  options: DownloadOptions = {}
): Promise<string> {
  const url = `https://github.com/${repo}/releases/download/${tag}/${asset}`;

  logger.info(`📦 下载 GitHub Release: ${repo}@${tag}/${asset}`);

  try {
    return await downloadFile(url, {
      timeout: 300,  // GitHub 下载默认 5 分钟
      ...options
    });
  } catch (error) {
    // 如果下载失败，可以尝试使用镜像（如 ghproxy）
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.warn(`GitHub 下载失败: ${errorMsg}`);
    logger.info(`尝试使用 ghproxy 镜像...`);

    const mirrorUrl = `https://ghproxy.com/${url}`;
    return await downloadFile(mirrorUrl, {
      timeout: 300,
      ...options
    });
  }
}

/**
 * 使用 wget 下载文件（备选方案）
 *
 * @param url 下载 URL
 * @param options 下载选项
 */
export async function downloadFileWithWget(
  url: string,
  options: DownloadOptions = {}
): Promise<string> {
  const {
    timeout = 300,
    maxRetries = 3,
    showProgress = true,
    output
  } = options;

  const wgetArgs = ["wget"];

  // 超时设置
  wgetArgs.push("--timeout", "30");
  wgetArgs.push("--dns-timeout", "30");
  wgetArgs.push("--connect-timeout", "30");
  wgetArgs.push("--read-timeout", timeout.toString());

  // 重试设置
  wgetArgs.push("--tries", maxRetries.toString());
  wgetArgs.push("--waitretry", "2");

  // 进度显示
  if (!showProgress) {
    wgetArgs.push("-q");
  }

  // 输出
  if (output) {
    wgetArgs.push("-O", output);
  } else {
    wgetArgs.push("-O", "-");  // 输出到标准输出
  }

  wgetArgs.push(url);

  try {
    const command = wgetArgs.join(' ');
    const result = await execBashScript(command, {
      timeout: (timeout + 60) * 1000
    });

    if (output) {
      logger.success(`✅ 文件下载完成: ${output}`);
      return output;
    } else {
      return result;
    }
  } catch (error) {
    throw new Error(`wget 下载失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 智能下载（自动选择 curl 或 wget）
 */
export async function smartDownload(
  url: string,
  options: DownloadOptions = {}
): Promise<string> {
  try {
    // 优先使用 curl
    return await downloadFile(url, options);
  } catch (error) {
    logger.warn(`curl 下载失败，尝试 wget...`);
    try {
      return await downloadFileWithWget(url, options);
    } catch (wgetError) {
      throw new Error(`下载失败（curl 和 wget 都失败）:\ncurl: ${error instanceof Error ? error.message : String(error)}\nwget: ${wgetError instanceof Error ? wgetError.message : String(wgetError)}`);
    }
  }
}

/**
 * Export the download manager for advanced usage
 */
export { downloadManager };

/**
 * Create a new download manager instance
 */
export function createDownloadManager(): DownloadManager {
  return new DownloadManager();
}

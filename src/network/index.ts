/**
 * src/network/index.ts
 * 
 * 网络相关模块的统一导出
 */

// GitHub 管理器
export {
  GitHubManager,
  getGitHubManager,
  getOhMyZshCloneUrl,
  getOhMyZshInstallScriptUrl,
  downloadOhMyZshInstallScript,
  type GitHubMirror,
  type GitHubManagerConfig
} from './github-manager';

// 代理配置管理
export {
  ProxyConfigManager,
  type ProxySettings,
  type EeeNetworkConfig
} from './proxy-config';

// 下载工具
export * from './download-utils';

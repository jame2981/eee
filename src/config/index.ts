/**
 * src/config/index.ts
 * 
 * 配置系统统一导出和初始化
 */

import { getConfigManager } from './env-config';
import { logger } from '../logger';

// 自动初始化配置
const configManager = getConfigManager();

// 验证配置
const validation = configManager.validate();
if (!validation.valid) {
  logger.warn('⚠️ 配置验证发现问题:');
  validation.errors.forEach(error => {
    logger.warn(`  - ${error}`);
  });
  logger.info('💡 请检查您的 .env 文件或环境变量配置');
}

// 显示配置摘要（仅在调试模式下）
if (process.env.EEE_DEBUG === 'true') {
  logger.debug(`配置摘要: ${configManager.getConfigSummary()}`);
}

// 导出所有配置相关功能
export {
  EnvConfigManager,
  getConfigManager,
  getConfig,
  getProxyConfig,
  getGitHubConfig,
  type EeeConfig
} from './env-config';

// 便捷的配置访问
export const config = configManager.getConfig();
export const proxyConfig = configManager.getProxyConfig();
export const githubConfig = configManager.getGitHubConfig();
export const loggingConfig = configManager.getLoggingConfig();
export const installConfig = configManager.getInstallConfig();
export const networkConfig = configManager.getNetworkConfig();

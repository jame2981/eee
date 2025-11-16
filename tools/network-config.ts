#!/usr/bin/env bun

/**
 * tools/network-config.ts
 * 
 * 网络配置管理 CLI 工具
 */

import { ProxyConfigManager, getGitHubManager } from "../src/network";
import { logger } from "../src/logger";
import { getConfigManager } from "../src/config/env-config";

interface CliArgs {
  command: string;
  args: string[];
}

function parseArgs(argv: string[]): CliArgs {
  const [command, ...args] = argv.slice(2);
  return { command: command || 'help', args };
}

function showHelp(): void {
  console.log(`
EEE 网络配置管理工具

用法: bun tools/network-config.ts <命令> [选项]

命令:
  help                    显示帮助信息
  status                  显示当前网络配置状态
  test                    测试网络连接和镜像源
  proxy <action>          代理管理
    set <http> [https]    设置代理
    unset                 清除代理
    status                显示代理状态
  mirror <action>         镜像源管理
    list                  列出所有镜像源
    test                  测试镜像源可用性
    switch <name>         切换到指定镜像源
  config <action>         配置管理
    show                  显示当前配置
    export                导出配置为环境变量
    init                  初始化 .env 配置文件
    reload                重新加载配置
    validate              验证配置有效性

示例:
  bun tools/network-config.ts status
  bun tools/network-config.ts config init
  bun tools/network-config.ts proxy set http://proxy.example.com:8080
  bun tools/network-config.ts mirror test
  bun tools/network-config.ts mirror switch gitee
  bun tools/network-config.ts config export > my-env.sh
`);
}

async function showStatus(): Promise<void> {
  logger.info("📊 网络配置状态");

  const configManager = getConfigManager();
  const githubManager = getGitHubManager();

  // 显示配置文件信息
  logger.info("📁 配置来源:");
  logger.info("  - .env 文件");
  logger.info("  - 环境变量");
  logger.info("  - 配置文件");

  // 显示代理配置
  const proxyConfig = configManager.getProxyConfig();
  if (proxyConfig && proxyConfig.enabled !== false) {
    logger.info("🌐 代理配置:");
    if (proxyConfig.http) logger.info(`  HTTP: ${proxyConfig.http}`);
    if (proxyConfig.https) logger.info(`  HTTPS: ${proxyConfig.https}`);
    if (proxyConfig.ftp) logger.info(`  FTP: ${proxyConfig.ftp}`);
    if (proxyConfig.noProxy?.length) {
      logger.info(`  NO_PROXY: ${proxyConfig.noProxy.join(', ')}`);
    }
    logger.info(`  状态: ${proxyConfig.enabled !== false ? '启用' : '禁用'}`);
  } else {
    logger.info("🌐 代理: 未配置或已禁用");
  }

  // 显示 GitHub 配置
  const githubConfig = configManager.getGitHubConfig();
  if (githubConfig) {
    logger.info("🐙 GitHub 配置:");
    if (githubConfig.preferredMirrors?.length) {
      logger.info(`  首选镜像源: ${githubConfig.preferredMirrors.join(', ')}`);
    }
    if (githubConfig.timeout) {
      logger.info(`  超时时间: ${githubConfig.timeout}s`);
    }
    if (githubConfig.retryCount) {
      logger.info(`  重试次数: ${githubConfig.retryCount}`);
    }
  }

  // 显示其他配置
  const installConfig = configManager.getInstallConfig();
  if (installConfig) {
    logger.info("⚙️ 安装配置:");
    logger.info(`  容器模式: ${installConfig.containerMode ? '启用' : '禁用'}`);
    logger.info(`  跳过 Docker 服务: ${installConfig.skipDockerService ? '是' : '否'}`);
    logger.info(`  默认 Shell: ${installConfig.defaultShell || 'zsh'}`);
  }

  // 显示当前镜像源
  try {
    await githubManager.initialize();
    const currentMirror = githubManager.getCurrentMirror();
    if (currentMirror) {
      logger.info(`🎯 当前镜像源: ${currentMirror.name} (${currentMirror.description})`);
    }
  } catch (error) {
    logger.warn("⚠️ 无法初始化 GitHub 管理器");
  }
}

async function testNetwork(): Promise<void> {
  logger.info("🧪 测试网络连接和镜像源...");
  
  const githubManager = getGitHubManager();
  await githubManager.initialize();
  
  const availableMirrors = githubManager.getAvailableMirrors();
  logger.info(`✅ 找到 ${availableMirrors.length} 个可用镜像源:`);
  
  availableMirrors.forEach(mirror => {
    logger.info(`  - ${mirror.name}: ${mirror.description}`);
  });
}

async function manageProxy(action: string, args: string[]): Promise<void> {
  const proxyManager = new ProxyConfigManager();
  
  switch (action) {
    case 'set':
      if (args.length < 1) {
        logger.error("❌ 请提供代理地址");
        return;
      }
      const httpProxy = args[0];
      const httpsProxy = args[1] || httpProxy;
      
      proxyManager.setProxyConfig({
        enabled: true,
        http: httpProxy,
        https: httpsProxy
      });
      proxyManager.saveConfig();
      logger.success(`✅ 代理已设置: HTTP=${httpProxy}, HTTPS=${httpsProxy}`);
      break;
      
    case 'unset':
      proxyManager.setProxyConfig({ enabled: false });
      proxyManager.saveConfig();
      logger.success("✅ 代理已禁用");
      break;
      
    case 'status':
      const proxyConfig = proxyManager.getProxyConfig();
      if (proxyConfig && proxyManager.isProxyEnabled()) {
        logger.info("🌐 代理状态: 已启用");
        if (proxyConfig.http) logger.info(`  HTTP: ${proxyConfig.http}`);
        if (proxyConfig.https) logger.info(`  HTTPS: ${proxyConfig.https}`);
      } else {
        logger.info("🌐 代理状态: 未配置或已禁用");
      }
      break;
      
    default:
      logger.error(`❌ 未知的代理操作: ${action}`);
  }
}

async function manageMirror(action: string, args: string[]): Promise<void> {
  const githubManager = getGitHubManager();
  
  switch (action) {
    case 'list':
      await githubManager.initialize();
      const allMirrors = githubManager.getAvailableMirrors();
      const currentMirror = githubManager.getCurrentMirror();
      
      logger.info("🔍 可用镜像源:");
      allMirrors.forEach(mirror => {
        const current = mirror === currentMirror ? " (当前)" : "";
        logger.info(`  - ${mirror.name}: ${mirror.description}${current}`);
      });
      break;
      
    case 'test':
      await testNetwork();
      break;
      
    case 'switch':
      if (args.length < 1) {
        logger.error("❌ 请提供镜像源名称");
        return;
      }
      await githubManager.initialize();
      const success = githubManager.switchToMirror(args[0]);
      if (success) {
        logger.success(`✅ 已切换到镜像源: ${args[0]}`);
      } else {
        logger.error(`❌ 镜像源不可用: ${args[0]}`);
      }
      break;
      
    default:
      logger.error(`❌ 未知的镜像源操作: ${action}`);
  }
}

async function manageConfig(action: string, args: string[] = []): Promise<void> {
  const configManager = getConfigManager();

  switch (action) {
    case 'show':
      const config = configManager.getConfig();
      logger.info("📋 当前配置:");
      console.log(JSON.stringify(config, null, 2));
      break;

    case 'export':
      const proxyConfig = configManager.getProxyConfig();
      const githubConfig = configManager.getGitHubConfig();
      const installConfig = configManager.getInstallConfig();
      const networkConfig = configManager.getNetworkConfig();

      logger.info("📤 环境变量配置:");

      // 代理配置
      if (proxyConfig?.enabled !== false) {
        console.log(`export EEE_PROXY_ENABLED="${proxyConfig?.enabled !== false}"`);
      }
      if (proxyConfig?.http) {
        console.log(`export HTTP_PROXY="${proxyConfig.http}"`);
      }
      if (proxyConfig?.https) {
        console.log(`export HTTPS_PROXY="${proxyConfig.https}"`);
      }
      if (proxyConfig?.ftp) {
        console.log(`export FTP_PROXY="${proxyConfig.ftp}"`);
      }
      if (proxyConfig?.noProxy?.length) {
        console.log(`export NO_PROXY="${proxyConfig.noProxy.join(',')}"`);
      }

      // GitHub 配置
      if (githubConfig?.preferredMirrors?.length) {
        console.log(`export EEE_GITHUB_MIRROR="${githubConfig.preferredMirrors.join(',')}"`);
      }
      if (githubConfig?.timeout) {
        console.log(`export EEE_GITHUB_TIMEOUT="${githubConfig.timeout}"`);
      }
      if (githubConfig?.retryCount) {
        console.log(`export EEE_GITHUB_RETRY="${githubConfig.retryCount}"`);
      }

      // 安装配置
      if (installConfig?.containerMode) {
        console.log(`export EEE_CONTAINER_MODE="${installConfig.containerMode}"`);
      }
      if (installConfig?.skipDockerService) {
        console.log(`export EEE_SKIP_DOCKER_SERVICE="${installConfig.skipDockerService}"`);
      }
      if (installConfig?.defaultShell) {
        console.log(`export EEE_DEFAULT_SHELL="${installConfig.defaultShell}"`);
      }

      // 网络配置
      if (networkConfig?.timeout) {
        console.log(`export EEE_NETWORK_TIMEOUT="${networkConfig.timeout}"`);
      }
      if (networkConfig?.retryCount) {
        console.log(`export EEE_NETWORK_RETRY="${networkConfig.retryCount}"`);
      }
      break;

    case 'init':
      logger.info("🔧 初始化配置文件...");
      const fs = require('fs');
      const path = require('path');

      const envExamplePath = path.join(process.cwd(), '.env.example');
      const envPath = path.join(process.cwd(), '.env');

      if (fs.existsSync(envPath)) {
        logger.warn("⚠️ .env 文件已存在");
        return;
      }

      if (fs.existsSync(envExamplePath)) {
        fs.copyFileSync(envExamplePath, envPath);
        logger.success("✅ 已从 .env.example 创建 .env 文件");
        logger.info("💡 请编辑 .env 文件以配置您的环境");
      } else {
        logger.error("❌ 找不到 .env.example 文件");
      }
      break;

    case 'reload':
      logger.info("🔄 重新加载配置...");
      configManager.reload();
      logger.success("✅ 配置已重新加载");
      break;

    case 'validate':
      logger.info("🔍 验证配置...");
      const validation = configManager.validate();
      if (validation.valid) {
        logger.success("✅ 配置验证通过");
        logger.info(`📋 配置摘要: ${configManager.getConfigSummary()}`);
      } else {
        logger.error("❌ 配置验证失败:");
        validation.errors.forEach(error => {
          logger.error(`  - ${error}`);
        });
        process.exit(1);
      }
      break;

    default:
      logger.error(`❌ 未知的配置操作: ${action}`);
  }
}

async function main(): Promise<void> {
  const { command, args } = parseArgs(process.argv);
  
  try {
    switch (command) {
      case 'help':
        showHelp();
        break;
      case 'status':
        await showStatus();
        break;
      case 'test':
        await testNetwork();
        break;
      case 'proxy':
        await manageProxy(args[0], args.slice(1));
        break;
      case 'mirror':
        await manageMirror(args[0], args.slice(1));
        break;
      case 'config':
        await manageConfig(args[0]);
        break;
      default:
        logger.error(`❌ 未知命令: ${command}`);
        showHelp();
        process.exit(1);
    }
  } catch (error) {
    logger.error(`❌ 执行失败: ${error.message}`);
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}

#!/usr/bin/env bun

/**
 * pkg-utils.ts
 *
 * 软件包安装工具集
 * 提供统一的工具函数，简化 pre_install.ts/install.ts/post_install.ts 的逻辑
 *
 * TODO: 此文件正在逐步模块化拆分中
 * - ✅ 用户环境管理 -> src/user/user-env.ts
 * - ⏳ 脚本执行 -> src/shell/script-executor.ts (待迁移)
 * - ⏳ 系统信息 -> src/system/system-info.ts (待迁移)
 * - ⏳ 包管理 -> src/package/*.ts (待迁移)
 */

import { logger } from "./logger";
import { execCommand, execBash } from "./shell/shell-executor";

// 导入用户环境管理函数（内部使用）
import {
  type UserEnv,
  getUserEnv as _internalGetUserEnv,
  getCurrentUser as _internalGetCurrentUser,
  getUserPrimaryGroup as _internalGetUserPrimaryGroup,
  getUserHome as _internalGetUserHome,
  isRoot as _internalIsRoot,
  requireRoot as _internalRequireRoot,
  addUserToGroup as _internalAddUserToGroup,
} from "./user/user-env";

// 导入脚本执行函数（内部使用）
import {
  runAsUser as _internalRunAsUser,
  runAsUserScript as _internalRunAsUserScript,
  runAsRootScript as _internalRunAsRootScript,
  runAsUserWithEnv as _internalRunAsUserWithEnv,
} from "./shell/script-executor";

// 导入系统信息函数（内部使用）
import {
  type SystemInfo,
  detectOS as _internalDetectOS,
  detectDistro as _internalDetectDistro,
  detectArch as _internalDetectArch,
  detectPackageManager as _internalDetectPackageManager,
  getSystemInfo as _internalGetSystemInfo,
  checkSystemCompatibility as _internalCheckSystemCompatibility,
  isDebianBased as _internalIsDebianBased,
  isWSL as _internalIsWSL,
  checkNetworkConnection as _internalCheckNetworkConnection,
  verifyCommand as _internalVerifyCommand,
  getCommandVersion as _internalGetCommandVersion,
} from "./system/system-info";

// 导入包管理函数（内部使用）
import {
  _aptUpdate,
  aptUpdate as _internalAptUpdate,
  aptInstall as _internalAptInstall,
  aptRemove as _internalAptRemove,
  addPpa as _internalAddPpa,
  addGpgKey as _internalAddGpgKey,
  addRepository as _internalAddRepository,
  isPackageInstalled as _internalIsPackageInstalled,
} from "./package/apt";

// ========== 模块化重导出 ==========
// 用户环境管理（重新导出）
export {
  type UserEnv,
  _internalGetUserEnv as getUserEnv,
  _internalGetCurrentUser as getCurrentUser,
  _internalGetUserPrimaryGroup as getUserPrimaryGroup,
  _internalGetUserHome as getUserHome,
  _internalIsRoot as isRoot,
  _internalRequireRoot as requireRoot,
  _internalAddUserToGroup as addUserToGroup,
};

// 脚本执行（重新导出）
export {
  _internalRunAsUser as runAsUser,
  _internalRunAsUserScript as runAsUserScript,
  _internalRunAsRootScript as runAsRootScript,
  _internalRunAsUserWithEnv as runAsUserWithEnv,
};

// 系统信息（重新导出）
export {
  type SystemInfo,
  _internalDetectOS as detectOS,
  _internalDetectDistro as detectDistro,
  _internalDetectArch as detectArch,
  _internalDetectPackageManager as detectPackageManager,
  _internalGetSystemInfo as getSystemInfo,
  _internalCheckSystemCompatibility as checkSystemCompatibility,
  _internalIsDebianBased as isDebianBased,
  _internalIsWSL as isWSL,
  _internalCheckNetworkConnection as checkNetworkConnection,
  _internalVerifyCommand as verifyCommand,
  _internalGetCommandVersion as getCommandVersion,
};

// 包管理（重新导出）
export {
  _aptUpdate,
  _internalAptUpdate as aptUpdate,
  _internalAptInstall as aptInstall,
  _internalAptRemove as aptRemove,
  _internalAddPpa as addPpa,
  _internalAddGpgKey as addGpgKey,
  _internalAddRepository as addRepository,
  _internalIsPackageInstalled as isPackageInstalled,
};

// ========== APT 环境配置 ==========

/**
 * APT 统一环境变量配置
 * - APT_LISTCHANGES_FRONTEND=none: 禁用 apt-get 命令警告
 * - DEBIAN_FRONTEND=noninteractive: 非交互式安装
 */
const APT_ENV = {
  APT_LISTCHANGES_FRONTEND: "none",
  DEBIAN_FRONTEND: "noninteractive"
};

// ==========  1. 用户环境管理  ==========
// 已迁移到 src/user/user-env.ts，通过上面的 export 重导出

/**
 * 重新加载环境变量
 * 用于软件安装后刷新PATH和其他环境变量
 */
export async function reloadEnv(user?: string): Promise<void> {
  const targetUser = user || _internalGetCurrentUser();
  const userHome = _internalGetUserHome(targetUser);

  logger.info("==> 重新加载环境变量...");

  try {
    // 构建环境变量重新加载脚本
    const reloadScript = `
      # 重新加载系统和用户的环境配置
      echo "==> 调试: 开始重新加载环境变量"

      # 1. 重新加载系统级环境
      if [ -f /etc/environment ]; then
        echo "==> 调试: 重新加载 /etc/environment"
        set -a && source /etc/environment && set +a
      fi

      # 2. 重新加载系统级 profile
      if [ -f /etc/profile ]; then
        echo "==> 调试: 重新加载 /etc/profile"
        source /etc/profile
      fi

      # 3. 重新加载用户级配置文件
      if [ -f "${userHome}/.bashrc" ]; then
        echo "==> 调试: 重新加载 ~/.bashrc"
        source "${userHome}/.bashrc"
      fi

      if [ -f "${userHome}/.bash_profile" ]; then
        echo "==> 调试: 重新加载 ~/.bash_profile"
        source "${userHome}/.bash_profile"
      fi

      if [ -f "${userHome}/.profile" ]; then
        echo "==> 调试: 重新加载 ~/.profile"
        source "${userHome}/.profile"
      fi

      # 4. 重新加载 zsh 配置 (如果存在)
      if [ -f "${userHome}/.zshrc" ]; then
        echo "==> 调试: 重新加载 ~/.zshrc"
        source "${userHome}/.zshrc"
      fi

      # 5. 显示当前 PATH
      echo "==> 调试: 当前PATH: $PATH"

      # 6. 验证常见命令路径
      for cmd in node npm nvm docker; do
        if which "$cmd" >/dev/null 2>&1; then
          echo "==> 调试: $cmd 路径: $(which $cmd)"
        else
          echo "==> 调试: $cmd 命令未找到"
        fi
      done

      echo "==> 调试: 环境变量重新加载完成"
    `;

    // 执行重新加载脚本
    const result = await _internalRunAsUserScript(reloadScript, targetUser);

    logger.info("==> 环境变量重新加载结果:");
    result.split('\n').forEach(line => {
      if (line.trim()) {
        logger.info(`    ${line.trim()}`);
      }
    });

    logger.success("✅ 环境变量重新加载完成");

  } catch (error) {
    logger.warn(`⚠️  环境变量重新加载失败: ${error.message}`);
    logger.info("💡 提示: 某些环境变量可能需要重新登录或重启shell才能生效");
  }
}

// ========== 2. 系统包管理 ==========
// 已迁移到 src/package/apt.ts，通过上面的 export 重导出

// ========== 3. 用户命令执行 ==========
// 已迁移到 src/shell/script-executor.ts，通过上面的 export 重导出

// ========== 4. 文件系统操作 ==========

/**
 * 创建用户文件
 */
export async function writeUserFile(path: string, content: string, user?: string): Promise<void> {
  const targetUser = user || _internalGetCurrentUser();

  await Bun.write(path, content);
  await setUserOwnership(path, targetUser);

  logger.info(`==> 创建用户文件: ${path}`);
}

/**
 * 创建用户目录
 */
export async function createUserDir(path: string, user?: string, mode = "755"): Promise<void> {
  const targetUser = user || _internalGetCurrentUser();

  await execCommand("mkdir", ["-p", path]);
  await execCommand("chmod", [mode, path]);
  await setUserOwnership(path, targetUser);

  logger.info(`==> 创建用户目录: ${path}`);
}

/**
 * 设置文件/目录所有权
 */
export async function setUserOwnership(path: string, user?: string): Promise<void> {
  const targetUser = user || _internalGetCurrentUser();

  if (targetUser !== "root") {
    // 获取用户的主组名，而不是假设用户名等于组名
    const primaryGroup = await _internalGetUserPrimaryGroup(targetUser);
    await execCommand("chown", ["-R", `${targetUser}:${primaryGroup}`, path]);
    logger.info(`==> 设置文件所有权: ${path} -> ${targetUser}:${primaryGroup}`);
  }
}

/**
 * 复制文件到用户主目录
 */
export async function copyToUserHome(src: string, dest: string, user?: string): Promise<void> {
  const targetUser = user || _internalGetCurrentUser();
  const userHome = _internalGetUserHome(targetUser);
  const destPath = `${userHome}/${dest}`;

  await execCommand("cp", [src, destPath]);
  await setUserOwnership(destPath, targetUser);

  logger.info(`==> 复制文件: ${src} -> ${destPath}`);
}

// ========== 5. 系统服务管理 ==========

/**
 * 启用系统服务
 */
export async function enableService(service: string): Promise<void> {
  logger.info(`==> 启用服务: ${service}`);

  const enableScript = `set -e

# 检查 systemd 可用性并启用服务（容器内降级处理）
if command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ] && [ "$(cat /proc/1/comm)" = "systemd" ]; then
  systemctl enable ${service}
else
  echo "systemd not available in this environment; skip enabling ${service}"
fi`;

  await _internalRunAsRootScript(enableScript);
}

/**
 * 启动系统服务
 */
export async function startService(service: string): Promise<void> {
  logger.info(`==> 启动服务: ${service}`);

  const startScript = `set -e

# 检查 systemd 可用性并启动服务（容器内降级处理）
if command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ] && [ "$(cat /proc/1/comm)" = "systemd" ]; then
  systemctl start ${service}
else
  echo "systemd not available in this environment; skip starting ${service}"
fi`;

  await _internalRunAsRootScript(startScript);
}

/**
 * 重启系统服务
 */
export async function restartService(service: string): Promise<void> {
  logger.info(`==> 重启服务: ${service}`);

  const restartScript = `set -e

# 检查 systemd 可用性并重启服务（容器内降级处理）
if command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ] && [ "$(cat /proc/1/comm)" = "systemd" ]; then
  systemctl restart ${service}
else
  echo "systemd not available in this environment; skip restarting ${service}"
fi`;

  await _internalRunAsRootScript(restartScript);
}

// addUserToGroup 已迁移到 src/user/user-env.ts

// ========== 6. 创建系统链接 ==========

/**
 * 创建符号链接
 */
export async function createSymlink(src: string, dest: string): Promise<void> {
  logger.info(`==> 创建符号链接: ${src} -> ${dest}`);

  const symlinkScript = `set -e

# 创建符号链接
ln -sf ${src} ${dest}`;

  await _internalRunAsRootScript(symlinkScript);
}

/**
 * 创建二进制文件的系统链接
 */
export async function createBinSymlink(binPath: string, binName: string): Promise<void> {
  const destPath = `/usr/local/bin/${binName}`;
  await createSymlink(binPath, destPath);
}

// ========== 7. 安装验证 ==========
// verifyCommand、getCommandVersion 已迁移到 src/system/system-info.ts

/**
 * 测试用户环境下的命令
 */
export async function testUserCommand(command: string, user?: string): Promise<boolean> {
  try {
    await _internalRunAsUser(`which ${command}`, user);
    return true;
  } catch {
    return false;
  }
}

// ========== 8. 配置文件模板 ==========

export interface ConfigTemplate {
  aliases?: Record<string, string>;
  functions?: Record<string, string>;
  environment?: Record<string, string>;
  files?: Record<string, string>;
}

/**
 * 写入配置模板文件
 */
export async function writeConfigTemplate(
  template: ConfigTemplate,
  prefix: string,
  user?: string
): Promise<void> {
  const targetUser = user || _internalGetCurrentUser();
  const userHome = _internalGetUserHome(targetUser);

  // 写入别名文件
  if (template.aliases) {
    const aliasContent = Object.entries(template.aliases)
      .map(([key, value]) => `alias ${key}='${value}'`)
      .join('\n') + '\n';

    await writeUserFile(`${userHome}/.${prefix}_aliases`, aliasContent, targetUser);
  }

  // 写入函数文件
  if (template.functions) {
    const functionContent = Object.entries(template.functions)
      .map(([key, value]) => `${key}() {\n${value}\n}`)
      .join('\n\n') + '\n';

    await writeUserFile(`${userHome}/.${prefix}_functions`, functionContent, targetUser);
  }

  // 写入环境变量文件
  if (template.environment) {
    const envContent = Object.entries(template.environment)
      .map(([key, value]) => `export ${key}="${value}"`)
      .join('\n') + '\n';

    await writeUserFile(`${userHome}/.${prefix}_env`, envContent, targetUser);
  }

  // 写入自定义文件
  if (template.files) {
    for (const [filename, content] of Object.entries(template.files)) {
      const filePath = filename.startsWith('/') ? filename : `${userHome}/${filename}`;
      await writeUserFile(filePath, content, targetUser);
    }
  }

  logger.success(`==> 配置文件写入完成: ${prefix}`);
}

// ========== 9. 下载和安装 ==========

/**
 * 下载文件
 */
export async function downloadFile(url: string, dest?: string): Promise<string> {
  if (dest) {
    logger.info(`==> 下载文件: ${url} -> ${dest}`);
    await execCommand("curl", ["-fsSL", url, "-o", dest]);
    return dest;
  } else {
    return await execCommand("curl", ["-fsSL", url]);
  }
}

/**
 * 下载并执行脚本
 */
export async function downloadAndRunScript(url: string, user?: string): Promise<string> {
  logger.info(`==> 下载并执行脚本: ${url}`);

  const script = await downloadFile(url);
  return await _internalRunAsUserScript(script, user);
}

/**
 * 使用 curl 安装（常见的安装模式）
 */
export async function curlInstall(url: string, user?: string): Promise<void> {
  const targetUser = user || _internalGetCurrentUser();

  logger.info(`==> Curl 安装: ${url}`);

  if (targetUser === "root") {
    await execBash(`curl -fsSL ${url} | bash`);
  } else {
    await execBash(`sudo -u ${targetUser} bash -c "curl -fsSL ${url} | bash"`);
  }
}

// ========== 10. 实用工具 ==========
// isRoot 和 requireRoot 已迁移到 src/user/user-env.ts

/**
 * 安全地执行可能失败的操作
 */
export async function tryExecute<T>(
  operation: () => Promise<T>,
  fallback?: () => Promise<T>,
  errorMessage?: string
): Promise<T | void> {
  try {
    return await operation();
  } catch (error) {
    if (errorMessage) {
      logger.warn(`${errorMessage}: ${error.message}`);
    }

    if (fallback) {
      logger.info("==> 尝试备选方案...");
      return await fallback();
    }
  }
}

// ========== 11. 系统检测功能 ==========
// 已迁移到 src/system/system-info.ts，通过上面的 export 重导出

// ========== 12. 包安装统一接口 ==========

export interface PackageInfo {
  name: string;
  installed: boolean;
  version?: string;
  installMethod: "apt" | "src" | "skip";
}

/**
 * 检查软件包是否已安装
 */
export async function checkPackageInstalled(checkCommand: string): Promise<{ installed: boolean; version?: string }> {
  try {
    // 使用 runAsRootScript 来执行检查命令，确保有足够权限访问 dpkg 数据库
    const output = await _internalRunAsRootScript(checkCommand);
    return {
      installed: true,
      version: output.trim().split('\n')[0] // 取第一行作为版本信息
    };
  } catch (error) {
    // dpkg 命令在包未安装时会返回非零退出码，这是正常行为
    // 不应该抛出错误，而应该返回 installed: false
    logger.debug(`包检查命令失败（这通常意味着包未安装）: ${error.message}`);
    return { installed: false };
  }
}

/**
 * 统一的包安装检查接口
 * 替代 config.toml 的功能
 */
export async function shouldInstallPackage(
  packageName: string,
  checkCommand: string
): Promise<PackageInfo> {
  const { installed, version } = await checkPackageInstalled(checkCommand);

  if (installed) {
    logger.info(`✅ ${packageName} 已安装: ${version || ''}`);
    return {
      name: packageName,
      installed: true,
      version,
      installMethod: "skip"
    };
  }

  logger.info(`📦 ${packageName} 未安装，准备安装...`);
  return {
    name: packageName,
    installed: false,
    installMethod: "src" // 默认使用源码/自定义安装
  };
}

/**
 * APT 包的简化安装接口
 */
export async function installAptPackage(
  packageName: string,
  aptPackages: string | string[],
  checkCommand?: string
): Promise<PackageInfo> {
  const packages = Array.isArray(aptPackages) ? aptPackages : [aptPackages];

  // 如果提供了检查命令，先检查是否已安装
  if (checkCommand) {
    const checkResult = await shouldInstallPackage(packageName, checkCommand);
    if (checkResult.installed) {
      return checkResult;
    }
  }

  // 执行 APT 安装
  try {
    await _internalAptInstall(packages);

    // 再次检查安装结果
    if (checkCommand) {
      return await shouldInstallPackage(packageName, checkCommand);
    }

    return {
      name: packageName,
      installed: true,
      installMethod: "apt"
    };
  } catch (error) {
    logger.error(`❌ ${packageName} APT 安装失败: ${error.message}`);
    throw error;
  }
}

// ========== 13. 简单重复逻辑提取 ==========

/**
 * 批量安装包并处理错误（用于可选包）
 */
export async function installPackagesWithFallback(
  packages: string[],
  packageManager: string,
  user?: string
): Promise<{ success: string[], failed: string[] }> {
  const targetUser = user || _internalGetCurrentUser();
  const results = { success: [], failed: [] };

  for (const pkg of packages) {
    try {
      const cmd = packageManager.includes('${package}')
        ? packageManager.replace('${package}', pkg)
        : `${packageManager} ${pkg}`;

      await _internalRunAsUser(cmd, targetUser);
      results.success.push(pkg);
      logger.success(`  ✓ ${pkg} 安装成功`);
    } catch (error) {
      results.failed.push(pkg);
      logger.warn(`  ⚠️ ${pkg} 安装失败: ${error.message}`);
    }
  }

  return results;
}

// ========== 重新导出常用模块 ==========

// ========== 12. 包状态检查功能 ==========
// isPackageInstalled 已迁移到 src/package/apt.ts

/**
 * 检查命令是否可用
 */
export async function isCommandAvailable(command: string): Promise<boolean> {
  // 使用统一的 shell 执行器
  const { isCommandAvailable: checkCommand } = await import("./shell/shell-executor");
  return await checkCommand(command);
}

// ========== EEE 环境管理系统 ==========

import { EeeEnvManager, createEnvModule, createVersionManagerModule } from "./eee-env-manager";

/**
 * 全新的 EEE 环境配置管理系统
 *
 * 核心特性：
 * - ✅ 幂等性：多次运行不产生副作用
 * - ✅ 完整性：支持环境变量、PATH、aliases、functions
 * - ✅ 结构化：模块化配置管理
 * - ✅ 多Shell兼容：bash、zsh等
 */

// 全局环境管理器实例
let globalEnvManager: EeeEnvManager | null = null;

/**
 * 获取或创建全局环境管理器
 */
function getEeeEnvManager(): EeeEnvManager {
  if (!globalEnvManager) {
    globalEnvManager = new EeeEnvManager({
      shellIntegration: {
        bash: true,
        zsh: true,
        fish: false,
      },
      backup: {
        enabled: true,
        maxBackups: 5,
      },
    });
  }
  return globalEnvManager;
}

/**
 * 新的强大版本：配置 EEE 环境
 *
 * 替代旧的 configureEeeEnvironment 函数
 * 支持完整的Shell配置：环境变量、PATH、aliases、functions等
 *
 * @param options 环境配置选项
 */
export async function configureEeeEnvironment(options: {
  name: string;
  description: string;
  environment?: Record<string, string>;
  paths?: string[];
  aliases?: Record<string, string>;
  functions?: Record<string, string>;
  customCode?: string[];
  priority?: number;
  dependencies?: string[];
}): Promise<void> {
  const manager = getEeeEnvManager();

  logger.info(`🔧 配置 EEE 环境模块: ${options.name}`);

  try {
    // 创建环境模块
    const module = {
      name: options.name,
      description: options.description,
      config: {
        environment: options.environment,
        paths: options.paths,
        aliases: options.aliases,
        functions: options.functions,
        customCode: options.customCode,
        priority: options.priority ?? 50,
      },
      dependencies: options.dependencies,
    };

    // 添加模块到管理器
    await manager.addModule(module);

    // 应用配置
    await manager.applyConfiguration();

    logger.success(`✅ EEE 环境模块 ${options.name} 配置完成`);

  } catch (error) {
    logger.error(`❌ EEE 环境配置失败: ${error.message}`);
    throw error;
  }
}

/**
 * 为版本管理器配置环境（简化接口）
 *
 * @param name 版本管理器名称（如 "Go Manager", "UV Package Manager"）
 * @param description 描述
 * @param environment 环境变量
 * @param paths PATH 路径数组
 * @param customCode 自定义Shell代码
 */
export async function configureVersionManagerEnvironment(
  name: string,
  description: string,
  environment?: Record<string, string>,
  paths?: string[],
  customCode?: string[]
): Promise<void> {
  await configureEeeEnvironment({
    name,
    description,
    environment,
    paths,
    customCode,
    priority: 10, // 版本管理器优先级较高
  });
}

/**
 * 为开发工具配置环境（简化接口）
 *
 * @param name 工具名称
 * @param description 描述
 * @param environment 环境变量
 * @param aliases 别名配置
 * @param functions 函数配置
 */
export async function configureDevToolEnvironment(
  name: string,
  description: string,
  environment?: Record<string, string>,
  aliases?: Record<string, string>,
  functions?: Record<string, string>
): Promise<void> {
  await configureEeeEnvironment({
    name,
    description,
    environment,
    aliases,
    functions,
    priority: 30, // 开发工具优先级中等
  });
}

/**
 * 验证当前环境配置
 */
export async function validateEeeEnvironment(): Promise<{
  valid: boolean;
  issues: string[];
  info: any;
}> {
  const manager = getEeeEnvManager();

  try {
    const [validation, info] = await Promise.all([
      manager.validateConfiguration(),
      manager.getEnvironmentInfo(),
    ]);

    return {
      valid: validation.valid,
      issues: validation.issues,
      info,
    };
  } catch (error) {
    return {
      valid: false,
      issues: [`验证失败: ${error.message}`],
      info: null,
    };
  }
}

/**
 * 向后兼容：旧版本函数接口
 * @deprecated 使用 configureEeeEnvironment 替代
 */
export async function legacyConfigureEeeEnvironment(
  envName: string,
  envContent: string,
  currentUser: string
): Promise<void> {
  logger.warn(`⚠️ 使用了已废弃的 configureEeeEnvironment 接口，建议升级到新版本`);

  // 解析旧格式的环境内容
  const environment: Record<string, string> = {};
  const customCode: string[] = [];

  // 简单解析环境变量和其他内容
  const lines = envContent.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (trimmed.startsWith('export ')) {
      // 解析 export VAR=value
      const match = trimmed.match(/^export\s+([A-Z_][A-Z0-9_]*)\s*=\s*(.+)$/);
      if (match) {
        const [, key, value] = match;
        environment[key] = value.replace(/^["']|["']$/g, ''); // 移除引号
      } else {
        customCode.push(trimmed);
      }
    } else {
      customCode.push(trimmed);
    }
  }

  // 使用新接口
  await configureEeeEnvironment({
    name: envName,
    description: `从旧接口迁移: ${envName}`,
    environment: Object.keys(environment).length > 0 ? environment : undefined,
    customCode: customCode.length > 0 ? customCode : undefined,
    priority: 50,
  });
}

/**
 * 配置 ZSH 环境（用于 post_install.ts）
 * @param currentUser 目标用户
 */
export async function configureZshIntegration(currentUser: string): Promise<void> {
  const userHome = _internalGetUserHome(currentUser);
  const zshrcPath = `${userHome}/.zshrc`;

  logger.info("==> 配置 ZSH 集成 ~/.eee-env");

  // 检查是否安装了 ZSH
  const zshExists = await tryExecute(
    async () => {
      const result = await _internalRunAsUserScript("command -v zsh", currentUser);
      return result.trim().length > 0;
    },
    () => false
  );

  if (!zshExists) {
    logger.info("  > ZSH 未安装，跳过 .zshrc 配置");
    return;
  }

  // 检查 .zshrc 是否存在
  const zshrcExists = await tryExecute(
    async () => {
      await _internalRunAsUserScript(`test -f "${zshrcPath}"`, currentUser);
      return true;
    },
    () => false
  );

  if (!zshrcExists) {
    // 创建 .zshrc
    await _internalRunAsUserScript(`touch "${zshrcPath}"`, currentUser);
    logger.info("  > 创建 .zshrc 文件");
  }

  // 检查 .zshrc 是否已经配置 source ~/.eee-env
  const checkScript = `
if grep -q "source.*\\.eee-env" "${zshrcPath}"; then
  echo "exists"
else
  echo "missing"
fi`;

  const exists = await _internalRunAsUserScript(checkScript, currentUser);

  if (exists.trim() === "exists") {
    logger.info("  > .zshrc 已配置 ~/.eee-env 集成");
    return;
  }

  // 添加 source 命令到 .zshrc
  const sourceCommand = `
# EEE Development Environment
if [ -f "$HOME/.eee-env" ]; then
  source "$HOME/.eee-env"
fi`;

  const appendScript = `echo '${sourceCommand}' >> "${zshrcPath}"`;
  await _internalRunAsUserScript(appendScript, currentUser);

  logger.success("✅ ZSH 已配置加载 ~/.eee-env");
}

/**
 * 重新导出 logger，方便其他包导入
 */
export { logger } from "./logger";
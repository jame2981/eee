#!/usr/bin/env bun

/**
 * pkg-utils.ts
 *
 * 软件包安装工具集
 * 提供统一的工具函数，简化 pre_install.ts/install.ts/post_install.ts 的逻辑
 */

import { $ } from "bun";
import { logger } from "@/logger";

// ========== APT 环境配置 ==========

/**
 * APT 统一环境变量配置
 * - APT_LISTCHANGES_FRONTEND=none: 禁用 apt 命令警告
 * - DEBIAN_FRONTEND=noninteractive: 非交互式安装
 */
const APT_ENV = {
  APT_LISTCHANGES_FRONTEND: "none",
  DEBIAN_FRONTEND: "noninteractive"
};

// ==========  1. 用户环境管理  ==========

export interface UserEnv {
  user: string;
  home: string;
}

/**
 * 获取当前用户环境信息
 * 修复: 确保sudo环境下正确检测原始用户和其主目录
 */
export function getUserEnv(): UserEnv {
  // 优先级: REAL_USER > SUDO_USER > USER > LOGNAME > root
  const user = process.env.REAL_USER || process.env.SUDO_USER || process.env.USER || process.env.LOGNAME || "root";

  // 如果检测到sudo环境且有原始用户，强制使用正确的用户主目录
  let home: string;
  if (process.env.SUDO_USER && process.env.SUDO_USER !== "root") {
    // sudo环境：使用原始用户的主目录
    home = process.env.REAL_HOME || `/home/${process.env.SUDO_USER}`;
  } else if (user === "root") {
    // root用户
    home = "/root";
  } else {
    // 普通用户环境
    home = process.env.REAL_HOME || process.env.HOME || `/home/${user}`;
  }

  return { user, home };
}

/**
 * 获取当前用户名
 */
export function getCurrentUser(): string {
  return getUserEnv().user;
}

/**
 * 获取用户主目录
 */
export function getUserHome(user?: string): string {
  if (user && user !== getCurrentUser()) {
    return user === "root" ? "/root" : `/home/${user}`;
  }
  return getUserEnv().home;
}

// ========== 2. 系统包管理 ==========

/**
 * 更新 APT 包索引 (仅限 apt-base 使用)
 * @internal
 */
export async function _aptUpdate(): Promise<void> {
  logger.info("==> 更新包索引...");
  await $`APT_LISTCHANGES_FRONTEND=none apt update -qq`;
}

/**
 * 公共的APT更新函数
 */
export async function aptUpdate(): Promise<void> {
  await _aptUpdate();
}

/**
 * 安装 APT 包
 */
export async function aptInstall(packages: string | string[]): Promise<void> {
  const pkgList = Array.isArray(packages) ? packages : [packages];
  logger.info(`==> 安装包: ${pkgList.join(", ")}`);

  for (const pkg of pkgList) {
    await $`APT_LISTCHANGES_FRONTEND=none DEBIAN_FRONTEND=noninteractive apt install -y ${pkg}`;
  }
}

/**
 * 移除 APT 包
 */
export async function aptRemove(packages: string | string[]): Promise<void> {
  const pkgList = Array.isArray(packages) ? packages : [packages];
  logger.info(`==> 移除包: ${pkgList.join(", ")}`);

  await $`APT_LISTCHANGES_FRONTEND=none apt remove -y ${pkgList.join(" ")} || true`;
}

/**
 * 添加 PPA 源
 */
export async function addPpa(ppa: string): Promise<void> {
  logger.info(`==> 添加 PPA: ${ppa}`);

  // 确保 software-properties-common 已安装
  await aptInstall("software-properties-common");
  await $`add-apt-repository -y ${ppa}`;
  await aptUpdate();
}

/**
 * 添加 GPG 密钥
 */
export async function addGpgKey(url: string, keyring?: string): Promise<void> {
  const keyringPath = keyring ? `/etc/apt/keyrings/${keyring}.gpg` : `/etc/apt/keyrings/custom.gpg`;

  logger.info(`==> 添加 GPG 密钥: ${url}`);

  // 确保目录存在
  await $`install -m 0755 -d /etc/apt/keyrings`;

  // 下载并安装密钥
  await $`curl -fsSL ${url} | gpg --dearmor -o ${keyringPath}`;
  await $`chmod a+r ${keyringPath}`;
}

/**
 * 添加软件源
 */
export async function addRepository(repo: string): Promise<void> {
  logger.info(`==> 添加软件源: ${repo}`);

  await $`echo "${repo}" | tee /etc/apt/sources.list.d/custom.list > /dev/null`;
  await aptUpdate();
}

// ========== 3. 用户命令执行 ==========

/**
 * 以指定用户身份执行命令
 */
export async function runAsUser(command: string, user?: string): Promise<string> {
  const targetUser = user || getCurrentUser();

  if (targetUser === "root") {
    return await $`${command}`.text();
  }

  return await $`sudo -u ${targetUser} ${command}`.text();
}

/**
 * 以指定用户身份执行脚本
 */
export async function runAsUserScript(script: string, user?: string): Promise<string> {
  const targetUser = user || getCurrentUser();

  if (targetUser === "root") {
    return await $`bash -c ${script}`.text();
  }

  return await $`sudo -u ${targetUser} bash -c ${script}`.text();
}

/**
 * 以指定用户身份执行命令（带环境变量）
 */
export async function runAsUserWithEnv(
  command: string,
  env: Record<string, string>,
  user?: string
): Promise<string> {
  const targetUser = user || getCurrentUser();
  const envVars = Object.entries(env)
    .map(([key, value]) => `${key}='${value}'`)
    .join(" ");

  const script = `export ${envVars} && ${command}`;
  return await runAsUserScript(script, targetUser);
}

// ========== 4. 文件系统操作 ==========

/**
 * 创建用户文件
 */
export async function writeUserFile(path: string, content: string, user?: string): Promise<void> {
  const targetUser = user || getCurrentUser();

  await Bun.write(path, content);
  await setUserOwnership(path, targetUser);

  logger.info(`==> 创建用户文件: ${path}`);
}

/**
 * 创建用户目录
 */
export async function createUserDir(path: string, user?: string, mode = "755"): Promise<void> {
  const targetUser = user || getCurrentUser();

  await $`mkdir -p ${path}`;
  await $`chmod ${mode} ${path}`;
  await setUserOwnership(path, targetUser);

  logger.info(`==> 创建用户目录: ${path}`);
}

/**
 * 设置文件/目录所有权
 */
export async function setUserOwnership(path: string, user?: string): Promise<void> {
  const targetUser = user || getCurrentUser();

  if (targetUser !== "root") {
    await $`chown -R ${targetUser}:${targetUser} ${path}`;
  }
}

/**
 * 复制文件到用户主目录
 */
export async function copyToUserHome(src: string, dest: string, user?: string): Promise<void> {
  const targetUser = user || getCurrentUser();
  const userHome = getUserHome(targetUser);
  const destPath = `${userHome}/${dest}`;

  await $`cp ${src} ${destPath}`;
  await setUserOwnership(destPath, targetUser);

  logger.info(`==> 复制文件: ${src} -> ${destPath}`);
}

// ========== 5. 系统服务管理 ==========

/**
 * 启用系统服务
 */
export async function enableService(service: string): Promise<void> {
  logger.info(`==> 启用服务: ${service}`);
  await $`systemctl enable ${service}`;
}

/**
 * 启动系统服务
 */
export async function startService(service: string): Promise<void> {
  logger.info(`==> 启动服务: ${service}`);
  await $`systemctl start ${service}`;
}

/**
 * 重启系统服务
 */
export async function restartService(service: string): Promise<void> {
  logger.info(`==> 重启服务: ${service}`);
  await $`systemctl restart ${service}`;
}

/**
 * 将用户添加到组
 */
export async function addUserToGroup(user: string, group: string): Promise<void> {
  logger.info(`==> 添加用户 ${user} 到组 ${group}`);
  await $`usermod -aG ${group} ${user}`;
}

// ========== 6. 创建系统链接 ==========

/**
 * 创建符号链接
 */
export async function createSymlink(src: string, dest: string): Promise<void> {
  logger.info(`==> 创建符号链接: ${src} -> ${dest}`);
  await $`ln -sf ${src} ${dest}`;
}

/**
 * 创建二进制文件的系统链接
 */
export async function createBinSymlink(binPath: string, binName: string): Promise<void> {
  const destPath = `/usr/local/bin/${binName}`;
  await createSymlink(binPath, destPath);
}

// ========== 7. 安装验证 ==========

/**
 * 验证命令是否存在
 */
export async function verifyCommand(command: string): Promise<boolean> {
  try {
    await $`which ${command}`;
    return true;
  } catch {
    return false;
  }
}

/**
 * 获取命令版本
 */
export async function getCommandVersion(command: string, versionFlag = "--version"): Promise<string> {
  try {
    return await $`${command} ${versionFlag}`.text();
  } catch (error) {
    throw new Error(`获取 ${command} 版本失败: ${error.message}`);
  }
}

/**
 * 测试用户环境下的命令
 */
export async function testUserCommand(command: string, user?: string): Promise<boolean> {
  try {
    await runAsUser(`which ${command}`, user);
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
  const targetUser = user || getCurrentUser();
  const userHome = getUserHome(targetUser);

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
    await $`curl -fsSL ${url} -o ${dest}`;
    return dest;
  } else {
    return await $`curl -fsSL ${url}`.text();
  }
}

/**
 * 下载并执行脚本
 */
export async function downloadAndRunScript(url: string, user?: string): Promise<string> {
  logger.info(`==> 下载并执行脚本: ${url}`);

  const script = await downloadFile(url);
  return await runAsUserScript(script, user);
}

/**
 * 使用 curl 安装（常见的安装模式）
 */
export async function curlInstall(url: string, user?: string): Promise<void> {
  const targetUser = user || getCurrentUser();

  logger.info(`==> Curl 安装: ${url}`);

  if (targetUser === "root") {
    await $`curl -fsSL ${url} | bash`;
  } else {
    await $`sudo -u ${targetUser} bash -c "curl -fsSL ${url} | bash"`;
  }
}

// ========== 10. 实用工具 ==========

/**
 * 检查是否为 root 用户
 */
export function isRoot(): boolean {
  return process.getuid?.() === 0 || process.env.USER === "root";
}

/**
 * 确保以 root 身份运行
 */
export function requireRoot(): void {
  if (!isRoot()) {
    throw new Error("此操作需要 root 权限");
  }
}

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

export interface SystemInfo {
  os: string;
  distro: string;
  version: string;
  arch: string;
  packageManager: string;
}

/**
 * 检测操作系统类型
 */
export async function detectOS(): Promise<string> {
  try {
    const uname = await $`uname -s`.text();
    return uname.trim().toLowerCase();
  } catch {
    return "unknown";
  }
}

/**
 * 检测 Linux 发行版
 */
export async function detectDistro(): Promise<{ distro: string; version: string }> {
  try {
    const osRelease = await $`cat /etc/os-release`.text();
    const lines = osRelease.split('\n');

    let distro = "unknown";
    let version = "unknown";

    for (const line of lines) {
      if (line.startsWith('ID=')) {
        distro = line.split('=')[1].replace(/"/g, '');
      }
      if (line.startsWith('VERSION_ID=')) {
        version = line.split('=')[1].replace(/"/g, '');
      }
    }

    return { distro, version };
  } catch {
    return { distro: "unknown", version: "unknown" };
  }
}

/**
 * 检测系统架构
 */
export async function detectArch(): Promise<string> {
  try {
    const arch = await $`dpkg --print-architecture`.text();
    return arch.trim();
  } catch {
    try {
      const arch = await $`uname -m`.text();
      return arch.trim();
    } catch {
      return "unknown";
    }
  }
}

/**
 * 检测包管理器
 */
export async function detectPackageManager(): Promise<string> {
  const managers = [
    { cmd: "apt", name: "apt" },
    { cmd: "yum", name: "yum" },
    { cmd: "dnf", name: "dnf" },
    { cmd: "pacman", name: "pacman" },
    { cmd: "zypper", name: "zypper" },
    { cmd: "emerge", name: "portage" },
    { cmd: "apk", name: "apk" }
  ];

  for (const manager of managers) {
    if (await verifyCommand(manager.cmd)) {
      return manager.name;
    }
  }

  return "unknown";
}

/**
 * 获取完整的系统信息
 */
export async function getSystemInfo(): Promise<SystemInfo> {
  const [os, { distro, version }, arch, packageManager] = await Promise.all([
    detectOS(),
    detectDistro(),
    detectArch(),
    detectPackageManager()
  ]);

  return {
    os,
    distro,
    version,
    arch,
    packageManager
  };
}

/**
 * 检查系统兼容性
 */
export async function checkSystemCompatibility(requirements: {
  supportedDistros?: string[];
  supportedVersions?: string[];
  supportedArch?: string[];
  requiredPackageManager?: string;
}): Promise<{ compatible: boolean; issues: string[] }> {
  const systemInfo = await getSystemInfo();
  const issues: string[] = [];

  // 检查操作系统
  if (systemInfo.os !== "linux") {
    issues.push(`不支持的操作系统: ${systemInfo.os} (仅支持 Linux)`);
  }

  // 检查发行版
  if (requirements.supportedDistros && !requirements.supportedDistros.includes(systemInfo.distro)) {
    issues.push(`不支持的发行版: ${systemInfo.distro} (支持: ${requirements.supportedDistros.join(", ")})`);
  }

  // 检查版本
  if (requirements.supportedVersions && !requirements.supportedVersions.includes(systemInfo.version)) {
    issues.push(`不支持的版本: ${systemInfo.version} (支持: ${requirements.supportedVersions.join(", ")})`);
  }

  // 检查架构
  if (requirements.supportedArch && !requirements.supportedArch.includes(systemInfo.arch)) {
    issues.push(`不支持的架构: ${systemInfo.arch} (支持: ${requirements.supportedArch.join(", ")})`);
  }

  // 检查包管理器
  if (requirements.requiredPackageManager && systemInfo.packageManager !== requirements.requiredPackageManager) {
    issues.push(`需要包管理器: ${requirements.requiredPackageManager} (当前: ${systemInfo.packageManager})`);
  }

  return {
    compatible: issues.length === 0,
    issues
  };
}

/**
 * 是否为 Ubuntu/Debian 系统
 */
export async function isDebianBased(): Promise<boolean> {
  const { distro } = await detectDistro();
  return ["ubuntu", "debian", "linuxmint", "elementary", "zorin"].includes(distro.toLowerCase());
}

/**
 * 是否为 WSL 环境
 */
export async function isWSL(): Promise<boolean> {
  try {
    const version = await $`cat /proc/version`.text();
    return version.toLowerCase().includes("microsoft") || version.toLowerCase().includes("wsl");
  } catch {
    return false;
  }
}

/**
 * 检查网络连接
 */
export async function checkNetworkConnection(url = "https://google.com"): Promise<boolean> {
  try {
    await $`curl -sSf --connect-timeout 5 ${url}`;
    return true;
  } catch {
    return false;
  }
}

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
    const output = await $`${checkCommand}`.text();
    return {
      installed: true,
      version: output.trim().split('\n')[0] // 取第一行作为版本信息
    };
  } catch {
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
    await aptInstall(packages);

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
  const targetUser = user || getCurrentUser();
  const results = { success: [], failed: [] };

  for (const pkg of packages) {
    try {
      const cmd = packageManager.includes('${package}')
        ? packageManager.replace('${package}', pkg)
        : `${packageManager} ${pkg}`;

      await runAsUser(cmd, targetUser);
      results.success.push(pkg);
      logger.success(`  ✓ ${pkg} 安装成功`);
    } catch (error) {
      results.failed.push(pkg);
      logger.warn(`  ⚠️ ${pkg} 安装失败: ${error.message}`);
    }
  }

  return results;
}
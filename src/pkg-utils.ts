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

import { $ } from "bun";
import { logger } from "./logger";

// ========== 模块化重导出 ==========
// 用户环境管理（已迁移到独立模块）
export {
  type UserEnv,
  getUserEnv,
  getCurrentUser,
  getUserPrimaryGroup,
  getUserHome,
  isRoot,
  requireRoot,
  addUserToGroup,
} from "./user/user-env";

// 脚本执行（已迁移到独立模块）
export {
  runAsUser,
  runAsUserScript,
  runAsRootScript,
  runAsUserWithEnv,
} from "./shell/script-executor";

// 系统信息（已迁移到独立模块）
export {
  type SystemInfo,
  detectOS,
  detectDistro,
  detectArch,
  detectPackageManager,
  getSystemInfo,
  checkSystemCompatibility,
  isDebianBased,
  isWSL,
  checkNetworkConnection,
  verifyCommand,
  getCommandVersion,
} from "./system/system-info";

// 包管理（已迁移到独立模块）
export {
  _aptUpdate,
  aptUpdate,
  aptInstall,
  aptRemove,
  addPpa,
  addGpgKey,
  addRepository,
  isPackageInstalled,
} from "./package/apt";

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
 * 获取指定用户的主组名
 */
export async function getUserPrimaryGroup(user?: string): Promise<string> {
  const targetUser = user || getCurrentUser();

  try {
    // 使用 id -gn 命令获取用户的主组名
    const groupName = await $`id -gn ${targetUser}`.text();
    return groupName.trim();
  } catch (error) {
    logger.warn(`⚠️ 无法获取用户 ${targetUser} 的主组，使用用户名作为组名: ${error.message}`);
    return targetUser;
  }
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

/**
 * 重新加载环境变量
 * 用于软件安装后刷新PATH和其他环境变量
 */
export async function reloadEnv(user?: string): Promise<void> {
  const targetUser = user || getCurrentUser();
  const userHome = getUserHome(targetUser);

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
    const result = await runAsUserScript(reloadScript, targetUser);

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

/**
 * 更新 APT 包索引 (仅限 apt-base 使用)
 * @internal
 */
export async function _aptUpdate(): Promise<void> {
  logger.info("==> 更新包索引...");

  const updateScript = `set -e
export APT_LISTCHANGES_FRONTEND=none

apt-get update -qq`;

  await runAsRootScript(updateScript);
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

  const installScript = `set -e
export APT_LISTCHANGES_FRONTEND=none
export DEBIAN_FRONTEND=noninteractive

${pkgList.map(pkg => `apt-get install -y ${pkg}`).join('\n')}`;

  await runAsRootScript(installScript);
}

/**
 * 移除 APT 包
 */
export async function aptRemove(packages: string | string[]): Promise<void> {
  const pkgList = Array.isArray(packages) ? packages : [packages];
  logger.info(`==> 移除包: ${pkgList.join(", ")}`);

  const removeScript = `set -e
export APT_LISTCHANGES_FRONTEND=none
export DEBIAN_FRONTEND=noninteractive

apt-get remove -y ${pkgList.join(" ")} || true`;

  await runAsRootScript(removeScript);
}

/**
 * 添加 PPA 源
 */
export async function addPpa(ppa: string): Promise<void> {
  logger.info(`==> 添加 PPA: ${ppa}`);

  // 确保 software-properties-common 已安装
  await aptInstall("software-properties-common");

  const ppaScript = `set -e

# 添加 PPA 源
add-apt-repository -y ${ppa}`;

  await runAsRootScript(ppaScript);
  await aptUpdate();
}

/**
 * 添加 GPG 密钥
 */
export async function addGpgKey(url: string, keyring?: string): Promise<void> {
  const keyringPath = keyring ? `/etc/apt/keyrings/${keyring}.gpg` : `/etc/apt/keyrings/custom.gpg`;

  logger.info(`==> 添加 GPG 密钥: ${url}`);

  const keyScript = `set -e

# 确保目录存在
install -m 0755 -d /etc/apt/keyrings

# 下载并安装密钥（带重试，容器/网络不稳定场景友好）
attempts=3
for i in $(seq 1 $attempts); do
  if curl -fsSL --max-time 60 ${url} | gpg --dearmor -o ${keyringPath}; then
    echo "GPG key downloaded successfully on attempt $i"
    break
  fi
  echo "Attempt $i to download GPG key failed; retrying in 5s..." >&2
  sleep 5
done

if [ ! -s ${keyringPath} ]; then
  echo "Failed to download GPG key from ${url}" >&2
  exit 2
fi

chmod a+r ${keyringPath}`;

  await runAsRootScript(keyScript);
}

/**
 * 添加软件源
 */
export async function addRepository(repo: string, name?: string): Promise<void> {
  logger.info(`==> 添加软件源: ${repo}`);

  const file = name ? `/etc/apt/sources.list.d/${name}.list` : `/etc/apt/sources.list.d/custom.list`;
  const repoScript = `set -e

# 确保 sources.list.d 目录存在
install -m 0755 -d /etc/apt/sources.list.d

# 如果条目已存在则跳过，否则追加
if [ -f "${file}" ] && grep -Fxq "${repo}" "${file}"; then
  echo "Repository already exists in ${file}"
else
  echo "${repo}" | tee -a "${file}" > /dev/null
fi`;

  await runAsRootScript(repoScript);
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
 * 修复: 使用 here document 避免引用问题，增加调试日志
 */
export async function runAsUserScript(script: string, user?: string): Promise<string> {
  const targetUser = user || getCurrentUser();

  logger.debug(`runAsUserScript - 目标用户: ${targetUser}`);
  logger.debug(`runAsUserScript - 脚本长度: ${script.length} 字符`);

  // 显示脚本前200字符用于调试
  if (script.length > 0) {
    logger.debug(`runAsUserScript - 脚本前200字符: ${script.substring(0, 200)}`);
  }

  try {
    let result: string;
    let stderr: string = "";

    // 将脚本写入临时文件
    const tmpFile = `/tmp/script-${Date.now()}.sh`;
    await Bun.write(tmpFile, script);
    await $`chmod +x ${tmpFile}`;

    try {
      if (targetUser === "root") {
        logger.debug("以root用户执行脚本");
        const proc = Bun.spawn(["bash", tmpFile], {
          stdout: "pipe",
          stderr: "pipe"
        });
        const output = await new Response(proc.stdout).text();
        const errOutput = await new Response(proc.stderr).text();
        const exitCode = await proc.exited;

        if (exitCode !== 0) {
          stderr = errOutput;
          throw new Error(`Script failed with exit code ${exitCode}. stderr: ${stderr}`);
        }
        result = output;
      } else {
        logger.debug(`以sudo -u ${targetUser}执行脚本`);
        const proc = Bun.spawn(["sudo", "-u", targetUser, "bash", tmpFile], {
          stdout: "pipe",
          stderr: "pipe"
        });
        const output = await new Response(proc.stdout).text();
        const errOutput = await new Response(proc.stderr).text();
        const exitCode = await proc.exited;

        if (exitCode !== 0) {
          stderr = errOutput;
          throw new Error(`Script failed with exit code ${exitCode}. stderr: ${stderr}`);
        }
        result = output;
      }
    } finally {
      // 清理临时文件
      await $`rm -f ${tmpFile}`.nothrow();
    }

    logger.debug(`runAsUserScript - 脚本执行成功，输出长度: ${result.length} 字符`);
    if (result.length > 0) {
      logger.debug(`runAsUserScript - 前200字符: ${result.substring(0, 200)}`);
    }
    return result;
  } catch (error) {
    // 记录详细的调试信息
    logger.debug(`runAsUserScript - 脚本执行失败: ${error.message}`);

    // 显示执行的脚本内容
    logger.debug(`runAsUserScript - 失败的脚本内容:`);
    script.split('\n').forEach((line, index) => {
      logger.debug(`  ${index + 1}: ${line}`);
    });

    // 显示执行命令
    if (targetUser === "root") {
      logger.debug(`runAsUserScript - 执行命令: bash <tmpfile>`);
    } else {
      logger.debug(`runAsUserScript - 执行命令: sudo -u ${targetUser} bash <tmpfile>`);
    }

    // 提取并显示标准错误输出
    if (error.message.includes('stderr:')) {
      const stderrMatch = error.message.match(/stderr: (.+)/);
      if (stderrMatch) {
        logger.debug(`runAsUserScript - 标准错误输出:`);
        stderrMatch[1].split('\n').forEach(line => {
          if (line.trim()) {
            logger.debug(`    ${line}`);
          }
        });
      }
    }

    // 提取并显示退出码
    if (error.message.includes('exit code')) {
      const exitCodeMatch = error.message.match(/exit code (\d+)/);
      if (exitCodeMatch) {
        logger.debug(`runAsUserScript - 退出码: ${exitCodeMatch[1]}`);
      }
    }

    throw error;
  }
}

/**
 * 以 root 权限执行脚本
 * 统一的 root 权限管理，所有 install.ts 需要 root 权限的操作都应使用此函数
 */
export async function runAsRootScript(script: string): Promise<string> {
  logger.debug(`runAsRootScript - 脚本长度: ${script.length} 字符`);

  // 检查当前是否已经是 root
  const currentUser = getCurrentUser();
  if (currentUser === "root") {
    logger.debug("当前已是 root 用户，直接执行脚本");
    return await runAsUserScript(script, "root");
  }

  // 需要提升权限执行
  logger.debug("以 sudo 提升权限执行脚本");

  try {
    // 将脚本写入临时文件
    const tmpFile = `/tmp/root-script-${Date.now()}.sh`;
    await Bun.write(tmpFile, script);
    await $`chmod +x ${tmpFile}`;

    let result: string;
    try {
      // 使用 sudo 执行脚本
      result = await $`sudo bash ${tmpFile}`.text();
    } finally {
      // 清理临时文件
      await $`sudo rm -f ${tmpFile}`.nothrow();
    }

    logger.debug(`runAsRootScript - 脚本执行成功，输出长度: ${result.length} 字符`);
    if (result.length > 0) {
      logger.debug(`runAsRootScript - 前100字符: ${result.substring(0, 100)}`);
    }
    return result;
  } catch (error) {
    logger.debug(`runAsRootScript - 脚本执行失败: ${error instanceof Error ? error.message : String(error)}`);
    logger.debug(`runAsRootScript - 错误详情: ${JSON.stringify(error, null, 2)}`);
    throw error;
  }
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
    // 获取用户的主组名，而不是假设用户名等于组名
    const primaryGroup = await getUserPrimaryGroup(targetUser);
    await $`chown -R ${targetUser}:${primaryGroup} ${path}`;
    logger.info(`==> 设置文件所有权: ${path} -> ${targetUser}:${primaryGroup}`);
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

  const enableScript = `set -e

# 检查 systemd 可用性并启用服务（容器内降级处理）
if command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ] && [ "$(cat /proc/1/comm)" = "systemd" ]; then
  systemctl enable ${service}
else
  echo "systemd not available in this environment; skip enabling ${service}"
fi`;

  await runAsRootScript(enableScript);
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

  await runAsRootScript(startScript);
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

  await runAsRootScript(restartScript);
}

/**
 * 将用户添加到组
 */
export async function addUserToGroup(user: string, group: string): Promise<void> {
  logger.info(`==> 添加用户 ${user} 到组 ${group}`);

  const addUserScript = `set -e

# 添加用户到组
usermod -aG ${group} ${user}`;

  await runAsRootScript(addUserScript);
}

// ========== 6. 创建系统链接 ==========

/**
 * 创建符号链接
 */
export async function createSymlink(src: string, dest: string): Promise<void> {
  logger.info(`==> 创建符号链接: ${src} -> ${dest}`);

  const symlinkScript = `set -e

# 创建符号链接
ln -sf ${src} ${dest}`;

  await runAsRootScript(symlinkScript);
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
  ubuntuCodename?: string; // Ubuntu 发行版代号，如 jammy, focal 等
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
export async function detectDistro(): Promise<{ distro: string; version: string; ubuntuCodename?: string }> {
  try {
    const osRelease = await $`cat /etc/os-release`.text();
    const lines = osRelease.split('\n');

    let distro = "unknown";
    let version = "unknown";
    let ubuntuCodename: string | undefined = undefined;

    for (const line of lines) {
      if (line.startsWith('ID=')) {
        distro = line.split('=')[1].replace(/"/g, '');
      }
      if (line.startsWith('VERSION_ID=')) {
        version = line.split('=')[1].replace(/"/g, '');
      }
      if (line.startsWith('UBUNTU_CODENAME=')) {
        ubuntuCodename = line.split('=')[1].replace(/"/g, '');
      }
    }

    return { distro, version, ubuntuCodename };
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
  const [os, { distro, version, ubuntuCodename }, arch, packageManager] = await Promise.all([
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
    packageManager,
    ubuntuCodename
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
    // 使用 runAsRootScript 来执行检查命令，确保有足够权限访问 dpkg 数据库
    const output = await runAsRootScript(checkCommand);
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

// ========== 重新导出常用模块 ==========

// ========== 12. 包状态检查功能 ==========

/**
 * 检查包是否已安装
 */
export async function isPackageInstalled(packageName: string): Promise<boolean> {
  try {
    const result = await $`dpkg -l ${packageName}`.text();
    return result.includes('ii '); // 'ii' 表示已安装
  } catch {
    return false;
  }
}

/**
 * 检查命令是否可用
 */
export async function isCommandAvailable(command: string): Promise<boolean> {
  try {
    await $`command -v ${command}`.text();
    return true;
  } catch {
    return false;
  }
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
  const userHome = getUserHome(currentUser);
  const zshrcPath = `${userHome}/.zshrc`;

  logger.info("==> 配置 ZSH 集成 ~/.eee-env");

  // 检查是否安装了 ZSH
  const zshExists = await tryExecute(
    async () => {
      const result = await runAsUserScript("command -v zsh", currentUser);
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
      await runAsUserScript(`test -f "${zshrcPath}"`, currentUser);
      return true;
    },
    () => false
  );

  if (!zshrcExists) {
    // 创建 .zshrc
    await runAsUserScript(`touch "${zshrcPath}"`, currentUser);
    logger.info("  > 创建 .zshrc 文件");
  }

  // 检查 .zshrc 是否已经配置 source ~/.eee-env
  const checkScript = `
if grep -q "source.*\\.eee-env" "${zshrcPath}"; then
  echo "exists"
else
  echo "missing"
fi`;

  const exists = await runAsUserScript(checkScript, currentUser);

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
  await runAsUserScript(appendScript, currentUser);

  logger.success("✅ ZSH 已配置加载 ~/.eee-env");
}

/**
 * 重新导出 logger，方便其他包导入
 */
export { logger } from "./logger";
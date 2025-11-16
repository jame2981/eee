// src/user/user-env.ts

/**
 * 用户环境管理模块
 *
 * 提供用户信息获取、用户主目录管理等功能
 */

import { logger } from "../logger";
import { execBash } from "../shell/shell-executor";

/**
 * 用户环境信息
 */
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
    const groupName = await execBash(`id -gn ${targetUser}`);
    return groupName.trim();
  } catch (error) {
    logger.warn(`⚠️ 无法获取用户 ${targetUser} 的主组，使用用户名作为组名: ${error instanceof Error ? error.message : String(error)}`);
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
 * 检查是否为 root 用户
 */
export function isRoot(): boolean {
  return getCurrentUser() === "root" || process.getuid?.() === 0;
}

/**
 * 要求必须是 root 用户
 */
export function requireRoot(): void {
  if (!isRoot()) {
    logger.error("此操作需要 root 权限，请使用 sudo 运行");
  }
}

/**
 * 将用户添加到指定组
 */
export async function addUserToGroup(user: string, group: string): Promise<void> {
  logger.info(`==> 将用户 ${user} 添加到组 ${group}...`);

  try {
    await execBash(`sudo usermod -aG ${group} ${user}`);
    logger.success(`✅ 用户 ${user} 已添加到组 ${group}`);
  } catch (error) {
    logger.warn(`❌ 添加用户到组失败: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

/**
 * 检查当前用户是否有 sudo 权限
 * @returns true 如果有 sudo 权限，false 否则
 */
export async function hasSudoPermission(): Promise<boolean> {
  try {
    // 尝试运行一个简单的 sudo 命令（-n 表示非交互模式）
    await execBash("sudo -n true 2>/dev/null");
    return true;
  } catch {
    // 如果失败，可能是没有 sudo 权限或需要密码
    // 再尝试检查用户是否在 sudo 组中
    try {
      const groups = await execBash("groups");
      return groups.includes("sudo") || groups.includes("wheel") || groups.includes("admin");
    } catch {
      return false;
    }
  }
}

/**
 * 要求用户必须有 sudo 权限
 * 如果没有 sudo 权限，则抛出错误
 */
export async function requireSudo(): Promise<void> {
  const hasSudo = await hasSudoPermission();
  if (!hasSudo) {
    logger.error("❌ 此操作需要 sudo 权限，请确保：");
    logger.error("   1. 当前用户在 sudo/wheel/admin 组中");
    logger.error("   2. /etc/sudoers 配置正确");
    logger.error("   3. 使用 'sudo' 运行此命令");
    throw new Error("需要 sudo 权限");
  }
}

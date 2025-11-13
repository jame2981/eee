// src/shell/script-executor.ts

/**
 * Shell 脚本执行模块
 *
 * 提供以不同用户身份执行命令和脚本的功能
 */

import { logger } from "../logger";
import { getCurrentUser } from "../user/user-env";
import { execBash, execCommand } from "./shell-executor";

/**
 * 以指定用户身份执行命令
 */
export async function runAsUser(command: string, user?: string): Promise<string> {
  const targetUser = user || getCurrentUser();

  if (targetUser === "root") {
    return await execBash(command);
  }

  return await execBash(`sudo -u ${targetUser} ${command}`);
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

    // 设置可执行权限
    await execCommand("chmod", ["+x", tmpFile]);

    try {
      if (targetUser === "root") {
        logger.debug("以root用户执行脚本");
        result = await execCommand("bash", [tmpFile]);
      } else {
        logger.debug(`以sudo -u ${targetUser}执行脚本`);
        result = await execCommand("sudo", ["-u", targetUser, "bash", tmpFile]);
      }
    } finally {
      // 清理临时文件
      await execCommand("rm", ["-f", tmpFile]);
    }

    logger.debug(`runAsUserScript - 脚本执行成功，输出长度: ${result.length} 字符`);
    if (result.length > 0) {
      logger.debug(`runAsUserScript - 前200字符: ${result.substring(0, 200)}`);
    }
    return result;
  } catch (error) {
    // 记录详细的调试信息
    logger.debug(`runAsUserScript - 脚本执行失败: ${error instanceof Error ? error.message : String(error)}`);

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
    if (error instanceof Error && error.message.includes('stderr:')) {
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
    if (error instanceof Error && error.message.includes('exit code')) {
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

    // 设置可执行权限
    await execCommand("chmod", ["+x", tmpFile]);

    let result: string;
    try {
      // 使用 sudo 执行脚本
      result = await execBash(`sudo bash ${tmpFile}`);
    } finally {
      // 清理临时文件
      await execCommand("sudo", ["rm", "-f", tmpFile]);
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
  const envString = Object.entries(env)
    .map(([key, value]) => `${key}="${value}"`)
    .join(" ");

  if (targetUser === "root") {
    return await execBash(`env ${envString} ${command}`);
  }

  return await execBash(`sudo -u ${targetUser} env ${envString} ${command}`);
}

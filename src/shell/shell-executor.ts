// src/shell/shell-executor.ts

/**
 * 统一的 Shell 命令执行模块
 *
 * 这是项目中唯一允许直接调用 Bun.spawn 执行 shell 命令的模块
 * 所有其他代码必须通过这个模块的导出函数来执行 shell 命令
 *
 * 核心原则：
 * 1. 所有 shell 命令执行必须通过这个模块
 * 2. 使用 Bun.spawn 而不是 $ 模板字符串，避免 Bun shell 的限制
 * 3. 强制使用数组参数，避免命令注入和参数解析问题
 * 4. 所有命令通过真正的 bash 执行，确保完整的 shell 功能
 */

import { logger } from "../logger";

/**
 * Shell 命令执行选项
 */
export interface ShellExecOptions {
  /** 是否捕获输出（默认 true） */
  captureOutput?: boolean;
  /** 是否继承 stdio（用于交互式命令，默认 false） */
  inheritStdio?: boolean;
  /** 工作目录 */
  cwd?: string;
  /** 环境变量 */
  env?: Record<string, string>;
  /** 是否静默执行（不抛出错误，默认 false） */
  silent?: boolean;
  /** 超时时间（毫秒），0 表示无超时，默认 0 */
  timeout?: number;
}

/**
 * Shell 命令执行结果
 */
export interface ShellExecResult {
  /** 退出码 */
  exitCode: number;
  /** 标准输出 */
  stdout: string;
  /** 标准错误输出 */
  stderr: string;
  /** 是否成功 */
  success: boolean;
}

/**
 * 执行 shell 命令（底层实现）
 * 这是项目中唯一允许直接调用 Bun.spawn 的函数
 *
 * @param args 命令参数数组
 * @param options 执行选项
 * @returns 执行结果
 */
async function _execShell(args: string[], options: ShellExecOptions = {}): Promise<ShellExecResult> {
  const {
    captureOutput = true,
    inheritStdio = false,
    cwd,
    env,
    silent = false,
    timeout = 0
  } = options;

  const spawnOptions: any = {
    cwd,
    env: env ? { ...process.env, ...env } : undefined,
  };

  if (inheritStdio) {
    spawnOptions.stdio = ['inherit', 'inherit', 'inherit'];
  } else if (captureOutput) {
    spawnOptions.stdout = 'pipe';
    spawnOptions.stderr = 'pipe';
  }

  const proc = Bun.spawn(args, spawnOptions);

  let stdout = '';
  let stderr = '';
  let exitCode: number;
  let timedOut = false;

  try {
    // 如果设置了超时，使用 Promise.race 来实现超时控制
    if (timeout > 0) {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          timedOut = true;
          proc.kill();
          reject(new Error(`Command timed out after ${timeout}ms`));
        }, timeout);
      });

      const execPromise = (async () => {
        if (captureOutput && !inheritStdio) {
          stdout = await new Response(proc.stdout).text();
          stderr = await new Response(proc.stderr).text();
        }
        return await proc.exited;
      })();

      exitCode = await Promise.race([execPromise, timeoutPromise]);
    } else {
      // 无超时限制
      if (captureOutput && !inheritStdio) {
        stdout = await new Response(proc.stdout).text();
        stderr = await new Response(proc.stderr).text();
      }
      exitCode = await proc.exited;
    }
  } catch (error) {
    if (timedOut) {
      if (!silent) {
        throw new Error(`Command timed out after ${timeout}ms. Command: ${args.join(' ')}`);
      }
      return { exitCode: 124, stdout, stderr: 'Command timed out', success: false };
    }
    throw error;
  }

  const success = exitCode === 0;

  if (!success && !silent) {
    throw new Error(`Command failed with exit code ${exitCode}. stderr: ${stderr}`);
  }

  return { exitCode, stdout, stderr, success };
}

/**
 * 执行命令（推荐使用）
 *
 * @param cmd 命令名或命令数组
 * @param args 命令参数（如果 cmd 是字符串）
 * @param options 执行选项
 * @returns 命令输出
 *
 * @example
 * // 推荐：使用数组
 * await exec(["ls", "-la", "/tmp"]);
 * await exec(["git", "commit", "-m", "message with spaces"]);
 *
 * // 也支持：命令名 + 参数数组
 * await exec("ls", ["-la", "/tmp"]);
 */
export async function exec(
  cmd: string | string[],
  argsOrOptions?: string[] | ShellExecOptions,
  optionsParam?: ShellExecOptions
): Promise<string> {
  let finalArgs: string[];
  let finalOptions: ShellExecOptions;

  if (Array.isArray(cmd)) {
    // exec(["cmd", "arg1", "arg2"], options)
    finalArgs = cmd;
    finalOptions = (argsOrOptions as ShellExecOptions) || {};
  } else {
    // exec("cmd", ["arg1", "arg2"], options)
    finalArgs = [cmd, ...(argsOrOptions as string[] || [])];
    finalOptions = optionsParam || {};
  }

  const result = await _execShell(finalArgs, finalOptions);
  return result.stdout;
}

/**
 * 执行命令并返回完整结果（包括退出码）
 *
 * @param cmd 命令名或命令数组
 * @param args 命令参数（如果 cmd 是字符串）
 * @param options 执行选项
 * @returns 执行结果
 */
export async function execWithResult(
  cmd: string | string[],
  argsOrOptions?: string[] | ShellExecOptions,
  optionsParam?: ShellExecOptions
): Promise<ShellExecResult> {
  let finalArgs: string[];
  let finalOptions: ShellExecOptions;

  if (Array.isArray(cmd)) {
    finalArgs = cmd;
    finalOptions = (argsOrOptions as ShellExecOptions) || {};
  } else {
    finalArgs = [cmd, ...(argsOrOptions as string[] || [])];
    finalOptions = optionsParam || {};
  }

  return await _execShell(finalArgs, { ...finalOptions, silent: true });
}

/**
 * 执行 bash 脚本（用于需要 shell 特性的场景，如管道、重定向等）
 *
 * ⚠️ 注意：此函数接受字符串参数，使用时需要注意命令注入风险
 * 优先使用 exec() 函数
 *
 * @param script bash 脚本内容
 * @param options 执行选项
 * @returns 命令输出
 *
 * @example
 * // 管道
 * await execBashScript("cat /etc/os-release | grep VERSION");
 * // 重定向
 * await execBashScript("echo 'content' > /tmp/file.txt");
 */
export async function execBashScript(script: string, options: ShellExecOptions = {}): Promise<string> {
  const result = await _execShell(["bash", "-c", script], options);
  return result.stdout;
}

/**
 * 检查命令是否可用
 *
 * @param command 命令名
 * @returns 是否可用
 */
export async function isCommandAvailable(command: string): Promise<boolean> {
  const result = await _execShell(["bash", "-c", `command -v ${command}`], { silent: true });
  return result.success;
}

// ========== 向后兼容的别名（将逐步废弃） ==========

/**
 * @deprecated 使用 execBashScript 代替
 */
export async function execBash(command: string, options: ShellExecOptions = {}): Promise<string> {
  return execBashScript(command, options);
}

/**
 * @deprecated 使用 exec 代替
 */
export async function execCommand(cmd: string, args: string[] = [], options: ShellExecOptions = {}): Promise<string> {
  return exec(cmd, args, options);
}

/**
 * @deprecated 使用 execBashScript + execWithResult 代替
 */
export async function execBashWithResult(command: string, options: ShellExecOptions = {}): Promise<ShellExecResult> {
  return await _execShell(["bash", "-c", command], { ...options, silent: true });
}

/**
 * @deprecated 使用 exec(["sudo", ...]) 代替
 */
export async function execSudo(command: string, options: ShellExecOptions = {}): Promise<string> {
  return await execBashScript(`sudo bash -c "${command.replace(/"/g, '\\"')}"`, options);
}


// src/logging-utils.ts

import { logger } from "./logger";

/**
 * 日志包装器选项
 */
export interface WithLoggingOptions {
  /** 步骤名称 */
  stepName: string;
  /** 开始时的前缀，默认为 "==>" */
  startPrefix?: string;
  /** 成功时的消息，默认为 "{stepName} 完成" */
  successMessage?: string;
  /** 失败时的消息，默认为 "{stepName} 失败" */
  errorMessage?: string;
  /** 是否在失败时抛出错误，默认为 true */
  throwOnError?: boolean;
  /** 是否显示开始日志，默认为 true */
  logStart?: boolean;
  /** 是否显示成功日志，默认为 true */
  logSuccess?: boolean;
}

/**
 * 通用日志包装器
 *
 * 自动记录操作的开始、成功和失败状态
 *
 * @param options 日志选项
 * @param operation 要执行的操作
 * @returns 操作的返回值
 *
 * @example
 * ```typescript
 * const result = await withLogging(
 *   { stepName: "安装 Node.js" },
 *   async () => {
 *     await installNode();
 *     return "v22.0.0";
 *   }
 * );
 * ```
 */
export async function withLogging<T>(
  options: WithLoggingOptions,
  operation: () => Promise<T>
): Promise<T> {
  const {
    stepName,
    startPrefix = "==>",
    successMessage,
    errorMessage,
    throwOnError = true,
    logStart = true,
    logSuccess = true,
  } = options;

  // 记录开始
  if (logStart) {
    logger.info(`${startPrefix} ${stepName}...`);
  }

  try {
    // 执行操作
    const result = await operation();

    // 记录成功
    if (logSuccess) {
      const msg = successMessage || `${stepName} 完成`;
      logger.success(msg);
    }

    return result;
  } catch (error) {
    // 记录失败
    const msg = errorMessage || `${stepName} 失败`;
    const errorDetail = error instanceof Error ? error.message : String(error);
    logger.warn(`${msg}: ${errorDetail}`);

    // 根据配置决定是否抛出错误
    if (throwOnError) {
      throw error;
    }

    // 如果不抛出错误，返回 undefined
    return undefined as T;
  }
}

/**
 * 同步版本的日志包装器
 *
 * @param options 日志选项
 * @param operation 要执行的操作（同步）
 * @returns 操作的返回值
 */
export function withLoggingSync<T>(
  options: WithLoggingOptions,
  operation: () => T
): T {
  const {
    stepName,
    startPrefix = "==>",
    successMessage,
    errorMessage,
    throwOnError = true,
    logStart = true,
    logSuccess = true,
  } = options;

  // 记录开始
  if (logStart) {
    logger.info(`${startPrefix} ${stepName}...`);
  }

  try {
    // 执行操作
    const result = operation();

    // 记录成功
    if (logSuccess) {
      const msg = successMessage || `${stepName} 完成`;
      logger.success(msg);
    }

    return result;
  } catch (error) {
    // 记录失败
    const msg = errorMessage || `${stepName} 失败`;
    const errorDetail = error instanceof Error ? error.message : String(error);
    logger.warn(`${msg}: ${errorDetail}`);

    // 根据配置决定是否抛出错误
    if (throwOnError) {
      throw error;
    }

    // 如果不抛出错误，返回 undefined
    return undefined as T;
  }
}

/**
 * 简化版的日志包装器（只需要步骤名称）
 *
 * @param stepName 步骤名称
 * @param operation 要执行的操作
 * @returns 操作的返回值
 *
 * @example
 * ```typescript
 * const version = await withStep("检测 Node.js 版本", async () => {
 *   return await getNodeVersion();
 * });
 * ```
 */
export async function withStep<T>(
  stepName: string,
  operation: () => Promise<T>
): Promise<T> {
  return withLogging({ stepName }, operation);
}

/**
 * 创建一个带有默认配置的日志包装器
 *
 * @param defaultOptions 默认选项
 * @returns 预配置的日志包装器函数
 *
 * @example
 * ```typescript
 * const withInstallLog = createLogWrapper({
 *   startPrefix: "📦",
 *   successMessage: "安装成功",
 * });
 *
 * await withInstallLog({ stepName: "安装依赖" }, async () => {
 *   await installDeps();
 * });
 * ```
 */
export function createLogWrapper(defaultOptions: Partial<WithLoggingOptions>) {
  return async function <T>(
    options: WithLoggingOptions,
    operation: () => Promise<T>
  ): Promise<T> {
    return withLogging({ ...defaultOptions, ...options }, operation);
  };
}

/**
 * 批量执行带日志的操作
 *
 * @param tasks 任务列表
 * @param options 配置选项
 * @returns 所有任务的结果数组
 *
 * @example
 * ```typescript
 * await withBatchLogging([
 *   { stepName: "安装 Node.js", operation: async () => await installNode() },
 *   { stepName: "安装 Python", operation: async () => await installPython() },
 * ]);
 * ```
 */
export async function withBatchLogging<T = void>(
  tasks: Array<{
    stepName: string;
    operation: () => Promise<T>;
  }>,
  options: {
    /** 是否在某个任务失败时继续执行，默认为 false */
    continueOnError?: boolean;
    /** 整体操作的名称 */
    batchName?: string;
  } = {}
): Promise<T[]> {
  const { continueOnError = false, batchName } = options;
  const results: T[] = [];
  const errors: Error[] = [];

  if (batchName) {
    logger.step(`开始执行: ${batchName}`);
  }

  for (const task of tasks) {
    try {
      const result = await withLogging(
        { stepName: task.stepName, throwOnError: !continueOnError },
        task.operation
      );
      results.push(result);
    } catch (error) {
      if (continueOnError) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
        results.push(undefined as T);
      } else {
        throw error;
      }
    }
  }

  if (batchName) {
    if (errors.length === 0) {
      logger.success(`${batchName} 全部完成！`);
    } else {
      logger.warn(`${batchName} 完成，但有 ${errors.length} 个任务失败`);
    }
  }

  return results;
}

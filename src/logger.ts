// src/logger.ts

import { createConsola, LogLevels } from 'consola';

/**
 * 创建 consola 日志实例
 */
const consola = createConsola({
  level: process.env.LOG_LEVEL === 'debug' ? LogLevels.debug :
         process.env.LOG_LEVEL === 'trace' ? LogLevels.trace :
         LogLevels.info,
  formatOptions: {
    colors: true,
    compact: false,
    date: false,
  },
});

/**
 * 带有美化格式的日志工具
 * 基于 consola 实现，支持日志级别控制
 *
 * 使用方法:
 * - 默认只显示 info 及以上级别
 * - 设置 LOG_LEVEL=debug 显示调试信息
 * - 设置 LOG_LEVEL=trace 显示所有信息
 */
export const logger = {
  /**
   * 用于输出主要步骤信息 (例如: "🚀 开始安装 neovim")
   * @param message 日志消息
   */
  step: (message: string) => {
    consola.log(`\n🚀 ${message}`);
  },

  /**
   * 用于输出普通信息
   * @param message 日志消息
   */
  info: (message: string) => {
    consola.info(`  > ${message}`);
  },

  /**
   * 用于输出调试信息（需要设置 LOG_LEVEL=debug 才会显示）
   * @param message 日志消息
   */
  debug: (message: string) => {
    consola.debug(`  [debug] ${message}`);
  },

  /**
   * 用于输出成功信息
   * @param message 日志消息
   */
  success: (message: string) => {
    consola.success(`  ${message}`);
  },

  /**
   * 用于输出警告信息
   * @param message 日志消息
   */
  warn: (message: string) => {
    consola.warn(`  ${message}`);
  },

  /**
   * 用于输出错误信息并退出程序
   * @param message 错误消息
   * @param error 可选的错误对象
   */
  error: (message: string, error?: unknown) => {
    if (error instanceof Error) {
      consola.error(`\n❌ 严重错误: ${message}`, error);
    } else {
      consola.error(`\n❌ 严重错误: ${message}`);
    }
    process.exit(1);
  },

  /**
   * 用于输出命令的实时输出
   * @param data 命令输出的 buffer 数据
   */
  cmd: (data: string | Buffer) => {
    // 命令输出直接写到 stdout，不经过 consola
    process.stdout.write(data.toString());
  },

  /**
   * 原始 consola 实例，用于高级用法
   */
  raw: consola,
};

// src/logger.ts

import chalk from 'chalk';

/**
 * 带有美化格式的日志工具
 */
export const logger = {
  /**
   * 用于输出主要步骤信息 (例如: "🚀 开始安装 neovim")
   * @param message 日志消息
   */
  step: (message: string) => {
    console.log(chalk.blue.bold(`\n🚀 ${message}`));
  },

  /**
   * 用于输出普通信息
   * @param message 日志消息
   */
  info: (message: string) => {
    console.log(chalk.cyan(`  > ${message}`));
  },

  /**
   * 用于输出调试信息
   * @param message 日志消息
   */
  debug: (message: string) => {
    console.log(chalk.gray(`  [debug] ${message}`));
  },

  /**
   * 用于输出成功信息
   * @param message 日志消息
   */
  success: (message: string) => {
    console.log(chalk.green(`  ✅ ${message}`));
  },

  /**
   * 用于输出警告信息
   * @param message 日志消息
   */
  warn: (message: string) => {
    console.log(chalk.yellow(`  ⚠️  ${message}`));
  },

  /**
   * 用于输出错误信息并退出程序
   * @param message 错误消息
   * @param error 可选的错误对象
   */
  error: (message: string, error?: unknown) => {
    console.error(chalk.red.bold(`\n❌ 严重错误: ${message}`));
    if (error instanceof Error) {
      console.error(chalk.red(error.stack || error.message));
    }
    process.exit(1);
  },

  /**
   * 用于输出命令的实时输出
   * @param data 命令输出的 buffer 数据
   */
  cmd: (data: string | Buffer) => {
    process.stdout.write(chalk.gray(data.toString()));
  },
};

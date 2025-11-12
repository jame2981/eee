// src/shell-script-builder.ts

/**
 * Shell 脚本构建器
 *
 * 提供流式API来构建shell脚本，减少重复代码
 *
 * 示例：
 * ```typescript
 * const script = new ShellScriptBuilder()
 *   .addShebang()
 *   .setStrictMode()
 *   .exportPath("$HOME/.local/bin")
 *   .addCommand('echo "Hello World"')
 *   .build();
 * ```
 */
export class ShellScriptBuilder {
  private lines: string[] = [];

  /**
   * 添加 shebang 行
   * @param shell Shell 类型，默认为 bash
   */
  addShebang(shell: "bash" | "sh" | "zsh" = "bash"): this {
    this.lines.push(`#!/usr/bin/env ${shell}`);
    return this;
  }

  /**
   * 设置严格模式
   * @param options 选项：errexit (遇到错误退出), nounset (使用未定义变量时报错), pipefail (管道中任何命令失败都报错)
   */
  setStrictMode(options: {
    errexit?: boolean;
    nounset?: boolean;
    pipefail?: boolean;
  } = { errexit: true }): this {
    const flags: string[] = [];
    if (options.errexit !== false) flags.push("-e");
    if (options.nounset) flags.push("-u");
    if (options.pipefail) flags.push("-o pipefail");

    if (flags.length > 0) {
      this.lines.push(`set ${flags.join(" ")}`);
    }
    return this;
  }

  /**
   * 导出 PATH 环境变量
   * @param path 要添加的路径
   * @param position 位置：prepend (前置) 或 append (后置)
   */
  exportPath(path: string, position: "prepend" | "append" = "prepend"): this {
    if (position === "prepend") {
      this.lines.push(`export PATH="${path}:$PATH"`);
    } else {
      this.lines.push(`export PATH="$PATH:${path}"`);
    }
    return this;
  }

  /**
   * 导出环境变量
   * @param name 变量名
   * @param value 变量值
   */
  exportEnv(name: string, value: string): this {
    this.lines.push(`export ${name}="${value}"`);
    return this;
  }

  /**
   * 导出多个环境变量
   * @param env 环境变量对象
   */
  exportEnvs(env: Record<string, string>): this {
    for (const [name, value] of Object.entries(env)) {
      this.exportEnv(name, value);
    }
    return this;
  }

  /**
   * 添加注释
   * @param comment 注释内容
   */
  addComment(comment: string): this {
    this.lines.push(`# ${comment}`);
    return this;
  }

  /**
   * 添加空行
   * @param count 空行数量
   */
  addEmptyLine(count: number = 1): this {
    for (let i = 0; i < count; i++) {
      this.lines.push("");
    }
    return this;
  }

  /**
   * 添加命令
   * @param command 要执行的命令
   */
  addCommand(command: string): this {
    this.lines.push(command);
    return this;
  }

  /**
   * 添加多个命令
   * @param commands 命令数组
   */
  addCommands(commands: string[]): this {
    this.lines.push(...commands);
    return this;
  }

  /**
   * 添加条件块 (if)
   * @param condition 条件表达式
   * @param thenCommands 条件为真时执行的命令
   * @param elseCommands 条件为假时执行的命令（可选）
   */
  addIf(condition: string, thenCommands: string[], elseCommands?: string[]): this {
    this.lines.push(`if ${condition}; then`);
    thenCommands.forEach(cmd => {
      this.lines.push(`    ${cmd}`);
    });
    if (elseCommands && elseCommands.length > 0) {
      this.lines.push("else");
      elseCommands.forEach(cmd => {
        this.lines.push(`    ${cmd}`);
      });
    }
    this.lines.push("fi");
    return this;
  }

  /**
   * 添加函数定义
   * @param name 函数名
   * @param body 函数体命令数组
   */
  addFunction(name: string, body: string[]): this {
    this.lines.push(`${name}() {`);
    body.forEach(cmd => {
      this.lines.push(`    ${cmd}`);
    });
    this.lines.push("}");
    return this;
  }

  /**
   * 添加错误处理
   * @param errorMessage 错误消息
   * @param exitCode 退出码，默认为 1
   */
  addErrorHandler(errorMessage: string, exitCode: number = 1): this {
    this.addFunction("error_exit", [
      `echo "Error: $1" >&2`,
      `exit ${exitCode}`,
    ]);
    this.lines.push(`trap 'error_exit "${errorMessage}"' ERR`);
    return this;
  }

  /**
   * 添加文件存在性检查
   * @param filePath 文件路径
   * @param errorMessage 文件不存在时的错误消息
   */
  addFileExistsCheck(filePath: string, errorMessage?: string): this {
    const msg = errorMessage || `File ${filePath} does not exist`;
    this.addIf(`[ ! -f "${filePath}" ]`, [
      `echo "${msg}" >&2`,
      `exit 1`,
    ]);
    return this;
  }

  /**
   * 添加目录存在性检查
   * @param dirPath 目录路径
   * @param errorMessage 目录不存在时的错误消息
   */
  addDirExistsCheck(dirPath: string, errorMessage?: string): this {
    const msg = errorMessage || `Directory ${dirPath} does not exist`;
    this.addIf(`[ ! -d "${dirPath}" ]`, [
      `echo "${msg}" >&2`,
      `exit 1`,
    ]);
    return this;
  }

  /**
   * 创建目录（如果不存在）
   * @param dirPath 目录路径
   * @param parents 是否创建父目录
   */
  createDir(dirPath: string, parents: boolean = true): this {
    const cmd = parents ? `mkdir -p "${dirPath}"` : `mkdir "${dirPath}"`;
    this.lines.push(cmd);
    return this;
  }

  /**
   * 添加 cd 命令（切换目录）
   * @param dirPath 目标目录
   */
  changeDir(dirPath: string): this {
    this.lines.push(`cd "${dirPath}"`);
    return this;
  }

  /**
   * 添加 source 命令
   * @param filePath 要 source 的文件路径
   * @param checkExists 是否检查文件存在
   */
  addSource(filePath: string, checkExists: boolean = true): this {
    if (checkExists) {
      this.lines.push(`[ -s "${filePath}" ] && source "${filePath}"`);
    } else {
      this.lines.push(`source "${filePath}"`);
    }
    return this;
  }

  /**
   * 添加原始内容（不做任何处理）
   * @param content 原始内容
   */
  addRaw(content: string): this {
    this.lines.push(content);
    return this;
  }

  /**
   * 添加多行原始内容
   * @param content 原始内容（多行字符串）
   */
  addRawBlock(content: string): this {
    const lines = content.split("\n");
    this.lines.push(...lines);
    return this;
  }

  /**
   * 构建最终的 shell 脚本
   * @returns 完整的 shell 脚本字符串
   */
  build(): string {
    return this.lines.join("\n") + "\n";
  }

  /**
   * 获取当前行数
   */
  getLineCount(): number {
    return this.lines.length;
  }

  /**
   * 清空所有内容
   */
  clear(): this {
    this.lines = [];
    return this;
  }

  /**
   * 克隆当前构建器
   */
  clone(): ShellScriptBuilder {
    const builder = new ShellScriptBuilder();
    builder.lines = [...this.lines];
    return builder;
  }
}

/**
 * 创建一个新的 ShellScriptBuilder 实例
 * @returns 新的 ShellScriptBuilder 实例
 */
export function createShellScript(): ShellScriptBuilder {
  return new ShellScriptBuilder();
}

/**
 * 创建一个标准的 bash 脚本（带 shebang 和严格模式）
 * @returns 预配置的 ShellScriptBuilder 实例
 */
export function createStandardBashScript(): ShellScriptBuilder {
  return new ShellScriptBuilder().addShebang("bash").setStrictMode();
}

// src/installers/goup-installer.ts

/**
 * Goup (Go Version Manager) 安装器
 *
 * 使用 VersionManagerInstaller 抽象基类实现 Go 语言安装
 */

import { VersionManagerInstaller, VersionManagerConfig } from "../version-manager-installer";
import { logger } from "../logger";

/**
 * Goup 安装器
 */
export class GoupInstaller extends VersionManagerInstaller {
  constructor(version: string = "1.24") {
    const config: VersionManagerConfig = {
      name: "goup",
      toolName: "Go",
      version,
      installDir: "$HOME/.go",
      envVars: {
        GOPATH: "$HOME/go",
        GOROOT: "$HOME/.go",
      },
      paths: [
        "$HOME/.go/bin",
        "$HOME/go/bin",
      ],
    };

    super(config);
  }

  /**
   * 检查 Goup 是否已安装
   */
  protected async checkInstalled(): Promise<boolean> {
    return await this.isCommandAvailable("goup");
  }

  /**
   * 安装 Goup
   */
  protected async installManager(): Promise<void> {
    logger.info("下载并安装 Goup...");

    const script = this.createScriptBuilder()
      .addComment("Install Goup")
      .addCommand('curl -sSf https://raw.githubusercontent.com/owenthereal/goup/master/install.sh | sh -s -- --skip-prompt')
      .addEmptyLine()
      .addComment("Load Goup")
      .exportEnv("GOPATH", "$HOME/go")
      .exportEnv("GOROOT", "$HOME/.go")
      .exportPath("$HOME/.go/bin")
      .exportPath("$HOME/go/bin")
      .addSource("$HOME/.go/env", true)
      .build();

    await this.runScript(script);
    logger.success("Goup 安装完成");
  }

  /**
   * 安装指定版本的 Go
   */
  protected async installVersion(version: string): Promise<void> {
    logger.info(`安装 Go ${version}...`);

    const script = this.createScriptBuilder()
      .exportEnv("GOPATH", "$HOME/go")
      .exportEnv("GOROOT", "$HOME/.go")
      .exportPath("$HOME/.go/bin")
      .exportPath("$HOME/go/bin")
      .addSource("$HOME/.go/env", true)
      .addEmptyLine()
      .addCommand(`goup install ${version}`)
      .addCommand(`goup set ${version}`)
      .build();

    await this.runScript(script);
    logger.success(`Go ${version} 安装完成`);

    // 安装常用 Go 工具
    await this.installCommonTools();
  }

  /**
   * 安装常用 Go 工具
   */
  private async installCommonTools(): Promise<void> {
    logger.info("安装常用 Go 工具...");

    const tools = [
      "golang.org/x/tools/gopls@latest",
      "github.com/go-delve/delve/cmd/dlv@latest",
      "honnef.co/go/tools/cmd/staticcheck@latest",
    ];

    const script = this.createScriptBuilder()
      .exportEnv("GOPATH", "$HOME/go")
      .exportEnv("GOROOT", "$HOME/.go")
      .exportPath("$HOME/.go/bin")
      .exportPath("$HOME/go/bin")
      .addSource("$HOME/.go/env", true)
      .addEmptyLine()
      .addCommands(tools.map(tool => `go install ${tool}`))
      .build();

    try {
      await this.runScript(script);
      logger.success("Go 工具安装完成");
    } catch (error) {
      logger.warn(`部分 Go 工具安装失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 验证安装
   */
  protected async verifyInstallation(): Promise<void> {
    const script = this.createScriptBuilder()
      .exportEnv("GOPATH", "$HOME/go")
      .exportEnv("GOROOT", "$HOME/.go")
      .exportPath("$HOME/.go/bin")
      .exportPath("$HOME/go/bin")
      .addSource("$HOME/.go/env", true)
      .addEmptyLine()
      .addCommand('echo "Go version:"')
      .addCommand("go version")
      .addCommand('echo "Goup version:"')
      .addCommand("goup version")
      .build();

    const output = await this.runScript(script);
    logger.info(`安装验证结果:\n${output}`);

    // 检查是否包含版本信息
    if (!output.includes("go version") || !output.includes("goup")) {
      throw new Error("Go 安装验证失败");
    }
  }
}

/**
 * 快捷安装函数
 */
export async function installGoWithGoup(version: string = "1.24"): Promise<void> {
  const installer = new GoupInstaller(version);
  await installer.install();
}

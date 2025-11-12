// src/installers/nvm-installer.ts

/**
 * NVM (Node Version Manager) 安装器示例
 *
 * 展示如何使用 VersionManagerInstaller 抽象基类
 */

import { VersionManagerInstaller, VersionManagerConfig } from "../version-manager-installer";
import { logger } from "../logger";

/**
 * NVM 安装器
 */
export class NvmInstaller extends VersionManagerInstaller {
  constructor(version: string = "22") {
    const config: VersionManagerConfig = {
      name: "nvm",
      toolName: "Node.js",
      version,
      installDir: "$HOME/.nvm",
      envVars: {
        NVM_DIR: "$HOME/.nvm",
      },
      sourceFiles: [
        { path: "$NVM_DIR/nvm.sh", checkExists: true },
        { path: "$NVM_DIR/bash_completion", checkExists: true },
      ],
    };

    super(config);
  }

  /**
   * 检查 NVM 是否已安装
   */
  protected async checkInstalled(): Promise<boolean> {
    return await this.isCommandAvailable("nvm");
  }

  /**
   * 安装 NVM
   */
  protected async installManager(): Promise<void> {
    logger.info("下载并安装 NVM...");

    const script = this.createScriptBuilder()
      .addComment("Install NVM")
      .addCommand('curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash')
      .addEmptyLine()
      .addComment("Load NVM")
      .exportEnv("NVM_DIR", "$HOME/.nvm")
      .addSource("$NVM_DIR/nvm.sh", true)
      .build();

    await this.runScript(script);
    logger.success("NVM 安装完成");
  }

  /**
   * 安装指定版本的 Node.js
   */
  protected async installVersion(version: string): Promise<void> {
    logger.info(`安装 Node.js ${version}...`);

    const script = this.createScriptBuilder()
      .exportEnv("NVM_DIR", "$HOME/.nvm")
      .addSource("$NVM_DIR/nvm.sh", true)
      .addCommand(`nvm install ${version}`)
      .addCommand(`nvm use ${version}`)
      .addCommand(`nvm alias default ${version}`)
      .build();

    await this.runScript(script);
    logger.success(`Node.js ${version} 安装完成`);

    // 安装常用 Node.js 工具
    await this.installCommonTools();
  }

  /**
   * 安装常用 Node.js 工具
   */
  private async installCommonTools(): Promise<void> {
    logger.info("安装常用 Node.js 工具...");

    const tools = [
      "typescript",
      "ts-node",
      "@types/node",
      "eslint",
      "prettier",
    ];

    const script = this.createScriptBuilder()
      .exportEnv("NVM_DIR", "$HOME/.nvm")
      .addSource("$NVM_DIR/nvm.sh", true)
      .addEmptyLine()
      .addCommand(`npm install -g ${tools.join(" ")}`)
      .build();

    try {
      await this.runScript(script);
      logger.success("Node.js 工具安装完成");
    } catch (error) {
      logger.warn(`部分 Node.js 工具安装失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 验证安装
   */
  protected async verifyInstallation(): Promise<void> {
    const script = this.createScriptBuilder()
      .exportEnv("NVM_DIR", "$HOME/.nvm")
      .addSource("$NVM_DIR/nvm.sh", true)
      .addCommand('echo "Node version:"')
      .addCommand("node --version")
      .addCommand('echo "npm version:"')
      .addCommand("npm --version")
      .build();

    const output = await this.runScript(script);
    logger.info(`安装验证结果:\n${output}`);

    // 检查是否包含版本信息
    if (!output.includes("v") || !output.toLowerCase().includes("node")) {
      throw new Error("Node.js 安装验证失败");
    }
  }
}

/**
 * 快捷安装函数
 */
export async function installNodeWithNvm(version: string = "22"): Promise<void> {
  const installer = new NvmInstaller(version);
  await installer.install();
}

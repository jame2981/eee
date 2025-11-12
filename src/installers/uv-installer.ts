// src/installers/uv-installer.ts

/**
 * UV (Python Package Manager) 安装器
 *
 * 使用 VersionManagerInstaller 抽象基类实现 Python 安装
 */

import { VersionManagerInstaller, VersionManagerConfig } from "../version-manager-installer";
import { logger } from "../logger";

/**
 * UV 安装器
 */
export class UvInstaller extends VersionManagerInstaller {
  constructor(version: string = "3.13") {
    const config: VersionManagerConfig = {
      name: "uv",
      toolName: "Python",
      version,
      installDir: "$HOME/.local",
      envVars: {
        UV_PYTHON_INSTALL_DIR: "$HOME/.local/share/uv/python",
      },
      paths: [
        "$HOME/.local/bin",
      ],
      sourceFiles: [
        { path: "$HOME/.local/share/uv/env", checkExists: true },
      ],
    };

    super(config);
  }

  /**
   * 检查 UV 是否已安装
   */
  protected async checkInstalled(): Promise<boolean> {
    return await this.isCommandAvailable("uv");
  }

  /**
   * 安装 UV
   */
  protected async installManager(): Promise<void> {
    logger.info("下载并安装 UV...");

    const script = this.createScriptBuilder()
      .addComment("Install UV")
      .addCommand('curl -LsSf https://astral.sh/uv/install.sh | sh')
      .addEmptyLine()
      .addComment("Load UV")
      .exportPath("$HOME/.local/bin")
      .exportEnv("UV_PYTHON_INSTALL_DIR", "$HOME/.local/share/uv/python")
      .build();

    await this.runScript(script);
    logger.success("UV 安装完成");
  }

  /**
   * 安装指定版本的 Python
   */
  protected async installVersion(version: string): Promise<void> {
    logger.info(`安装 Python ${version}...`);

    const script = this.createScriptBuilder()
      .exportPath("$HOME/.local/bin")
      .exportEnv("UV_PYTHON_INSTALL_DIR", "$HOME/.local/share/uv/python")
      .addEmptyLine()
      .addComment(`Install Python ${version}`)
      .addCommand(`uv python install ${version}`)
      .addCommand(`uv python pin ${version}`)
      .build();

    await this.runScript(script);
    logger.success(`Python ${version} 安装完成`);

    // 安装常用 Python 工具
    await this.installCommonTools();
  }

  /**
   * 安装常用 Python 工具
   */
  private async installCommonTools(): Promise<void> {
    logger.info("安装常用 Python 工具...");

    const tools = [
      "pip",
      "setuptools",
      "wheel",
      "ipython",
      "black",
      "ruff",
    ];

    const script = this.createScriptBuilder()
      .exportPath("$HOME/.local/bin")
      .exportEnv("UV_PYTHON_INSTALL_DIR", "$HOME/.local/share/uv/python")
      .addEmptyLine()
      .addCommand(`uv tool install ${tools.join(" ")}`)
      .build();

    try {
      await this.runScript(script);
      logger.success("Python 工具安装完成");
    } catch (error) {
      logger.warn(`部分 Python 工具安装失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 验证安装
   */
  protected async verifyInstallation(): Promise<void> {
    const script = this.createScriptBuilder()
      .exportPath("$HOME/.local/bin")
      .exportEnv("UV_PYTHON_INSTALL_DIR", "$HOME/.local/share/uv/python")
      .addEmptyLine()
      .addCommand('echo "Python version:"')
      .addCommand("uv python list")
      .addCommand('echo "UV version:"')
      .addCommand("uv --version")
      .build();

    const output = await this.runScript(script);
    logger.info(`安装验证结果:\n${output}`);

    // 检查是否包含版本信息
    if (!output.includes("python") || !output.includes("uv")) {
      throw new Error("Python 安装验证失败");
    }
  }
}

/**
 * 快捷安装函数
 */
export async function installPythonWithUv(version: string = "3.13"): Promise<void> {
  const installer = new UvInstaller(version);
  await installer.install();
}

#!/usr/bin/env bun

/**
 * pkgs/golang1.24/install.ts
 *
 * Go 1.23.4 安装脚本
 * 使用 goup 版本管理器安装
 */

import {
  getCurrentUser,
  getUserHome,
  curlInstall,
  runAsUserScript,
  runAsUserWithEnv,
  createUserDir,
  testUserCommand,
  verifyCommand,
  getCommandVersion,
  writeUserFile,
  tryExecute
} from "@/pkg-utils";

import { logger } from "@/logger";

export default async function install(): Promise<void> {
  logger.info("🐹 开始安装 Go 1.23.4 (使用 goup)...");

  const currentUser = getCurrentUser();
  const userHome = getUserHome(currentUser);
  const goupRoot = `${userHome}/.go`;
  const goPath = `${userHome}/go`;

  logger.info(`==> 为用户 ${currentUser} 安装`);

  try {
    // 1. 安装 goup (Go 版本管理器)
    logger.info("==> 安装 goup (Go 版本管理器)...");

    if (!await testUserCommand("goup", currentUser)) {
      await runAsUserScript(
        `curl -sSf https://raw.githubusercontent.com/owenthereal/goup/master/install.sh | sh`,
        currentUser
      );

      // 添加 goup 环境变量到 .bashrc
      const goupEnvContent = `# goup Go version manager
export GOUP_ROOT="$HOME/.go"
export PATH="$GOUP_ROOT/bin:$PATH"
`;

      const bashrcPath = `${userHome}/.bashrc`;
      const bashrcExists = await tryExecute(
        async () => {
          const content = await Bun.file(bashrcPath).text();
          return !content.includes("GOUP_ROOT");
        },
        async () => true
      );

      if (bashrcExists) {
        await runAsUserScript(`echo '${goupEnvContent}' >> ${bashrcPath}`, currentUser);
      }

      logger.success("✅ goup 安装完成");
    } else {
      logger.info("==> goup 已安装，跳过安装步骤");
    }

    // 2. 使用 goup 安装 Go 1.23.4
    logger.info("==> 使用 goup 安装 Go 1.23.4...");

    const installGoScript = `
      export GOUP_ROOT='${goupRoot}'
      export PATH='$GOUP_ROOT/bin:$PATH'
      goup install 1.23.4
      goup use 1.23.4
    `;

    await runAsUserScript(installGoScript, currentUser);

    // 3. 创建 GOPATH 目录结构
    logger.info("==> 创建 GOPATH 目录结构...");
    await createUserDir(`${goPath}/bin`, currentUser);
    await createUserDir(`${goPath}/pkg`, currentUser);
    await createUserDir(`${goPath}/src`, currentUser);

    // 4. 添加 Go 环境变量
    logger.info("==> 配置 Go 环境变量...");

    const goEnvContent = `
# Go 1.23.4 环境配置
export GOUP_ROOT='${goupRoot}'
export PATH='$GOUP_ROOT/bin:$PATH'
export GOPATH='${goPath}'
export PATH='$GOPATH/bin:$PATH'
`;

    const bashrcPath = `${userHome}/.bashrc`;
    const needsGoEnv = await tryExecute(
      async () => {
        const content = await Bun.file(bashrcPath).text();
        return !content.includes("Go 1.23.4 环境配置");
      },
      async () => true
    );

    if (needsGoEnv) {
      await runAsUserScript(`echo '${goEnvContent}' >> ${bashrcPath}`, currentUser);
    }

    // 5. 验证 Go 安装
    logger.info("==> 验证 Go 安装...");

    const verifyScript = `
      export GOUP_ROOT='${goupRoot}'
      export PATH='$GOUP_ROOT/bin:$PATH'
      export GOPATH='${goPath}'
      export PATH='$GOPATH/bin:$PATH'
      echo "Go version: $(go version)"
      echo "GOPATH: $(go env GOPATH)"
      echo "GOROOT: $(go env GOROOT)"
    `;

    const versionInfo = await runAsUserScript(verifyScript, currentUser);

    // 6. 安装常用 Go 工具
    logger.info("==> 安装常用 Go 开发工具...");

    const goTools = [
      "golang.org/x/tools/gopls@latest",          // Language Server
      "github.com/golangci/golangci-lint/cmd/golangci-lint@latest",  // Linter
      "golang.org/x/tools/cmd/goimports@latest",  // Import formatter
      "github.com/air-verse/air@latest"           // Live reload
    ];

    for (const tool of goTools) {
      await tryExecute(
        async () => {
          const installToolScript = `
            export GOUP_ROOT='${goupRoot}'
            export PATH='$GOUP_ROOT/bin:$PATH'
            export GOPATH='${goPath}'
            export PATH='$GOPATH/bin:$PATH'
            go install ${tool}
          `;
          await runAsUserScript(installToolScript, currentUser);
          logger.info(`  > 安装工具: ${tool}`);
        },
        undefined,
        `安装 Go 工具 ${tool} 失败`
      );
    }

    logger.success("✅ Go 1.23.4 安装和配置完成!");
    versionInfo.trim().split('\n').forEach(line => {
      if (line.trim()) {
        logger.info(`  > ${line.trim()}`);
      }
    });

  } catch (error) {
    logger.error(`❌ Go 安装失败: ${error.message}`);
    throw error;
  }
}
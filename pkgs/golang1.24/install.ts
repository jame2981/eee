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
  tryExecute,
  logger
} from "@/pkg-utils";

import {
  initializeEeeEnv,
  insertPath,
  addEnvironmentVariable
} from "@/env-utils";

export default async function install(): Promise<void> {
  logger.info("🐹 开始安装 Go 1.24.3 (使用 goup)...");

  const currentUser = getCurrentUser();
  const userHome = getUserHome(currentUser);
  const goupRoot = `${userHome}/.go`;
  const goPath = `${userHome}/go`;

  logger.info(`==> 为用户 ${currentUser} 安装`);

  try {
    // 1. 安装 goup (Go 版本管理器)
    logger.info("==> 安装 goup (Go 版本管理器)...");

    if (!await testUserCommand("goup", currentUser)) {
      // 手动安装goup，绕过官方脚本的TTY检查
      const goupInstallScript = `#!/bin/bash
# 设置非交互式环境
export DEBIAN_FRONTEND=noninteractive

echo "开始手动安装 goup..."

# 创建 goup 目录
mkdir -p "$HOME/.go/bin"

# 直接下载 goup 二进制文件
echo "下载 goup v0.7.0 for linux-amd64..."
curl -L "https://github.com/owenthereal/goup/releases/download/v0.7.0/linux-amd64" -o "$HOME/.go/bin/goup"

# 设置执行权限
chmod +x "$HOME/.go/bin/goup"

# 验证下载成功
if [ -f "$HOME/.go/bin/goup" ] && [ -x "$HOME/.go/bin/goup" ]; then
  echo "✅ goup 二进制文件下载并安装成功"
  echo "goup 路径: $HOME/.go/bin/goup"
  echo "文件大小: $(ls -lh $HOME/.go/bin/goup | awk '{print $5}')"
else
  echo "❌ goup 安装失败"
  exit 1
fi`;

      await runAsUserScript(goupInstallScript, currentUser);

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

    // 2. 使用 goup 安装 Go 1.24.3
    logger.info("==> 使用 goup 安装 Go 1.24.3...");

    const installGoScript = `set -e
      export GOUP_ROOT='${goupRoot}'
      export PATH="\$GOUP_ROOT/bin:\$PATH"

      # 重新加载环境变量
      if [ -f ~/.bashrc ]; then
        source ~/.bashrc
      fi

      echo "开始使用goup安装Go 1.24.3..."
      # 使用绝对路径调用goup安装Go 1.24.3
      echo "执行: goup install 1.24.3"
      "\$GOUP_ROOT/bin/goup" install 1.24.3
      echo "执行: goup set 1.24.3"
      "\$GOUP_ROOT/bin/goup" set 1.24.3
      echo "goup安装完成"
    `;

    const installResult = await runAsUserScript(installGoScript, currentUser);

    logger.info("==> Go安装脚本执行结果:");
    installResult.split('\n').forEach(line => {
      if (line.trim()) {
        logger.info(`    ${line.trim()}`);
      }
    });

    // 3. 创建 GOPATH 目录结构
    logger.info("==> 创建 GOPATH 目录结构...");
    await createUserDir(`${goPath}/bin`, currentUser);
    await createUserDir(`${goPath}/pkg`, currentUser);
    await createUserDir(`${goPath}/src`, currentUser);

    // 4. 配置 Go 环境变量到统一的 ~/.eee-env
    logger.info("==> 配置 Go 环境变量...");

    try {
      // 初始化 eee-env 环境
      await initializeEeeEnv();

      // 添加 Go 环境变量
      await addEnvironmentVariable("GOUP_ROOT", goupRoot, "Go Version Manager 安装目录");
      await addEnvironmentVariable("GOPATH", goPath, "Go 工作空间路径");
      await addEnvironmentVariable("GOROOT", "$GOUP_ROOT/current", "Go 根目录 (goup管理的当前版本)");

      // 添加 Go PATH 配置
      await insertPath("$GOUP_ROOT/bin", "Go Version Manager - goup 二进制路径");
      await insertPath("$GOPATH/bin", "Go 工作空间 - 编译后的二进制文件路径");
      await insertPath("$GOUP_ROOT/current/bin", "Go 当前版本 - Go 工具链路径");

      logger.success("✅ Go 环境配置完成");
    } catch (error) {
      logger.warn(`⚠️ 环境变量配置失败: ${error.message}`);
      logger.info("💡 提示: Go 仍可通过 goup 正常使用");
    }

    // 5. 调试goup目录结构
    logger.info("==> 调试goup目录结构...");

    const debugScript = `
      export GOUP_ROOT='${goupRoot}'
      echo "=== GOUP_ROOT 目录结构 ==="
      ls -la '${goupRoot}' || echo "GOUP_ROOT目录不存在"
      echo
      echo "=== 递归查看.go目录结构 ==="
      find '${goupRoot}' -type d 2>/dev/null | head -20 || echo "无法遍历目录"
      echo
      echo "=== 查找go二进制文件 ==="
      find '${goupRoot}' -name "go" -type f -executable 2>/dev/null || echo "未找到go二进制文件"
      echo
      echo "=== goup list命令测试 ==="
      export PATH='$GOUP_ROOT/bin:$PATH'
      '$GOUP_ROOT/bin/goup' list || echo "goup list命令失败"
    `;

    await runAsUserScript(debugScript, currentUser);

    // 6. 验证 Go 安装
    logger.info("==> 验证 Go 安装...");

    const verifyScript = `
      export GOUP_ROOT='${goupRoot}'
      export PATH='$GOUP_ROOT/bin:$PATH'
      export GOPATH='${goPath}'
      export PATH='$GOPATH/bin:$PATH'
      # goup管理的当前Go版本路径 (类似nvm的current链接)
      export PATH='$GOUP_ROOT/current/bin:$PATH'
      export GOROOT='$GOUP_ROOT/current'
      echo "Go version: $(go version)"
      echo "GOPATH: $(go env GOPATH)"
      echo "GOROOT: $(go env GOROOT)"
    `;

    const versionInfo = await runAsUserScript(verifyScript, currentUser);

    // 7. 安装常用 Go 工具
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
            # goup管理的当前Go版本路径 (类似nvm的current链接)
            export PATH='$GOUP_ROOT/current/bin:$PATH'
            export GOROOT='$GOUP_ROOT/current'
            go install ${tool}
          `;
          await runAsUserScript(installToolScript, currentUser);
          logger.info(`  > 安装工具: ${tool}`);
        },
        undefined,
        `安装 Go 工具 ${tool} 失败`
      );
    }

    logger.success("✅ Go 1.24.3 安装和配置完成!");
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
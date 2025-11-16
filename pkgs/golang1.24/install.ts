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
  downloadGithubRelease,
  logger,
  type DownloadOptions
} from "../../src/pkg-utils";

import {
  initializeEeeEnv,
  insertPath,
  addEnvironmentVariable
} from "../../src/env-utils";

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
      // 使用新的下载工具安装 goup，带超时和重试
      logger.info("==> 下载 goup 二进制文件...");

      const goupBinPath = `${goupRoot}/bin/goup`;

      // 创建目录
      await createUserDir(`${goupRoot}/bin`, currentUser);

      // 使用新的 downloadGithubRelease 函数，带超时和重试
      try {
        const tmpFile = `/tmp/goup-${Date.now()}`;
        await downloadGithubRelease(
          "owenthereal/goup",
          "v0.7.0",
          "linux-amd64",
          tmpFile,
          {
            timeout: 120,  // 2 分钟超时
            maxRetries: 3,
            showProgress: true
          }
        );

        // 移动到目标位置并设置权限（以用户身份）
        const installScript = `
mv "${tmpFile}" "${goupBinPath}"
chmod +x "${goupBinPath}"

# 验证下载成功
if [ -f "${goupBinPath}" ] && [ -x "${goupBinPath}" ]; then
  echo "✅ goup 二进制文件下载并安装成功"
  echo "goup 路径: ${goupBinPath}"
  echo "文件大小: $(ls -lh ${goupBinPath} | awk '{print $5}')"
else
  echo "❌ goup 安装失败"
  exit 1
fi`;

        await runAsUserScript(installScript, currentUser);
      } catch (error) {
        throw new Error(`goup 下载失败: ${error instanceof Error ? error.message : String(error)}\n提示: 检查网络连接或使用代理`);
      }

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

    // 4. 调试goup目录结构并寻找实际的Go安装路径
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
      export PATH="$GOUP_ROOT/bin:$PATH"
      "$GOUP_ROOT/bin/goup" list || echo "goup list命令失败"
    `;

    await runAsUserScript(debugScript, currentUser);

    // 6. 获取实际的Go版本路径并验证安装
    logger.info("==> 获取实际Go安装路径并验证...");

    const getGoPathScript = `
      export GOUP_ROOT='${goupRoot}'
      export PATH="$GOUP_ROOT/bin:$PATH"

      echo "开始查找 Go 安装路径..."

      # 方法1：通过 goup show 获取当前版本（使用绝对路径）
      CURRENT_GO_VERSION=\$("$GOUP_ROOT/bin/goup" show 2>/dev/null | grep "current" | awk '{print \$2}' 2>/dev/null || echo "")

      if [ -n "\$CURRENT_GO_VERSION" ]; then
        echo "找到当前Go版本: \$CURRENT_GO_VERSION"
        GO_VERSION_PATH="$GOUP_ROOT/\$CURRENT_GO_VERSION"
        if [ -f "\$GO_VERSION_PATH/bin/go" ]; then
          echo "GO_INSTALL_PATH:\$GO_VERSION_PATH"
          export PATH="\$GO_VERSION_PATH/bin:\$PATH"
          export GOROOT="\$GO_VERSION_PATH"
        else
          echo "⚠️  Go版本路径不存在: \$GO_VERSION_PATH"
        fi
      else
        echo "未通过goup show获取版本，尝试直接查找..."
        # 方法2：查找1.24.x版本目录
        for version_dir in \$(find "$GOUP_ROOT" -maxdepth 2 -name "1.24.*" -type d 2>/dev/null); do
          if [ -f "\$version_dir/bin/go" ]; then
            echo "找到Go安装目录: \$version_dir"
            echo "GO_INSTALL_PATH:\$version_dir"
            export PATH="\$version_dir/bin:\$PATH"
            export GOROOT="\$version_dir"
            break
          fi
        done

        # 方法3：查找current符号链接
        if [ -L "$GOUP_ROOT/current" ] && [ -f "$GOUP_ROOT/current/bin/go" ]; then
          CURRENT_REAL_PATH=\$(readlink -f "$GOUP_ROOT/current")
          echo "找到current链接指向: \$CURRENT_REAL_PATH"
          echo "GO_INSTALL_PATH:\$CURRENT_REAL_PATH"
          export PATH="\$CURRENT_REAL_PATH/bin:\$PATH"
          export GOROOT="\$CURRENT_REAL_PATH"
        fi
      fi

      # 验证Go命令
      echo "验证Go环境..."
      if command -v go >/dev/null 2>&1; then
        echo "✅ Go version: \$(go version)"
        echo "✅ GOPATH: \$(go env GOPATH)"
        echo "✅ GOROOT: \$(go env GOROOT)"
      else
        echo "❌ Go 命令仍然不可用"
        echo "当前PATH: \$PATH"
        echo "查找go二进制文件:"
        find '$GOUP_ROOT' -name "go" -type f -executable 2>/dev/null | head -5
      fi
    `;

    const goPathInfo = await runAsUserScript(getGoPathScript, currentUser);

    // 6. 从 goPathInfo 中提取实际的Go安装路径并配置环境变量
    let actualGoPath = "";
    const pathMatch = goPathInfo.match(/GO_INSTALL_PATH:([^\n\r]+)/);
    if (pathMatch) {
      actualGoPath = pathMatch[1].trim();
      logger.info(`找到实际Go安装路径: ${actualGoPath}`);
    }

    logger.info("==> 配置 Go 环境变量...");

    try {
      // 初始化 eee-env 环境
      await initializeEeeEnv();

      // 添加 Go 环境变量
      await addEnvironmentVariable("GOUP_ROOT", goupRoot, "Go Version Manager 安装目录");
      await addEnvironmentVariable("GOPATH", goPath, "Go 工作空间路径");

      // 根据实际检测到的Go路径配置
      if (actualGoPath) {
        await addEnvironmentVariable("GOROOT", actualGoPath, "Go 根目录 (实际检测路径)");
        logger.info(`使用实际检测的Go路径: ${actualGoPath}`);
      } else {
        await addEnvironmentVariable("GOROOT", "$GOUP_ROOT/current", "Go 根目录 (goup管理的当前版本)");
        logger.warn("未检测到实际Go路径，使用默认路径");
      }

      // 添加 Go PATH 配置
      await insertPath("$GOUP_ROOT/bin", "Go Version Manager - goup 二进制路径");
      await insertPath("$GOPATH/bin", "Go 工作空间 - 编译后的二进制文件路径");

      if (actualGoPath) {
        await insertPath(`${actualGoPath}/bin`, "Go 当前版本 - Go 工具链路径 (实际路径)");
      } else {
        await insertPath("$GOUP_ROOT/current/bin", "Go 当前版本 - Go 工具链路径 (默认路径)");
      }

      logger.success("✅ Go 环境配置完成");
    } catch (error) {
      logger.warn(`⚠️ 环境变量配置失败: ${error.message}`);
      logger.info("💡 提示: Go 仍可通过 goup 正常使用");
    }

    // 7. 安装常用 Go 开发工具 (使用之前已经获取的 actualGoPath)
    logger.info("==> 安装常用 Go 开发工具...");

    const goTools = [
      "golang.org/x/tools/gopls@latest",          // Language Server
      "github.com/golangci/golangci-lint/cmd/golangci-lint@latest",  // Linter
      "golang.org/x/tools/cmd/goimports@latest",  // Import formatter
      "github.com/air-verse/air@latest"           // Live reload
    ];

    // 安装工具前先验证Go环境可用性
    logger.info("==> 预验证 Go 环境可用性...");

    const preCheckScript = `
      # 加载 EEE 环境变量（如果存在）
      if [ -f ~/.eee-env ]; then
        source ~/.eee-env
        echo "✅ 加载了 EEE 环境变量"
      fi

      export GOUP_ROOT='${goupRoot}'
      export PATH="$GOUP_ROOT/bin:$PATH"
      export GOPATH='${goPath}'

      # 使用检测到的实际Go路径
      if [ -n '${actualGoPath}' ] && [ -f '${actualGoPath}/bin/go' ]; then
        echo "使用实际Go路径: ${actualGoPath}"
        export PATH="${actualGoPath}/bin:$PATH"
        export GOROOT='${actualGoPath}'
      else
        echo "回退到默认路径配置"
        export PATH="$GOUP_ROOT/current/bin:$PATH"
        export GOROOT="$GOUP_ROOT/current"
      fi

      echo "当前环境验证:"
      echo "GOUP_ROOT: $GOUP_ROOT"
      echo "GOROOT: $GOROOT"
      echo "GOPATH: $GOPATH"
      echo "PATH: $PATH"

      if command -v go >/dev/null 2>&1; then
        echo "✅ Go 命令可用: $(go version)"
        echo "✅ Go 环境检查: $(go env GOROOT)"
        echo "GO_READY=true"
      else
        echo "❌ Go 命令不可用，无法安装工具"
        echo "GO_READY=false"
      fi
    `;

    const preCheckResult = await runAsUserScript(preCheckScript, currentUser);

    if (preCheckResult.includes("GO_READY=true")) {
      logger.success("✅ Go 环境验证成功，开始安装工具");

      for (const tool of goTools) {
        await tryExecute(
          async () => {
            // 确保 actualGoPath 变量正确传递到脚本中
            const goRoot = actualGoPath || `${goupRoot}/current`;
            const goBinPath = actualGoPath ? `${actualGoPath}/bin` : `${goupRoot}/current/bin`;

            const installToolScript = `
              # 加载 EEE 环境变量（如果存在）
              if [ -f ~/.eee-env ]; then
                source ~/.eee-env
                echo "✅ 加载了 EEE 环境变量"
              fi

              export GOUP_ROOT='${goupRoot}'
              export GOPATH='${goPath}'
              export GOROOT='${goRoot}'

              # 设置完整的PATH（按优先级排序）
              export PATH="${goBinPath}:${goPath}/bin:${goupRoot}/bin:$PATH"

              echo "安装工具: ${tool}"
              echo "GOUP_ROOT: $GOUP_ROOT"
              echo "GOROOT: $GOROOT"
              echo "GOPATH: $GOPATH"
              echo "Go 二进制路径: ${goBinPath}"
              echo "PATH: $PATH"

              # 验证Go命令可用
              if command -v go >/dev/null 2>&1; then
                echo "✅ Go 版本: $(go version)"
                echo "✅ Go GOROOT: $(go env GOROOT)"
                echo "开始安装工具: ${tool}"
                go install ${tool}
                echo "✅ 工具安装完成: ${tool}"
              else
                echo "❌ Go 命令不可用"
                echo "调试信息:"
                echo "检查 Go 二进制文件:"
                ls -la '${goBinPath}/go' 2>/dev/null || echo "Go 二进制文件不存在: ${goBinPath}/go"
                ls -la '${goupRoot}/current' 2>/dev/null || echo "current 目录不存在"
                find '${goupRoot}' -name 'go' -type f -executable 2>/dev/null | head -3
                echo "当前 PATH: $PATH"
                exit 1
              fi
            `;
            await runAsUserScript(installToolScript, currentUser);
            logger.info(`  ✅ 安装工具: ${tool}`);
          },
          undefined,
          `安装 Go 工具 ${tool} 失败`
        );
      }
    } else {
      logger.warn("⚠️ Go 环境验证失败，跳过工具安装");
      logger.info("💡 提示: Go 基础环境已安装，工具可稍后手动安装");
    }

    // 8. 最终验证安装
    logger.info("==> 最终验证 Go 安装和环境配置...");

    const finalVerifyScript = `
      export GOUP_ROOT='${goupRoot}'
      export PATH="$GOUP_ROOT/bin:$PATH"
      export GOPATH='${goPath}'

      # 使用检测到的实际Go路径
      if [ -n '${actualGoPath}' ] && [ -f '${actualGoPath}/bin/go' ]; then
        echo "使用实际Go路径: ${actualGoPath}"
        export PATH="${actualGoPath}/bin:$PATH"
        export GOROOT='${actualGoPath}'
      else
        echo "回退到默认路径配置"
        export PATH="$GOUP_ROOT/current/bin:$PATH"
        export GOROOT='$GOUP_ROOT/current'
      fi

      echo "当前环境变量:"
      echo "GOUP_ROOT: $GOUP_ROOT"
      echo "GOROOT: $GOROOT"
      echo "GOPATH: $GOPATH"
      echo "PATH: $PATH"

      echo
      echo "Go版本验证:"
      if command -v go >/dev/null 2>&1; then
        echo "✅ Go 可执行: $(go version)"
        echo "✅ GOENV检查: $(go env GOROOT)"
        echo "✅ GOPATH检查: $(go env GOPATH)"
      else
        echo "❌ Go 命令不可用"
        echo "调试信息:"
        echo "goup状态: $(goup list 2>/dev/null || echo '无法调用goup')"
        find "$GOUP_ROOT" -name 'go' -type f 2>/dev/null | head -5 || echo "无法找到go二进制文件"
      fi
    `;

    const versionInfo = await runAsUserScript(finalVerifyScript, currentUser);

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
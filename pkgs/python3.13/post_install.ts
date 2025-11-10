#!/usr/bin/env bun

/**
 * pkgs/python3.13/post_install.ts
 *
 * Python 3.13 后置配置脚本
 * 使用 pkg-utils 简化配置过程
 */

import {
  getCurrentUser,
  getUserHome,
  createUserDir,
  writeConfigTemplate,
  runAsUserScript,
  tryExecute
} from "@/pkg-utils";

import { logger } from "@/logger";

export default async function postInstall(): Promise<void> {
  logger.info("🐍 开始配置 Python 3.13 环境...");

  const currentUser = getCurrentUser();
  const userHome = getUserHome(currentUser);

  try {
    // 1. 验证 Python 3.13 安装
    logger.info("🔍 验证 Python 3.13 安装...");

    const pythonVersion = await runAsUserScript("python3.13 --version", currentUser);
    const pipVersion = await runAsUserScript("pip3.13 --version", currentUser);

    logger.success("✅ Python 3.13 验证成功");
    logger.info(`  > ${pythonVersion.trim()}`);
    logger.info(`  > ${pipVersion.trim()}`);

    // 2. 配置用户级 pip
    logger.info("⚙️ 配置用户级 pip 环境...");

    const pipConfigDir = `${userHome}/.config/pip`;
    await createUserDir(pipConfigDir, currentUser);

    const pipConfig = `[global]
index-url = https://pypi.tuna.tsinghua.edu.cn/simple/
trusted-host = pypi.tuna.tsinghua.edu.cn
timeout = 60

[install]
user = true
`;

    await writeConfigTemplate(
      {
        files: {
          ".config/pip/pip.conf": pipConfig
        }
      },
      "pip",
      currentUser
    );

    // 3. 安装和配置 uv 包管理器
    logger.info("⚡ 安装 uv 包管理器...");

    await tryExecute(
      async () => {
        await runAsUserScript(
          `curl -LsSf https://astral.sh/uv/install.sh | sh`,
          currentUser
        );
        logger.success("✅ uv 安装完成");
      },
      undefined,
      "uv 安装失败，将使用 pip"
    );

    // 4. 安装基础开发工具包
    logger.info("📦 安装 Python 开发工具...");

    const devPackages = [
      "black",      // 代码格式化
      "ruff",       // 现代 linter
      "mypy",       // 类型检查
      "pytest",     // 测试框架
      "pytest-cov", // 测试覆盖率
      "jupyter",    // 交互式开发
      "ipython",    // 增强 Python shell
      "httpx",      // 现代 HTTP 库
      "rich",       // 终端美化
      "typer"       // CLI 框架
    ];

    for (const pkg of devPackages) {
      await tryExecute(
        async () => {
          // 优先使用 uv，回退到 pip
          const uvPath = `${userHome}/.cargo/bin`;
          const installScript = `
            export PATH="${uvPath}:$PATH"
            if command -v uv >/dev/null 2>&1; then
              uv pip install --user ${pkg}
            else
              pip3.13 install --user ${pkg}
            fi
          `;
          await runAsUserScript(installScript, currentUser);
          logger.info(`  ✓ 已安装 ${pkg}`);
        },
        undefined,
        `安装 ${pkg} 失败`
      );
    }

    // 5. 创建 Python 开发配置文件
    logger.info("📝 创建 Python 开发别名和函数...");

    const configTemplate = {
      aliases: {
        // Python 基础别名
        "py": "python3.13",
        "py3": "python3.13",
        "python": "python3.13",
        "pip": "pip3.13",
        "pip3": "pip3.13",

        // 虚拟环境管理
        "venv": "python3.13 -m venv",
        "activate": "source venv/bin/activate",

        // uv 包管理
        "uv-install": "uv pip install",
        "uv-uninstall": "uv pip uninstall",
        "uv-list": "uv pip list",
        "uv-freeze": "uv pip freeze",

        // 开发工具
        "pyformat": "black .",
        "pylint": "ruff check .",
        "pyfix": "ruff check --fix .",
        "pytest": "python3.13 -m pytest",
        "pytest-cov": "python3.13 -m pytest --cov=.",
        "jupyter": "python3.13 -m jupyter",
        "ipython": "python3.13 -m IPython"
      },

      functions: {
        "pyvenv": `
    if [ -z "$1" ]; then
        echo "Usage: pyvenv <env_name>"
        return 1
    fi
    python3.13 -m venv "$1"
    source "$1/bin/activate"
    pip install --upgrade pip
    echo "Virtual environment '$1' created and activated!"`,

        "pyproject": `
    if [ -z "$1" ]; then
        echo "Usage: pyproject <project_name>"
        return 1
    fi

    mkdir -p "$1"
    cd "$1"
    python3.13 -m venv venv
    source venv/bin/activate
    pip install --upgrade pip

    # 创建基础文件
    touch main.py requirements.txt README.md

    cat > .gitignore << 'EOF'
__pycache__/
*.pyc
*.pyo
*.pyd
.Python
venv/
.venv/
env/
.env
*.egg-info/
.pytest_cache/
.coverage
.mypy_cache/
EOF

    echo "Project '$1' created with virtual environment!"`,

        "pyinfo": `
    echo "🐍 Python Environment Information"
    echo "================================="
    echo "Python Version: $(python3.13 --version)"
    echo "pip Version: $(pip3.13 --version)"
    echo "Python Path: $(which python3.13)"
    echo "Virtual Environment: \${VIRTUAL_ENV:-Not activated}"
    echo "User Site Packages: $(python3.13 -c 'import site; print(site.USER_SITE)')"
    echo ""
    echo "📦 Installed Packages (user):"
    pip3.13 list --user`,

        "pyclean": `
    echo "🧹 Cleaning Python cache files..."
    find . -type f -name "*.pyc" -delete
    find . -type d -name "__pycache__" -exec rm -rf {} +
    find . -type f -name "*.pyo" -delete
    find . -type d -name "*.egg-info" -exec rm -rf {} +
    find . -type d -name ".pytest_cache" -exec rm -rf {} +
    find . -type d -name ".mypy_cache" -exec rm -rf {} +
    echo "✅ Python cache cleaned!"`
      },

      environment: {
        "PYTHON_VERSION": "3.13",
        "PYTHONDONTWRITEBYTECODE": "1",
        "PYTHONUNBUFFERED": "1",
        "PYTHONIOENCODING": "UTF-8",
        "UV_PYTHON": "python3.13",
        "UV_INDEX_URL": "https://pypi.tuna.tsinghua.edu.cn/simple/",
        "UV_CACHE_DIR": "$HOME/.cache/uv",
        "JUPYTER_CONFIG_DIR": "$HOME/.jupyter",
        "JUPYTER_DATA_DIR": "$HOME/.local/share/jupyter",
        "RUFF_CACHE_DIR": "$HOME/.cache/ruff"
      }
    };

    await writeConfigTemplate(configTemplate, "python", currentUser);

    // 6. 配置 Jupyter（如果已安装）
    await tryExecute(
      async () => {
        await runAsUserScript("jupyter --config-dir", currentUser);
        logger.success("✅ Jupyter 配置目录已创建");
      },
      undefined,
      "Jupyter 配置跳过"
    );

    // 7. 最终验证
    logger.info("🔍 最终验证...");

    const userPackages = await runAsUserScript(
      "pip3.13 list --user | head -10",
      currentUser
    );

    logger.success("🎉 Python 3.13 环境配置完成！");
    logger.info("📦 已安装的用户级包（前10个）:");
    userPackages.trim().split('\n').forEach(line => {
      if (line.trim() && !line.includes('Package') && !line.includes('---')) {
        logger.info(`  > ${line.trim()}`);
      }
    });

    logger.info("💡 建议在 shell 配置文件中添加:");
    logger.info(`   source ${userHome}/.python_aliases`);
    logger.info(`   source ${userHome}/.python_functions`);
    logger.info(`   source ${userHome}/.python_env`);

  } catch (error) {
    logger.error(`❌ Python 3.13 配置过程中出现错误: ${error.message}`);
    throw error;
  }
}
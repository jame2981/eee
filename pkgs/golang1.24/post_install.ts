#!/usr/bin/env bun

/**
 * pkgs/golang1.24/post_install.ts
 *
 * Go 1.23.4 后置安装脚本（使用 goup 管理）：
 * 1. 验证 goup 和 Go 1.23.4 安装
 * 2. 安装常用的 Go 开发工具
 * 3. 创建 Go 开发别名和函数
 * 4. 配置开发环境优化
 */

import { $ } from "bun";
import { existsSync } from "fs";
import { logger } from "../../src/logger";

// Handle sudo environment - use the real user, not root
const CURRENT_USER = process.env.REAL_USER || process.env.SUDO_USER || process.env.USER || process.env.LOGNAME || "root";
const HOME_DIR = process.env.REAL_HOME || process.env.HOME || `/home/${CURRENT_USER}`;

async function main() {
  try {
    logger.info("🐹 开始配置 Go 1.23.4 环境（使用 goup）...");

    // 1. 验证安装
    logger.info("🔍 验证 goup 和 Go 1.23.4 安装...");

    try {
      const goupVersion = await $`sudo -u ${CURRENT_USER} bash -c "
        export GOUP_ROOT='${HOME_DIR}/.go'
        export PATH='\$GOUP_ROOT/bin:\$PATH'
        goup version
      "`.text();

      const goVersion = await $`sudo -u ${CURRENT_USER} bash -c "
        export GOUP_ROOT='${HOME_DIR}/.go'
        export PATH='\$GOUP_ROOT/bin:\$PATH'
        go version
      "`.text();

      const goupList = await $`sudo -u ${CURRENT_USER} bash -c "
        export GOUP_ROOT='${HOME_DIR}/.go'
        export PATH='\$GOUP_ROOT/bin:\$PATH'
        goup ls
      "`.text();

      logger.success("✅ goup 和 Go 1.23.4 验证成功");
      logger.info(`  > goup: ${goupVersion.trim()}`);
      logger.info(`  > ${goVersion.trim()}`);
      logger.info(`  > 已安装版本: ${goupList.trim()}`);
    } catch (error) {
      logger.error("❌ goup 或 Go 1.23.4 验证失败");
      throw error;
    }

    // 2. 安装常用 Go 开发工具
    logger.info("🛠️  安装 Go 开发工具...");

    const goTools = [
      "golang.org/x/tools/gopls@latest",              // Go 语言服务器
      "golang.org/x/tools/cmd/goimports@latest",      // 自动导入管理
      "golang.org/x/lint/golint@latest",              // Go 代码检查
      "github.com/golangci/golangci-lint/cmd/golangci-lint@latest", // 强大的 linter
      "github.com/go-delve/delve/cmd/dlv@latest",     // Go 调试器
      "github.com/air-verse/air@latest",              // 热重载工具
      "github.com/swaggo/swag/cmd/swag@latest",       // Swagger 文档生成
      "github.com/goreleaser/goreleaser@latest",      // 发布工具
      "github.com/golangci/misspell/cmd/misspell@latest", // 拼写检查
      "honnef.co/go/tools/cmd/staticcheck@latest",    // 静态分析
    ];

    for (const tool of goTools) {
      try {
        logger.info(`  > 安装 ${tool}...`);
        await $`sudo -u ${CURRENT_USER} bash -c "
          export GOUP_ROOT='${HOME_DIR}/.go'
          export PATH='\$GOUP_ROOT/bin:\$PATH'
          export GOPATH='${HOME_DIR}/go'
          export PATH='\$GOPATH/bin:\$PATH'
          go install ${tool}
        "`;
        logger.success(`  ✓ 已安装 ${tool.split('/').pop()?.split('@')[0]}`);
      } catch (error) {
        logger.warn(`  ⚠️  安装 ${tool} 失败: ${error.message}`);
      }
    }

    // 3. 创建 Go 开发别名和函数
    logger.info("📝 创建 Go 开发别名和函数...");

    const goAliases = `
# Go 基础别名
alias gob='go build'
alias gor='go run'
alias got='go test'
alias goi='go install'
alias gom='go mod'
alias gof='go fmt'
alias gov='go version'
alias goe='go env'

# Go 模块管理
alias gomi='go mod init'
alias gomt='go mod tidy'
alias gomv='go mod verify'
alias gomd='go mod download'
alias goms='go mod graph'

# Go 测试相关
alias gotv='go test -v'
alias gotc='go test -cover'
alias gotb='go test -bench=.'
alias gotr='go test -race'

# Go 工具链
alias gofmt='gofmt -s -w'
alias goimports='goimports -w'
alias golint='golangci-lint run'
alias gofix='golangci-lint run --fix'

# goup 版本管理
alias goup-ls='goup ls'
alias goup-install='goup install'
alias goup-set='goup set'
alias goup-remove='goup remove'
alias goup-update='goup update'

# 开发工具
alias air='air'
alias dlv='dlv'
alias swag='swag init'

# Go 项目管理
alias go-clean='go clean -cache -modcache -testcache'
alias go-deps='go list -m all'
alias go-outdated='go list -u -m all'
alias go-vuln='govulncheck ./...'
`;

    const goFunctions = `
# Go 开发实用函数

# 创建新的 Go 项目
gonew() {
    if [ -z "$1" ]; then
        echo "Usage: gonew <project_name> [module_name]"
        return 1
    fi

    local project_name="$1"
    local module_name="\${2:-\$project_name}"

    mkdir -p "$project_name"
    cd "$project_name"

    go mod init "$module_name"

    # 创建基础文件结构
    cat > main.go << 'EOF'
package main

import (
    "fmt"
    "log"
)

func main() {
    fmt.Println("Hello, World!")
}
EOF

    cat > README.md << EOF
# \$project_name

## Description
Brief description of your project.

## Installation
\\\`\\\`\\\`bash
go mod download
\\\`\\\`\\\`

## Usage
\\\`\\\`\\\`bash
go run main.go
\\\`\\\`\\\`

## Build
\\\`\\\`\\\`bash
go build -o bin/\$project_name
\\\`\\\`\\\`
EOF

    cat > .gitignore << 'EOF'
# Binaries for programs and plugins
*.exe
*.exe~
*.dll
*.so
*.dylib
bin/
dist/

# Test binary, built with \`go test -c\`
*.test

# Output of the go coverage tool
*.out

# Dependency directories
vendor/

# Go workspace file
go.work

# IDE files
.vscode/
.idea/
*.swp
*.swo

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db
EOF

    echo "🎉 Go project '$project_name' created successfully!"
    echo "📁 Project structure:"
    ls -la
}

# Go 项目分析
goanalyze() {
    echo "🔍 Running Go project analysis..."
    echo "📝 Formatting code..."
    go fmt ./...
    echo "📦 Organizing imports..."
    goimports -w .
    echo "🔧 Running golangci-lint..."
    golangci-lint run
    echo "🧪 Running tests..."
    go test -v -race ./...
    echo "🔒 Checking for vulnerabilities..."
    govulncheck ./... || echo "govulncheck not available"
    echo "✅ Analysis complete!"
}

# 快速运行 Go 项目
godev() {
    if [ -f "main.go" ]; then
        echo "🏃 Running main.go..."
        go run main.go
    elif [ -f "cmd/main.go" ]; then
        echo "🏃 Running cmd/main.go..."
        go run cmd/main.go
    else
        echo "❌ No main.go found in current directory or cmd/"
        return 1
    fi
}

# Go 热重载开发
gowatch() {
    if command -v air >/dev/null 2>&1; then
        if [ ! -f ".air.toml" ]; then
            echo "📝 Creating .air.toml config..."
            air init
        fi
        echo "🔥 Starting hot reload with air..."
        air
    else
        echo "❌ air not installed. Install with: go install github.com/air-verse/air@latest"
        return 1
    fi
}

# Go 版本信息
goinfo() {
    echo "🐹 Go Environment Information"
    echo "============================="
    echo "Go Version: \$(go version)"
    echo "goup Version: \$(goup version)"
    echo "GOROOT: \$(go env GOROOT)"
    echo "GOPATH: \$(go env GOPATH)"
    echo "GOPROXY: \$(go env GOPROXY)"
    echo "GO111MODULE: \$(go env GO111MODULE)"
    echo ""
    echo "📦 Installed Go versions (goup):"
    goup ls
    echo ""
    echo "🛠️  Installed Go tools:"
    ls -1 "\$(go env GOPATH)/bin" 2>/dev/null || echo "No tools installed"
}

# 清理 Go 缓存和临时文件
goclean() {
    echo "🧹 Cleaning Go caches and temporary files..."
    go clean -cache -modcache -testcache -fuzzcache
    echo "✅ Go cleanup completed!"
}

# 快速基准测试
gobench() {
    local pattern="\${1:-.}"
    echo "📊 Running benchmarks for pattern: \$pattern"
    go test -bench="\$pattern" -benchmem ./...
}

# Go 依赖分析
godeps() {
    echo "📦 Go Dependencies Analysis"
    echo "=========================="
    echo "Direct dependencies:"
    go list -m -f '{{if not .Indirect}}{{.}}{{end}}' all
    echo ""
    echo "All dependencies:"
    go mod graph | head -20
    echo ""
    echo "Module size on disk:"
    du -sh "\$(go env GOMODCACHE)" 2>/dev/null || echo "Module cache not found"
}
`;

    const goEnvConfig = `
# Go 1.23.4 环境配置（使用 goup 管理）

# goup Go 版本管理器
export GOUP_ROOT="$HOME/.go"
export PATH="$GOUP_ROOT/bin:$PATH"

# Go 工作空间
export GOPATH="$HOME/go"
export PATH="$GOPATH/bin:$PATH"

# Go 模块和代理设置
export GO111MODULE=on
export GOPROXY=https://goproxy.cn,direct
export GOSUMDB=sum.golang.google.cn
export GONOPROXY=github.com/my-org/*,gitlab.com/my-org/*
export GONOSUMDB=github.com/my-org/*,gitlab.com/my-org/*

# Go 开发优化
export GOGC=100
export GOMAXPROCS=0

# Go 私有模块（根据需要调整）
# export GOPRIVATE=github.com/my-org/*,gitlab.com/my-org/*

# 启用 Go 模块校验和数据库
export GOSUMDB=sum.golang.org

# CGO 设置
export CGO_ENABLED=1
`;

    // 写入文件
    const aliasFile = `${HOME_DIR}/.go_aliases`;
    await Bun.write(aliasFile, goAliases);
    await $`chown ${CURRENT_USER}:${CURRENT_USER} ${aliasFile}`;

    const functionsFile = `${HOME_DIR}/.go_functions`;
    await Bun.write(functionsFile, goFunctions);
    await $`chown ${CURRENT_USER}:${CURRENT_USER} ${functionsFile}`;

    const configFile = `${HOME_DIR}/.go_env`;
    await Bun.write(configFile, goEnvConfig);
    await $`chown ${CURRENT_USER}:${CURRENT_USER} ${configFile}`;

    logger.success("✅ Go 别名和函数创建完成");
    logger.info(`  > 别名文件: ${aliasFile}`);
    logger.info(`  > 函数文件: ${functionsFile}`);
    logger.info(`  > 配置文件: ${configFile}`);

    // 4. 创建开发模板和配置
    logger.info("📄 创建 Go 开发模板...");

    const templateDir = `${HOME_DIR}/.go-templates`;
    await $`mkdir -p ${templateDir}`;
    await $`chown ${CURRENT_USER}:${CURRENT_USER} ${templateDir}`;

    // Air 配置模板
    const airConfig = `# Air configuration for hot reload
root = "."
testdata_dir = "testdata"
tmp_dir = "tmp"

[build]
  args_bin = []
  bin = "./tmp/main"
  cmd = "go build -o ./tmp/main ."
  delay = 1000
  exclude_dir = ["assets", "tmp", "vendor", "testdata"]
  exclude_file = []
  exclude_regex = ["_test.go"]
  exclude_unchanged = false
  follow_symlink = false
  full_bin = ""
  include_dir = []
  include_ext = ["go", "tpl", "tmpl", "html"]
  include_file = []
  kill_delay = "0s"
  log = "build-errors.log"
  poll = false
  poll_interval = 0
  rerun = false
  rerun_delay = 500
  send_interrupt = false
  stop_on_root = false

[color]
  app = ""
  build = "yellow"
  main = "magenta"
  runner = "green"
  watcher = "cyan"

[log]
  main_only = false
  time = false

[misc]
  clean_on_exit = false

[screen]
  clear_on_rebuild = false
  keep_scroll = true
`;

    await Bun.write(`${templateDir}/air.toml`, airConfig);

    // Makefile 模板
    const makefileTemplate = `# Go project Makefile
.PHONY: build clean test deps help dev

# Variables
BINARY_NAME=myapp
VERSION=\$(shell git describe --tags --always --dirty)
LDFLAGS=-ldflags "-X main.Version=\${VERSION}"

help: ## Show this help message
	@echo 'Usage:'
	@echo '  make [target]'
	@echo ''
	@echo 'Targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  \\033[36m%-15s\\033[0m %s\\n", $$1, $$2}' \$(MAKEFILE_LIST)

deps: ## Download dependencies
	go mod download
	go mod verify

build: deps ## Build the application
	go build \${LDFLAGS} -o bin/\${BINARY_NAME} .

dev: ## Run development server with hot reload
	air

test: ## Run tests
	go test -v -race ./...

test-coverage: ## Run tests with coverage
	go test -v -race -coverprofile=coverage.out ./...
	go tool cover -html=coverage.out

lint: ## Run linter
	golangci-lint run

fmt: ## Format code
	go fmt ./...
	goimports -w .

clean: ## Clean build artifacts
	go clean
	rm -f bin/\${BINARY_NAME}
	rm -f coverage.out

install: build ## Install the application
	go install \${LDFLAGS} .

docker-build: ## Build Docker image
	docker build -t \${BINARY_NAME}:\${VERSION} .

release: ## Create a release
	goreleaser release --clean

.DEFAULT_GOAL := help
`;

    await Bun.write(`${templateDir}/Makefile`, makefileTemplate);

    await $`chown -R ${CURRENT_USER}:${CURRENT_USER} ${templateDir}`;

    logger.success("✅ Go 开发模板创建完成");
    logger.info(`  > 模板目录: ${templateDir}`);

    // 5. 验证最终配置
    logger.info("🔍 最终验证...");

    try {
      const installedTools = await $`sudo -u ${CURRENT_USER} bash -c "
        export GOUP_ROOT='${HOME_DIR}/.go'
        export PATH='\$GOUP_ROOT/bin:\$PATH'
        export GOPATH='${HOME_DIR}/go'
        export PATH='\$GOPATH/bin:\$PATH'
        ls \$GOPATH/bin 2>/dev/null | head -10
      "`.text();

      logger.success("🎉 Go 1.23.4 环境配置完成！");
      logger.info("🛠️  已安装的工具（前10个）:");
      installedTools.trim().split('\n').forEach(tool => {
        if (tool.trim()) logger.info(`  > ${tool.trim()}`);
      });

      logger.info("💡 建议在 shell 配置文件中添加:");
      logger.info(`   source ${aliasFile}`);
      logger.info(`   source ${functionsFile}`);
      logger.info(`   source ${configFile}`);

      logger.info("📋 常用命令:");
      logger.info("   > gonew <project> - 创建新项目");
      logger.info("   > godev - 快速运行项目");
      logger.info("   > gowatch - 热重载开发");
      logger.info("   > goanalyze - 项目分析");
      logger.info("   > goup ls - 查看已安装的 Go 版本");

    } catch (error) {
      logger.error("❌ Go 最终验证失败");
      throw error;
    }

  } catch (error) {
    logger.error("❌ Go 1.23.4 配置过程中出现错误：", error.message);
    process.exit(1);
  }
}

main();
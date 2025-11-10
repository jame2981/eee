#!/usr/bin/env bun

/**
 * pkgs/docker/post_install.ts
 *
 * Docker 后置安装脚本：
 * 1. 验证 Docker 和 Docker Compose 安装
 * 2. 创建有用的 Docker 别名和脚本
 * 3. 设置开发环境优化
 */

import { $ } from "bun";
import { existsSync } from "fs";
import { logger } from "../../src/logger";

// Handle sudo environment - use the real user, not root
const CURRENT_USER = process.env.REAL_USER || process.env.SUDO_USER || process.env.USER || process.env.LOGNAME || "root";
const HOME_DIR = process.env.REAL_HOME || process.env.HOME || `/home/${CURRENT_USER}`;

async function main() {
  try {
    logger.info("🐳 开始配置 Docker 环境...");

    // 1. 验证安装
    logger.info("🔍 验证 Docker 安装...");

    try {
      const dockerVersion = await $`docker --version`.text();
      const composeVersion = await $`docker compose version`.text();

      logger.success("✅ Docker 验证成功");
      logger.info(`  > ${dockerVersion.trim()}`);
      logger.info(`  > ${composeVersion.trim()}`);
    } catch (error) {
      logger.error("❌ Docker 验证失败");
      throw error;
    }

    // 2. 测试 Docker 权限
    logger.info("🔐 测试用户 Docker 权限...");

    try {
      await $`sudo -u ${CURRENT_USER} docker run --rm alpine echo "Docker user access test successful"`;
      logger.success("✅ 用户可以正常使用 Docker");
    } catch (error) {
      logger.warn("⚠️  用户 Docker 权限可能需要重新登录生效");
      logger.info("💡 建议执行: newgrp docker 或重新登录");
    }

    // 3. 创建 Docker 别名和脚本
    logger.info("📝 创建 Docker 别名和工具脚本...");

    const dockerAliases = `
# Docker 基础别名
alias d='docker'
alias dc='docker compose'
alias di='docker images'
alias dp='docker ps'
alias dpa='docker ps -a'
alias drm='docker rm'
alias drmi='docker rmi'
alias dlog='docker logs'
alias dlogf='docker logs -f'
alias dexec='docker exec -it'

# Docker 管理别名
alias docker-clean='docker system prune -f'
alias docker-clean-all='docker system prune -a -f --volumes'
alias docker-stop-all='docker stop \$(docker ps -q)'
alias docker-rm-all='docker rm \$(docker ps -aq)'
alias docker-rmi-dangling='docker rmi \$(docker images -f "dangling=true" -q)'

# Docker Compose 别名
alias dcu='docker compose up'
alias dcd='docker compose down'
alias dcb='docker compose build'
alias dcl='docker compose logs'
alias dcr='docker compose restart'
alias dcp='docker compose pull'
alias dce='docker compose exec'

# Docker 网络和卷
alias dn='docker network'
alias dv='docker volume'
alias dvls='docker volume ls'
alias dnls='docker network ls'

# 常用 Docker 命令组合
alias docker-stats='docker stats --format "table {{.Container}}\\t{{.CPUPerc}}\\t{{.MemUsage}}\\t{{.MemPerc}}\\t{{.NetIO}}\\t{{.BlockIO}}"'
alias docker-top='docker container ls --format "table {{.Names}}\\t{{.Image}}\\t{{.Status}}\\t{{.Ports}}"'
`;

    const dockerFunctions = `
# Docker 实用函数

# 进入容器 shell
dsh() {
    if [ -z "$1" ]; then
        echo "Usage: dsh <container_name_or_id>"
        return 1
    fi
    docker exec -it "$1" /bin/bash || docker exec -it "$1" /bin/sh
}

# Docker 容器快速查找和连接
dfind() {
    if [ -z "$1" ]; then
        docker ps --format "table {{.Names}}\\t{{.Image}}\\t{{.Status}}\\t{{.Ports}}"
    else
        docker ps --filter "name=$1" --format "table {{.Names}}\\t{{.Image}}\\t{{.Status}}\\t{{.Ports}}"
    fi
}

# 快速启动开发环境
ddev() {
    if [ -f "docker-compose.yml" ] || [ -f "docker-compose.yaml" ]; then
        docker compose up -d
        docker compose logs -f
    elif [ -f "Dockerfile" ]; then
        docker build -t \${PWD##*/} .
        docker run -it --rm \${PWD##*/}
    else
        echo "No docker-compose.yml or Dockerfile found in current directory"
    fi
}

# 清理未使用的 Docker 资源
dclean() {
    echo "Cleaning up Docker resources..."
    docker container prune -f
    docker image prune -f
    docker network prune -f
    docker volume prune -f
    echo "Docker cleanup completed!"
}

# Docker 日志查看器
dlogs() {
    if [ -z "$1" ]; then
        echo "Usage: dlogs <container_name_or_id> [lines]"
        return 1
    fi
    local lines=\${2:-100}
    docker logs --tail "$lines" -f "$1"
}

# 快速 Docker run 开发环境
drun() {
    local image=\${1:-ubuntu:latest}
    local name=\${2:-temp-dev}
    docker run -it --rm --name "$name" -v \${PWD}:/workspace -w /workspace "$image" /bin/bash
}
`;

    const dockerConfig = `
# Docker 环境配置

# Docker 构建优化
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

# Docker 默认平台（对于 M1 Mac 等）
# export DOCKER_DEFAULT_PLATFORM=linux/amd64

# Docker 开发环境设置
export COMPOSE_PROJECT_NAME=\${PWD##*/}
`;

    // 写入别名文件
    const aliasFile = `${HOME_DIR}/.docker_aliases`;
    await Bun.write(aliasFile, dockerAliases);
    await $`chown ${CURRENT_USER}:${CURRENT_USER} ${aliasFile}`;

    // 写入函数文件
    const functionsFile = `${HOME_DIR}/.docker_functions`;
    await Bun.write(functionsFile, dockerFunctions);
    await $`chown ${CURRENT_USER}:${CURRENT_USER} ${functionsFile}`;

    // 写入配置文件
    const configFile = `${HOME_DIR}/.docker_config`;
    await Bun.write(configFile, dockerConfig);
    await $`chown ${CURRENT_USER}:${CURRENT_USER} ${configFile}`;

    logger.success("✅ Docker 别名和脚本创建完成");
    logger.info(`  > 别名文件: ${aliasFile}`);
    logger.info(`  > 函数文件: ${functionsFile}`);
    logger.info(`  > 配置文件: ${configFile}`);

    // 4. 创建常用的 Docker Compose 模板
    logger.info("📄 创建 Docker Compose 模板...");

    const templateDir = `${HOME_DIR}/.docker-templates`;
    await $`mkdir -p ${templateDir}`;
    await $`chown ${CURRENT_USER}:${CURRENT_USER} ${templateDir}`;

    // Node.js 开发模板
    const nodeTemplate = `# Node.js 开发环境模板
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - .:/app
      - /app/node_modules
    environment:
      - NODE_ENV=development
    command: npm run dev

  db:
    image: postgres:15
    environment:
      - POSTGRES_DB=myapp
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
`;

    // Redis + MongoDB 模板
    const dataTemplate = `# Redis + MongoDB 开发环境模板
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

  mongodb:
    image: mongo:6
    ports:
      - "27017:27017"
    environment:
      - MONGO_INITDB_ROOT_USERNAME=admin
      - MONGO_INITDB_ROOT_PASSWORD=password
    volumes:
      - mongodb_data:/data/db

volumes:
  redis_data:
  mongodb_data:
`;

    await Bun.write(`${templateDir}/node-dev.yml`, nodeTemplate);
    await Bun.write(`${templateDir}/data-services.yml`, dataTemplate);
    await $`chown -R ${CURRENT_USER}:${CURRENT_USER} ${templateDir}`;

    logger.success("✅ Docker Compose 模板创建完成");
    logger.info(`  > 模板目录: ${templateDir}`);

    // 5. 验证最终配置
    logger.info("🔍 最终验证...");

    try {
      const info = await $`docker info --format '{{.ServerVersion}}'`.text();
      logger.success("🎉 Docker 环境配置完成！");
      logger.info(`📊 Docker Server Version: ${info.trim()}`);
      logger.info("💡 建议在 shell 配置文件中添加:");
      logger.info(`   source ${aliasFile}`);
      logger.info(`   source ${functionsFile}`);
      logger.info(`   source ${configFile}`);
      logger.info("🔄 如果遇到权限问题，请执行: newgrp docker 或重新登录");
    } catch (error) {
      logger.error("❌ Docker 最终验证失败");
      throw error;
    }

  } catch (error) {
    logger.error("❌ Docker 配置过程中出现错误：", error.message);
    process.exit(1);
  }
}

main();
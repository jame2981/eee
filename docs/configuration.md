# EEE 配置管理

EEE 使用统一的配置管理系统，支持多种配置方式，让你可以灵活地控制整个安装和运行过程。

## 配置方式

### 1. .env 文件配置（推荐）

创建 `.env` 文件来管理配置：

```bash
# 复制示例配置文件
cp .env.example .env

# 编辑配置
nano .env
```

### 2. 环境变量配置

直接设置环境变量：

```bash
export EEE_GITHUB_MIRROR=gitee,fastgit,github
export EEE_PROXY_ENABLED=true
export HTTP_PROXY=http://proxy.example.com:8080
```

### 3. 配置文件优先级

配置的加载优先级（高到低）：

1. **环境变量** - 直接在 shell 中设置的变量
2. **.env 文件** - 项目根目录的 .env 文件
3. **~/.eee/.env** - 用户主目录下的配置文件
4. **默认值** - 系统内置的默认配置

## 主要配置项

### 代理配置

```bash
# 启用代理
EEE_PROXY_ENABLED=true

# 代理服务器地址
HTTP_PROXY=http://proxy.example.com:8080
HTTPS_PROXY=http://proxy.example.com:8080

# 不使用代理的地址
NO_PROXY=localhost,127.0.0.1,*.local
```

### GitHub 镜像源配置

```bash
# 首选镜像源（按优先级排序）
EEE_GITHUB_MIRROR=gitee,fastgit,github

# 连接超时时间（秒）
EEE_GITHUB_TIMEOUT=15

# 重试次数
EEE_GITHUB_RETRY=3
```

### 日志配置

```bash
# 日志级别
EEE_LOG_LEVEL=info

# 日志文件（可选）
EEE_LOG_FILE=/var/log/eee.log
```

### 安装配置

```bash
# 容器模式
EEE_CONTAINER_MODE=false

# 跳过 Docker 服务
EEE_SKIP_DOCKER_SERVICE=false

# 默认 Shell
EEE_DEFAULT_SHELL=zsh
```

## 常用配置场景

### 国内用户配置

```bash
# .env 文件内容
EEE_GITHUB_MIRROR=gitee,fastgit,github
EEE_GITHUB_TIMEOUT=15
EEE_LOG_LEVEL=info
```

### 企业环境配置

```bash
# 代理配置
EEE_PROXY_ENABLED=true
HTTP_PROXY=http://proxy.company.com:8080
HTTPS_PROXY=http://proxy.company.com:8080
NO_PROXY=localhost,*.internal,*.company.com

# GitHub 镜像源
EEE_GITHUB_MIRROR=ghproxy,github
EEE_GITHUB_TIMEOUT=30
EEE_GITHUB_RETRY=5
```

### 开发环境配置

```bash
# 调试配置
EEE_LOG_LEVEL=debug
EEE_VERBOSE=true
EEE_DEBUG=true

# 网络配置
EEE_NETWORK_TIMEOUT=60
EEE_NETWORK_RETRY=5
```

### CI/CD 环境配置

```bash
# 自动化环境
EEE_ENV=ci
EEE_CONTAINER_MODE=true
EEE_LOG_LEVEL=warn
EEE_SKIP_DOCKER_SERVICE=true
```

## 配置验证

使用内置工具验证配置：

```bash
# 查看当前配置
bun tools/network-config.ts config show

# 测试网络配置
bun tools/network-config.ts test

# 验证代理设置
bun tools/network-config.ts proxy status
```

## 配置管理 API

在代码中使用配置：

```typescript
import { getConfig, getProxyConfig, getGitHubConfig } from '@/config/env-config';

// 获取完整配置
const config = getConfig();

// 获取特定配置
const proxyConfig = getProxyConfig();
const githubConfig = getGitHubConfig();

// 检查配置值
if (proxyConfig?.enabled) {
  console.log('代理已启用');
}
```

## 配置文件位置

EEE 会按以下顺序查找配置文件：

1. `./env` - 项目根目录
2. `./.env.local` - 本地配置文件
3. `~/.eee/.env` - 用户配置文件

## 安全注意事项

1. **不要提交 .env 文件到版本控制**
   ```bash
   echo ".env" >> .gitignore
   ```

2. **保护敏感信息**
   - 代理密码
   - API 密钥
   - 私有仓库访问令牌

3. **使用环境变量在生产环境**
   ```bash
   # 在生产环境中直接设置环境变量
   export EEE_GITHUB_MIRROR=gitee,github
   ```

## 故障排除

### 配置不生效

1. 检查配置文件路径和格式
2. 验证环境变量是否正确设置
3. 查看日志输出确认配置加载情况

### 网络问题

1. 检查代理配置是否正确
2. 测试镜像源可用性
3. 调整超时和重试参数

### 权限问题

1. 确保配置文件有正确的读取权限
2. 检查日志文件的写入权限
3. 验证用户对配置目录的访问权限

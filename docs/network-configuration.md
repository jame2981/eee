# 网络配置管理

EEE 提供了统一的网络配置管理系统，支持代理设置和 GitHub 镜像源管理。

## 功能特性

- 🌐 **统一代理管理** - 支持 HTTP/HTTPS/FTP 代理配置
- 🔄 **多镜像源支持** - 自动选择最佳的 GitHub 镜像源
- ⚙️ **灵活配置方式** - 支持环境变量和配置文件
- 🛡️ **网络容错** - 自动切换可用镜像源
- 📊 **详细日志** - 提供详细的网络操作日志

## 配置方式

### 1. 环境变量配置

```bash
# 代理设置
export HTTP_PROXY=http://proxy.example.com:8080
export HTTPS_PROXY=http://proxy.example.com:8080
export NO_PROXY=localhost,127.0.0.1,*.local

# GitHub 镜像源设置
export EEE_GITHUB_MIRROR=gitee,fastgit,github
export EEE_GITHUB_TIMEOUT=15
export EEE_GITHUB_RETRY=3

# 代理启用/禁用
export EEE_PROXY_ENABLED=true
```

### 2. 配置文件

创建 `~/.eee/network.json` 文件：

```json
{
  "proxy": {
    "enabled": true,
    "http": "http://proxy.example.com:8080",
    "https": "http://proxy.example.com:8080",
    "noProxy": ["localhost", "127.0.0.1", "*.local"]
  },
  "github": {
    "preferredMirrors": ["gitee", "fastgit", "github"],
    "timeout": 15,
    "retryCount": 3
  }
}
```

## 支持的 GitHub 镜像源

| 名称 | 描述 | 优先级 | 支持功能 |
|------|------|--------|----------|
| github | GitHub 官方源 | 1 | 完整支持 |
| gitee | Gitee 镜像源（国内推荐） | 2 | 完整支持 |
| fastgit | FastGit 镜像源 | 3 | 完整支持 |
| ghproxy | GHProxy 代理源 | 4 | 完整支持 |
| jsdelivr | JSDelivr CDN | 5 | 仅文件下载 |
| gitclone | GitClone 镜像源 | 6 | 完整支持 |
| cnpmjs | CNPM 镜像源 | 7 | 完整支持 |

## 使用示例

### 基本使用

```typescript
import { getGitHubManager } from '@/network';

// 获取 GitHub 管理器实例
const githubManager = getGitHubManager();

// 初始化（检测可用镜像源）
await githubManager.initialize();

// 获取克隆 URL
const cloneUrl = githubManager.getCloneUrl('ohmyzsh', 'ohmyzsh');

// 获取 raw 文件 URL
const rawUrl = githubManager.getRawUrl('ohmyzsh', 'ohmyzsh', 'master', 'README.md');

// 下载文件
const content = await githubManager.downloadFile('ohmyzsh', 'ohmyzsh', 'master', 'README.md');

// 克隆仓库
await githubManager.cloneRepository('ohmyzsh', 'ohmyzsh', '/path/to/target');
```

### 便捷函数

```typescript
import { 
  getOhMyZshCloneUrl, 
  getOhMyZshInstallScriptUrl,
  downloadOhMyZshInstallScript 
} from '@/network';

// 获取 oh-my-zsh 克隆 URL
const cloneUrl = await getOhMyZshCloneUrl();

// 获取安装脚本 URL
const scriptUrl = await getOhMyZshInstallScriptUrl();

// 直接下载安装脚本内容
const scriptContent = await downloadOhMyZshInstallScript();
```

## 故障排除

### 网络连接问题

如果遇到网络连接问题，系统会自动：

1. 尝试所有可用的镜像源
2. 记录详细的错误日志
3. 提供故障排除建议

### 代理配置问题

检查代理配置是否正确：

```bash
# 检查环境变量
echo $HTTP_PROXY
echo $HTTPS_PROXY

# 测试代理连接
curl --proxy $HTTP_PROXY -I https://github.com
```

### 镜像源选择

手动指定镜像源：

```bash
# 优先使用 Gitee 镜像
export EEE_GITHUB_MIRROR=gitee

# 或在代码中切换
githubManager.switchToMirror('gitee');
```

## 配置优先级

配置的优先级顺序（高到低）：

1. 环境变量
2. 配置文件 (`~/.eee/network.json`)
3. 默认值

## CLI 工具

EEE 提供了便捷的 CLI 工具来管理网络配置：

```bash
# 查看网络状态
bun tools/network-config.ts status

# 设置代理
bun tools/network-config.ts proxy set http://proxy.example.com:8080

# 测试镜像源
bun tools/network-config.ts mirror test

# 切换镜像源
bun tools/network-config.ts mirror switch gitee

# 导出环境变量配置
bun tools/network-config.ts config export
```

## 最佳实践

1. **国内用户推荐**：设置 `EEE_GITHUB_MIRROR=gitee,fastgit,github`
2. **企业环境**：配置代理设置和 `noProxy` 列表
3. **CI/CD 环境**：使用环境变量配置，避免配置文件
4. **开发环境**：使用配置文件，便于版本控制排除
5. **网络受限环境**：优先使用国内镜像源

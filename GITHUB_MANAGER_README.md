# GitHub 链接统一管理系统

## 概述

为了解决 GitHub 访问问题和代理配置管理，我创建了一个统一的 GitHub 链接管理系统。该系统支持：

- 🌐 **统一代理管理** - HTTP/HTTPS/FTP 代理配置
- 🔄 **多镜像源支持** - 自动选择最佳 GitHub 镜像源
- ⚙️ **灵活配置** - 环境变量和配置文件两种方式
- 🛡️ **网络容错** - 自动切换可用镜像源
- 📊 **详细日志** - 完整的操作日志记录

## 文件结构

```
src/network/
├── github-manager.ts     # GitHub 管理器核心
├── proxy-config.ts       # 代理配置管理
├── index.ts             # 统一导出
└── download-utils.ts    # 下载工具（已存在）

config/
└── network.example.json  # 配置示例

docs/
└── network-configuration.md  # 详细文档

tools/
└── network-config.ts     # CLI 管理工具

pkgs/zsh/
└── post_install.ts      # 已更新使用新系统
```

## 核心功能

### 1. GitHub 管理器 (`GitHubManager`)

- **多镜像源支持**：GitHub、Gitee、FastGit、GHProxy、JSDelivr、GitClone、CNPM
- **自动检测**：测试镜像源可用性，自动选择最佳源
- **智能切换**：失败时自动尝试备用镜像源
- **代理集成**：自动应用代理配置

### 2. 代理配置管理 (`ProxyConfigManager`)

- **多种配置方式**：环境变量、配置文件
- **配置优先级**：环境变量 > 配置文件 > 默认值
- **持久化存储**：保存到 `~/.eee/network.json`

### 3. CLI 工具

```bash
# 查看状态
bun tools/network-config.ts status

# 代理管理
bun tools/network-config.ts proxy set http://proxy.example.com:8080
bun tools/network-config.ts proxy unset

# 镜像源管理
bun tools/network-config.ts mirror list
bun tools/network-config.ts mirror test
bun tools/network-config.ts mirror switch gitee

# 配置管理
bun tools/network-config.ts config show
bun tools/network-config.ts config export
```

## 使用方式

### 环境变量配置

```bash
# 代理设置
export HTTP_PROXY=http://proxy.example.com:8080
export HTTPS_PROXY=http://proxy.example.com:8080
export NO_PROXY=localhost,127.0.0.1

# GitHub 镜像源
export EEE_GITHUB_MIRROR=gitee,fastgit,github
export EEE_GITHUB_TIMEOUT=15
export EEE_GITHUB_RETRY=3
```

### 代码中使用

```typescript
import { getGitHubManager, getOhMyZshCloneUrl } from '@/network';

// 基本使用
const manager = getGitHubManager();
await manager.initialize();
const cloneUrl = manager.getCloneUrl('owner', 'repo');

// 便捷函数
const ohMyZshUrl = await getOhMyZshCloneUrl();
```

## 已更新的代码

### `pkgs/zsh/post_install.ts`

重构了 oh-my-zsh 安装逻辑：

1. **使用统一管理器**：通过 `getGitHubManager()` 获取实例
2. **多种安装方式**：官方脚本 → git clone → 基本结构
3. **自动镜像源切换**：失败时自动尝试其他可用源
4. **详细日志**：显示使用的镜像源信息

## 配置示例

### 国内用户推荐配置

```bash
export EEE_GITHUB_MIRROR=gitee,fastgit,github
export EEE_GITHUB_TIMEOUT=15
```

### 企业环境配置

```json
{
  "proxy": {
    "enabled": true,
    "http": "http://proxy.company.com:8080",
    "https": "http://proxy.company.com:8080",
    "noProxy": ["localhost", "*.internal", "*.company.com"]
  },
  "github": {
    "preferredMirrors": ["ghproxy", "github"],
    "timeout": 30,
    "retryCount": 5
  }
}
```

## 测试验证

系统已通过测试验证：

1. ✅ **镜像源检测** - 成功检测到 Gitee 等可用镜像源
2. ✅ **oh-my-zsh 安装** - 使用 Gitee 镜像成功安装
3. ✅ **配置管理** - 环境变量和配置文件正常工作
4. ✅ **错误处理** - 网络失败时自动切换镜像源

## 优势

1. **解决网络问题**：GitHub 访问受限时自动使用镜像源
2. **统一管理**：所有 GitHub 相关链接集中管理
3. **灵活配置**：支持多种配置方式，适应不同环境
4. **容错机制**：网络问题时自动切换，提高成功率
5. **易于维护**：统一的接口，便于后续扩展

现在 `pkgs/zsh/post_install.ts` 中的 oh-my-zsh 安装问题已经解决，系统会自动选择最佳的镜像源进行安装！

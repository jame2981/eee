# 快速开始指南

## 🚀 立即使用

### 1. 导入执行器

```typescript
import { exec, execBashScript, isCommandAvailable } from "@/shell/shell-executor";
```

### 2. 执行命令（推荐）⭐

```typescript
// 使用数组参数（推荐）
await exec(["ls", "-la", "/tmp"]);
await exec(["git", "commit", "-m", "your message"]);

// 或者：命令名 + 参数数组
await exec("mkdir", ["-p", "/tmp/test"]);
```

### 3. 需要 shell 特性时

```typescript
// 管道
await execBashScript("cat file.txt | grep pattern");

// 重定向
await execBashScript("echo 'content' > file.txt");

// 环境变量展开
await execBashScript("echo $HOME");
```

### 4. 检查命令是否存在

```typescript
if (await isCommandAvailable("docker")) {
  await exec(["docker", "ps"]);
}
```

## 🛡️ 安全性

### ✅ 安全的做法

```typescript
// 用户输入会被安全处理
const userInput = getUserInput();
await exec(["cat", userInput]);  // 安全！
```

### ❌ 危险的做法

```typescript
// 不要这样做！
const userInput = getUserInput();
await execBashScript(`cat ${userInput}`);  // 危险！命令注入风险
```

## 📋 常见场景

### 文件操作

```typescript
// 创建目录
await exec(["mkdir", "-p", "/tmp/mydir"]);

// 复制文件
await exec(["cp", "source.txt", "dest.txt"]);

// 删除文件
await exec(["rm", "-rf", "/tmp/mydir"]);
```

### Git 操作

```typescript
// 提交代码
await exec(["git", "add", "."]);
await exec(["git", "commit", "-m", commitMessage]);
await exec(["git", "push", "origin", "main"]);
```

### 系统信息

```typescript
// 获取系统信息
const os = await exec(["uname", "-s"]);
const arch = await exec(["uname", "-m"]);
```

### 包管理

```typescript
// 检查包是否安装
if (await isCommandAvailable("docker")) {
  console.log("Docker 已安装");
}

// 安装包（需要 sudo）
await exec(["sudo", "apt-get", "install", "-y", "package-name"]);
```

## 🔧 高级用法

### 获取退出码

```typescript
import { execWithResult } from "@/shell/shell-executor";

const result = await execWithResult(["test", "-f", "/tmp/file.txt"]);
if (result.success) {
  console.log("文件存在");
} else {
  console.log("文件不存在");
}
```

### 自定义选项

```typescript
// 指定工作目录
await exec(["ls", "-la"], { cwd: "/tmp" });

// 设置环境变量
await exec(["echo", "$CUSTOM_VAR"], { 
  env: { CUSTOM_VAR: "value" } 
});

// 静默执行（不抛出错误）
await exec(["command-that-might-fail"], { silent: true });
```

## 📚 更多文档

- [完整使用指南](docs/SHELL_EXECUTOR.md)
- [Docker 验证报告](DOCKER_VERIFICATION_REPORT.md)
- [最终总结](FINAL_SUMMARY.md)

## ⚠️ 注意事项

1. **优先使用数组参数**：`exec(["cmd", "arg"])` 而不是 `execBashScript("cmd arg")`
2. **避免字符串拼接**：不要拼接用户输入到命令字符串中
3. **检查命令存在**：使用 `isCommandAvailable()` 检查命令是否存在
4. **错误处理**：默认情况下命令失败会抛出错误，使用 `try-catch` 或 `silent: true`

## 🎯 记住这些

### ✅ 推荐

```typescript
// 1. 数组参数
await exec(["git", "commit", "-m", message]);

// 2. 检查命令
if (await isCommandAvailable("docker")) { ... }

// 3. 需要 shell 特性时
await execBashScript("cat file | grep pattern");
```

### ❌ 避免

```typescript
// 1. 字符串拼接
await execBashScript(`cat ${userInput}`);

// 2. 直接使用 Bun.spawn
Bun.spawn(["ls"]);

// 3. 使用 $ 模板字符串
import { $ } from "bun";
await $`ls`;
```

## 🚀 开始使用

现在你已经准备好了！开始使用统一的 shell 执行器，享受安全、简洁、类型安全的命令执行体验吧！


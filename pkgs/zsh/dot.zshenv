# ==============================================================================
#                          ZSH 环境变量配置文件
# ==============================================================================
#
# .zshenv 文件在所有 zsh 会话启动时都会被加载
# 这里定义系统级的环境变量
#

# ---------------------
#      基本环境变量
# ---------------------

# 设置默认编程语言环境
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

# 设置默认编辑器
export EDITOR=nano
export VISUAL=nano

# 设置默认分页器
export PAGER=less
export LESS='-R'

# ---------------------
#      开发环境
# ---------------------

# Node.js
if [ -d "$HOME/.npm-global" ]; then
    export PATH="$HOME/.npm-global/bin:$PATH"
fi

# Python
if [ -d "$HOME/.local/bin" ]; then
    export PATH="$HOME/.local/bin:$PATH"
fi

# Rust
if [ -d "$HOME/.cargo" ]; then
    export PATH="$HOME/.cargo/bin:$PATH"
fi

# Go
if [ -d "/usr/local/go/bin" ]; then
    export PATH="/usr/local/go/bin:$PATH"
fi

if [ -d "$HOME/go/bin" ]; then
    export GOPATH="$HOME/go"
    export PATH="$GOPATH/bin:$PATH"
fi

# Bun JavaScript Runtime
if [ -d "$HOME/.bun" ]; then
    export BUN_INSTALL="$HOME/.bun"
    export PATH="$BUN_INSTALL/bin:$PATH"
fi

# ---------------------
#      系统工具
# ---------------------

# 如果用户有 ~/bin 目录，添加到 PATH
if [ -d "$HOME/bin" ]; then
    export PATH="$HOME/bin:$PATH"
fi

# 如果用户有 ~/.local/bin 目录，添加到 PATH
if [ -d "$HOME/.local/bin" ]; then
    export PATH="$HOME/.local/bin:$PATH"
fi

# ---------------------
#      XDG 规范目录
# ---------------------

# XDG Base Directory Specification
export XDG_CONFIG_HOME="$HOME/.config"
export XDG_DATA_HOME="$HOME/.local/share"
export XDG_CACHE_HOME="$HOME/.cache"

# ---------------------
#      历史记录
# ---------------------

# Zsh 历史记录设置
export HISTFILE="$HOME/.zsh_history"
export HISTSIZE=50000
export SAVEHIST=50000

# ---------------------
#      颜色支持
# ---------------------

# 启用颜色支持
export CLICOLOR=1

# LS 颜色配置
export LSCOLORS="ExFxBxDxCxegedabagacad"

# Grep 颜色
export GREP_OPTIONS="--color=auto"

# ---------------------
#      安全设置
# ---------------------

# 设置 umask (默认文件权限)
umask 022

# ---------------------
#      其他工具
# ---------------------

# fzf 模糊查找工具
if [ -d "$HOME/.fzf" ]; then
    export PATH="$HOME/.fzf/bin:$PATH"
fi

# Docker
if command -v docker >/dev/null 2>&1; then
    export DOCKER_BUILDKIT=1
    export COMPOSE_DOCKER_CLI_BUILD=1
fi

# ==============================================================================
#                              配置结束
# ==============================================================================
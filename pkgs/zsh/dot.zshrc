# ==============================================================================
#                               ZSH 配置文件
# ==============================================================================
#
# 这个配置文件由环境配置工具自动生成
# 包含了 Oh My Zsh 的基础配置和常用插件
#

# Path to your oh-my-zsh installation.
export ZSH="$HOME/.oh-my-zsh"

# ==============================================================================
#                                 主题配置
# ==============================================================================

# 设置主题 (可以在 ~/.oh-my-zsh/themes/ 中查看所有主题)
# 一些推荐的主题: agnoster, powerlevel10k/powerlevel10k, robbyrussell
ZSH_THEME="agnoster"

# ==============================================================================
#                                 插件配置
# ==============================================================================

# 启用的插件列表
# 标准插件在 $ZSH/plugins/ 中
# 自定义插件在 $ZSH_CUSTOM/plugins/ 中
plugins=(
    git                      # Git 别名和提示
    sudo                     # 双击 ESC 在命令前添加 sudo
    history                  # 历史命令搜索
    colored-man-pages        # 彩色 man 页面
    command-not-found        # 命令未找到时的建议
    extract                  # 智能解压缩
    web-search              # 网络搜索快捷方式
    copyfile                # 复制文件内容到剪贴板
    copybuffer              # 复制当前命令行到剪贴板
    dirhistory              # 目录历史导航
    zsh-autosuggestions     # 自动补全建议 (需要单独安装)
    zsh-syntax-highlighting # 语法高亮 (需要单独安装)
)

# ==============================================================================
#                            Oh My Zsh 加载
# ==============================================================================

source $ZSH/oh-my-zsh.sh

# ==============================================================================
#                               用户配置
# ==============================================================================

# 用户自定义配置
# 你可以在下面添加你的个人配置

# ---------------------
#       别名设置
# ---------------------

# 系统别名
alias ll='ls -alF'
alias la='ls -A'
alias l='ls -CF'
alias ..='cd ..'
alias ...='cd ../..'
alias ....='cd ../../..'

# 安全别名
alias rm='rm -i'
alias cp='cp -i'
alias mv='mv -i'

# Git 增强别名
alias gst='git status'
alias gaa='git add --all'
alias gcm='git commit -m'
alias gps='git push'
alias gpl='git pull'
alias gco='git checkout'
alias gbr='git branch'
alias gdf='git diff'
alias glog='git log --oneline --graph --decorate'

# 系统信息
alias sysinfo='uname -a && lsb_release -a'
alias meminfo='free -h'
alias diskinfo='df -h'

# 网络工具
alias myip='curl ifconfig.me'
alias ports='netstat -tulanp'

# ---------------------
#      环境变量
# ---------------------

# 默认编辑器
export EDITOR='nano'
export VISUAL='nano'

# 颜色支持
export CLICOLOR=1
export LSCOLORS=ExFxBxDxCxegedabagacad

# 历史设置
export HISTSIZE=10000
export SAVEHIST=10000
setopt HIST_VERIFY
setopt SHARE_HISTORY
setopt APPEND_HISTORY
setopt INC_APPEND_HISTORY
setopt HIST_IGNORE_DUPS
setopt HIST_IGNORE_ALL_DUPS
setopt HIST_REDUCE_BLANKS
setopt HIST_IGNORE_SPACE

# ---------------------
#      路径配置
# ---------------------

# 添加常用路径到 PATH
if [ -d "$HOME/.local/bin" ]; then
    export PATH="$HOME/.local/bin:$PATH"
fi

if [ -d "$HOME/bin" ]; then
    export PATH="$HOME/bin:$PATH"
fi

# Bun
if [ -d "$HOME/.bun" ]; then
    export BUN_INSTALL="$HOME/.bun"
    export PATH="$BUN_INSTALL/bin:$PATH"
fi

# ---------------------
#      函数定义
# ---------------------

# 创建目录并进入
mcd() {
    mkdir -p "$1" && cd "$1"
}

# 解压缩函数
extract_file() {
    if [ -f $1 ]; then
        case $1 in
            *.tar.bz2)   tar xjf $1     ;;
            *.tar.gz)    tar xzf $1     ;;
            *.bz2)       bunzip2 $1     ;;
            *.rar)       unrar x $1     ;;
            *.gz)        gunzip $1      ;;
            *.tar)       tar xf $1      ;;
            *.tbz2)      tar xjf $1     ;;
            *.tgz)       tar xzf $1     ;;
            *.zip)       unzip $1       ;;
            *.Z)         uncompress $1  ;;
            *.7z)        7z x $1        ;;
            *)           echo "'$1' 无法解压!" ;;
        esac
    else
        echo "'$1' 不是有效文件!"
    fi
}

# 搜索进程
psgrep() {
    ps aux | grep -v grep | grep "$@" -i --color=auto
}

# 端口查询
port() {
    lsof -i :"$1"
}

# ---------------------
#      加载本地配置
# ---------------------

# 如果存在本地配置文件，则加载
if [ -f ~/.zshrc.local ]; then
    source ~/.zshrc.local
fi

# ==============================================================================
#                              启动消息
# ==============================================================================

# 显示系统信息 (可选)
if [ -t 1 ]; then
    echo "🐚 Welcome to Zsh with Oh My Zsh!"
    echo "📅 $(date '+%Y-%m-%d %H:%M:%S')"
    echo "💻 $(uname -n) | $(uname -s) $(uname -r)"
    echo ""
fi

# ==============================================================================
#                               配置结束
# ==============================================================================
FROM linuxmintd/mint22.2-amd64:latest

ENV DEBIAN_FRONTEND=noninteractive

# 创建非root用户并安装基础依赖
RUN useradd -m -s /bin/bash devuser && \
    APT_LISTCHANGES_FRONTEND=none apt update && \
    APT_LISTCHANGES_FRONTEND=none apt install -y sudo curl git unzip && \
    echo 'devuser ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers && \
    rm -rf /var/lib/apt/lists/*

# 切换到非root用户
USER devuser
WORKDIR /home/devuser/eee

# 安装 Bun (作为普通用户)
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/home/devuser/.bun/bin:$PATH"

# 复制项目文件并设置权限
COPY --chown=devuser:devuser . .
RUN chmod +x env/*.ts

# 设置环境变量用于 pkg-utils
ENV REAL_USER=devuser
ENV REAL_HOME=/home/devuser

# 确保 sudo 也能找到 bun
RUN echo 'Defaults secure_path="/home/devuser/.bun/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"' | sudo tee /etc/sudoers.d/bun-path

CMD ["/bin/bash"]

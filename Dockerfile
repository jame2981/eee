FROM linuxmintd/mint22.2-amd64:latest

ENV DEBIAN_FRONTEND=noninteractive

# 创建非root用户
RUN useradd -m -s /bin/bash devuser && \
    apt-get update && \
    apt-get install -y sudo curl git && \
    echo 'devuser ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers && \
    rm -rf /var/lib/apt/lists/*

# 切换到非root用户
USER devuser
WORKDIR /home/devuser/app

# 安装 Bun (作为普通用户)
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/home/devuser/.bun/bin:$PATH"

# 复制项目文件并设置权限
COPY --chown=devuser:devuser . .
RUN chmod +x bootstrap.sh

CMD ["/bin/bash"]

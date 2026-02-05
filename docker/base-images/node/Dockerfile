FROM node:20-bookworm-slim

# Set proxy for build
ARG HTTP_PROXY
ARG HTTPS_PROXY
ENV http_proxy=${HTTP_PROXY} https_proxy=${HTTPS_PROXY}

# Install sudo and common dev tools
RUN apt-get update && apt-get install -y \
    sudo \
    git \
    curl \
    wget \
    vim \
    nano \
    jq \
    procps \
    tmux \
    && rm -rf /var/lib/apt/lists/*

# Install Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code

# Install Playwright with Chromium for MCP browser automation
RUN npx playwright install --with-deps chromium

# Create dev user with sudo access
RUN useradd -m -s /bin/bash dev \
    && echo "dev ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

# Set up working directory
WORKDIR /workspace

# Switch to dev user
USER dev

# Set environment (unset proxy from build)
ENV HOME=/home/dev
ENV PATH="/home/dev/.local/bin:${PATH}"
ENV http_proxy="" https_proxy=""

CMD ["bash"]

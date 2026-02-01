FROM node:20-bookworm

RUN apt-get update && apt-get install -y \
    git curl wget vim nano \
    postgresql-client redis-tools \
    && rm -rf /var/lib/apt/lists/*

RUN useradd -m -s /bin/bash dev
USER dev
WORKDIR /workspace

CMD ["bash"]

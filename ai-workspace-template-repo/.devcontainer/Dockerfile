FROM mcr.microsoft.com/devcontainers/typescript-node:18

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    wget \
    vim \
    tree \
    jq \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Install Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code

# Install React development tools
RUN npm install -g \
    create-react-app \
    typescript \
    @types/node \
    prettier \
    eslint \
    serve

# Install Python dependencies for workspace management
RUN pip3 install GitPython markdown2 beautifulsoup4

# Create workspace structure
RUN mkdir -p /workspace/project \
    /workspace/planning \
    /workspace/reference \
    /workspace/chat-history \
    /workspace/iterations \
    /workspace/assets

# Set up git configuration for auto-commits
RUN git config --global user.name "AI Workspace Assistant" \
    && git config --global user.email "ai@workspace.dev" \
    && git config --global init.defaultBranch main

# Create workspace helper scripts
COPY setup.sh /workspace/.devcontainer/
COPY auto-sync.sh /workspace/.devcontainer/
COPY claude-handler.py /workspace/.devcontainer/

RUN chmod +x /workspace/.devcontainer/*.sh

WORKDIR /workspace

# Expose ports for development
EXPOSE 3000 3001 8080

CMD ["bash"]
# Agent Workspace Dockerfile
# Optimized for autonomous React Native/Expo development with OpenCode

FROM node:20-bullseye

# Set default shell to bash
SHELL ["/bin/bash", "-c"]

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    wget \
    jq \
    python3 \
    python3-pip \
    build-essential \
    watchman \
    vim \
    nano \
    htop \
    tree \
    unzip \
    ca-certificates \
    gnupg \
    lsb-release \
    sudo \
    ripgrep \
    && rm -rf /var/lib/apt/lists/*

# Install Go 1.24+ (required for beads)
RUN wget https://go.dev/dl/go1.24.0.linux-arm64.tar.gz && \
    tar -C /usr/local -xzf go1.24.0.linux-arm64.tar.gz && \
    rm go1.24.0.linux-arm64.tar.gz
ENV PATH="/usr/local/go/bin:${PATH}"

# Skip Docker CLI installation for now (can be added later if needed for nested containers)

# Install global npm packages (yarn is already installed)
RUN npm install -g \
    @expo/cli@latest \
    eas-cli@latest \
    typescript \
    ts-node \
    nodemon \
    eslint

# Create agent user with sudo privileges for full autonomy
RUN useradd -m -s /bin/bash agent \
    && echo "agent:agent" | chpasswd \
    && usermod -aG sudo agent \
    && echo "agent ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

# Install beads (bd) CLI as agent user
USER agent
WORKDIR /home/agent
ENV GOPATH="/home/agent/go"
ENV PATH="${PATH}:/home/agent/go/bin"
RUN curl -fsSL https://raw.githubusercontent.com/steveyegge/beads/main/scripts/install.sh | bash

# Switch back to root for remaining setup
USER root

# Set up agent environment
USER agent
WORKDIR /home/agent

# Create agent-specific directories
RUN mkdir -p /home/agent/.config /home/agent/.cache /home/agent/tools

# Set up git config for agent
RUN git config --global user.name "OpenCode Agent" && \
    git config --global user.email "agent@localhost" && \
    git config --global init.defaultBranch main

# Install OpenCode CLI as agent user
RUN curl -fsSL https://opencode.ai/install | bash

# Add OpenCode to PATH permanently for the agent user
RUN echo 'export PATH="$HOME/.opencode/bin:$PATH"' >> /home/agent/.bashrc

# Switch back to root to create scripts with proper permissions
USER root

# Create autonomous agent startup script
COPY <<EOF /home/agent/agent-startup.sh
#!/bin/bash
# Autonomous agent startup script - keeps container running

# Add OpenCode and bd to PATH
export PATH="\$HOME/.opencode/bin:\$HOME/go/bin:\$PATH"

# Clone repo on first run (if workspace is empty)
if [ ! -d /workspace/.git ]; then
    echo "📥 Cloning repository..."

    # Fix ownership of volume-mounted directories (created as root by Docker)
    # This allows git clone to write files into these directories
    if [ -d /workspace/app ]; then
        sudo chown -R agent:agent /workspace/app
    fi

    # Ensure SSH is configured properly for git operations
    if [ -d ~/.ssh ]; then
        # Start ssh-agent and add keys
        eval "\$(ssh-agent -s)" > /dev/null 2>&1
        ssh-add ~/.ssh/id_* 2>/dev/null || true
    fi

    # Get the remote URL from the host repo
    REMOTE_URL=\$(git -C /host-repo remote get-url origin 2>/dev/null || echo "")

    if [ -n "\$REMOTE_URL" ]; then
        echo "📡 Cloning from remote: \$REMOTE_URL"
        # Clone from actual remote (preserves proper remote configuration)
        git clone "\$REMOTE_URL" /tmp/workspace-clone
    else
        echo "⚠️  No remote found, cloning from local"
        # Fallback to local clone
        git clone file:///host-repo /tmp/workspace-clone
    fi

    # Move contents to /workspace (can't clone directly to mounted volume)
    if [ -d /tmp/workspace-clone ]; then
        cp -a /tmp/workspace-clone/. /workspace/
        rm -rf /tmp/workspace-clone
        cd /workspace

        # Create and checkout agent branch
        if [ -n "\$AGENT_BRANCH" ]; then
            echo "🌿 Creating branch: \$AGENT_BRANCH"
            git checkout -b "\$AGENT_BRANCH"
        fi

        echo "✅ Repository cloned and ready"
        echo "📌 You can push to remote with: git push origin \$AGENT_BRANCH"
    else
        echo "❌ Failed to clone repository"
    fi
fi

cd /workspace

echo "🤖 OpenCode Agent Workspace Ready"
echo "📂 Workspace: \$(pwd)"
echo "🌿 Branch: \$(git branch --show-current 2>/dev/null || echo 'unknown')"
echo "🎯 Agent ID: \$AGENT_ID"
echo ""

# Check if OpenCode is available
if command -v opencode >/dev/null 2>&1; then
    echo "✅ OpenCode is installed at: \$(which opencode)"
else
    echo "⚠️  OpenCode not found in PATH"
fi

echo ""
echo "💡 Container is running. Access the shell with:"
echo "   agent-cli.sh shell \$AGENT_ID"
echo ""
echo "📋 Available commands:"
echo "   opencode      - Start OpenCode"
echo "   npm run test  - Run tests"
echo "   git status    - Check changes"
echo "   bd ready      - Check available issues"
echo ""

# Keep container running indefinitely
# This allows users to shell in and run commands
exec tail -f /dev/null
EOF

# Create shell access script
COPY <<EOF /home/agent/shell-access.sh
#!/bin/bash
# Interactive shell access for debugging

# Add OpenCode and bd to PATH
export PATH="\$HOME/.opencode/bin:\$HOME/go/bin:\$PATH"

# Set up SSH agent for git operations
if [ -d ~/.ssh ]; then
    eval "\$(ssh-agent -s)" > /dev/null 2>&1
    ssh-add ~/.ssh/id_* 2>/dev/null || true
fi

echo "🐚 OpenCode Agent Shell Access"
echo "📂 Workspace: \$(pwd)"
echo "🌿 Branch: \$(git branch --show-current 2>/dev/null || echo 'unknown')"
echo "🎯 Agent ID: \$AGENT_ID"
echo ""
echo "Available commands:"
echo "  opencode          - Start OpenCode"
echo "  npm run precommit - Run tests"
echo "  git status        - Check changes"
echo "  git push          - Push to remote"
echo "  bd ready          - Check available issues"
echo ""

exec /bin/bash
EOF

# Set permissions and ownership for agent scripts
RUN chmod +x /home/agent/agent-startup.sh /home/agent/shell-access.sh && \
    chown agent:agent /home/agent/agent-startup.sh /home/agent/shell-access.sh

# Switch back to agent user
USER agent

# Set working directory for agent operations
WORKDIR /workspace

# Expose common ports
EXPOSE 8081 19000 19001 19002

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node --version && git --version || exit 1

# Default command for autonomous operation
CMD ["/home/agent/agent-startup.sh"]
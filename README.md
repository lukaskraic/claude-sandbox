# Claude Sandbox

Web-based platform for creating isolated, containerized development environments that enable Claude Code to work in secure, sandboxed project spaces.

## Overview

Claude Sandbox provides a complete solution for running Claude Code (Anthropic's AI-powered CLI) in isolated containers. Each session gets its own container with a dedicated Git worktree, allowing multiple users to work on the same project simultaneously without conflicts.

### Key Features

#### Container & Isolation
- **Containerized Environments** - Each session runs in an isolated Linux container (Podman/Docker)
- **Git Worktree Isolation** - Every session gets its own Git branch and worktree, multiple users can work on the same project simultaneously
- **Custom Docker Images** - Auto-generated images with configurable runtimes (Java, Node.js, Python, Go) and tools
- **Service Containers** - Built-in support for PostgreSQL, MySQL, Redis, MongoDB with automatic networking

#### Web Terminal
- **Real-time Terminal** - WebSocket-based terminal (xterm.js + tmux) with persistent sessions
- **Image Paste Support** - Paste images directly into Claude Code using **Ctrl+V** - images are uploaded and inserted as file paths
- **Clipboard Integration** - Full clipboard support for text and images between browser and container
- **Session Persistence** - Terminal sessions survive page refresh (tmux-backed)

#### Claude Code Integration
- **Local User Mapping** - Claude Code binary and settings are mounted from a local user's home directory (no installation in container)
- **MCP Server Support** - Use Model Context Protocol servers (Playwright, etc.) configured in user's `~/.claude.json`
- **Shared License** - Uses your existing Claude Code subscription/license

#### Git Integration
- **Per-Session Git Config** - Configure git user name and email per session for proper commit attribution
- **GitHub Token Support** - Optional GitHub token for private repository access
- **Built-in Git UI** - View status, diff, log, create commits, push/pull directly from web UI
- **Branch Isolation** - Each session works on its own branch, easy to merge or discard changes

#### Port Forwarding
- **Dynamic Port Mapping** - Container ports are automatically mapped to available host ports
- **Service Discovery** - Access databases and services via internal container network
- **HTTP Proxy** - Access container web services through the sandbox proxy (no direct port exposure needed)

#### Development Tools
- **File Browser** - Navigate and view project files in the web UI
- **Code Editor** - Edit files directly with syntax highlighting (CodeMirror 6)
- **Multi-user Support** - Session-based authentication with user isolation

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Web Browser                               │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐               │
│  │  Projects   │ │  Sessions   │ │  Terminal   │               │
│  │    View     │ │    View     │ │    View     │               │
│  └─────────────┘ └─────────────┘ └─────────────┘               │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTP/WebSocket
┌────────────────────────┴────────────────────────────────────────┐
│                     Node.js Server                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │  tRPC    │ │ WebSocket│ │  Proxy   │ │  Upload  │          │
│  │  Router  │ │ Terminal │ │  Router  │ │  API     │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                     Services Layer                         │ │
│  │  SessionService │ ContainerService │ GitService │ Auth    │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                     SQLite Database                        │ │
│  └────────────────────────────────────────────────────────────┘ │
└────────────────────────┬────────────────────────────────────────┘
                         │ Container API
┌────────────────────────┴────────────────────────────────────────┐
│                    Podman / Docker                               │
│  ┌─────────────────┐  ┌─────────────────┐                      │
│  │ Session Container│  │ Service Container│                     │
│  │ ┌─────────────┐ │  │ (PostgreSQL,    │                      │
│  │ │  Worktree   │ │  │  MySQL, Redis)  │                      │
│  │ │ /workspace  │ │  │                 │                      │
│  │ ├─────────────┤ │  └─────────────────┘                      │
│  │ │Claude Code  │ │                                           │
│  │ │  /.claude   │ │                                           │
│  │ ├─────────────┤ │                                           │
│  │ │   tmux      │ │                                           │
│  │ └─────────────┘ │                                           │
│  └─────────────────┘                                           │
└─────────────────────────────────────────────────────────────────┘
```

## Technology Stack

### Backend
- **Node.js 20** with TypeScript
- **Express** - HTTP server
- **tRPC 10** - Type-safe RPC
- **WebSocket (ws)** - Terminal streaming
- **SQLite** (better-sqlite3) - Persistent storage
- **Dockerode** - Container management
- **simple-git** - Git operations

### Frontend
- **Vue 3** with Composition API
- **Vuetify 3** - Material Design UI
- **Vue Router** - Client-side routing
- **xterm.js** - Terminal emulation
- **CodeMirror 6** - Code editing
- **Shiki** - Syntax highlighting

### Infrastructure
- **Podman** (primary) or Docker
- **systemd** - Service management

## Project Structure

```
claude-sandbox/
├── packages/
│   ├── server/                 # Backend API
│   │   └── src/
│   │       ├── services/       # Business logic
│   │       ├── trpc/           # API routes
│   │       ├── db/             # Database layer
│   │       ├── ws/             # WebSocket handlers
│   │       └── middleware/     # Auth middleware
│   ├── web/                    # Frontend UI
│   │   └── src/
│   │       ├── views/          # Page components
│   │       ├── components/     # UI components
│   │       ├── stores/         # State management
│   │       └── router/         # Route definitions
│   └── shared/                 # Shared TypeScript types
├── scripts/
│   └── deploy.sh               # Deployment script
└── docs/                       # Documentation
```

## Workflow

### 1. Create a Project

Projects are reusable templates that define:
- Git repository URL and default branch
- Base Docker image (Ubuntu, Debian, etc.)
- Runtime versions (Java, Node.js, Python, Go)
- System packages and tools
- Service containers (databases, caching)
- Custom setup scripts
- Environment variables
- MCP server configurations

### 2. Create a Session

Sessions are instances of projects. When creating a session:
- Choose a project template
- Optionally specify a custom branch
- Configure Git user for commits
- Select which user's `.claude` directory to mount

### 3. Start the Session

When a session starts:
1. **Git Setup** - Clone/fetch repository, create worktree with isolated branch
2. **Image Building** - Generate Dockerfile from config, build (cached by config hash)
3. **Service Containers** - Start PostgreSQL, MySQL, Redis, etc.
4. **Main Container** - Launch with mounted worktree, Claude Code config, and network access
5. **Terminal** - tmux session created for persistent terminal access

### 4. Work in the Session

Inside the container:
- Edit files in `/workspace` (mounted from worktree)
- Run Claude Code CLI (binary mounted from host)
- Execute Git commands (pre-configured with user info)
- Access service containers over internal network
- Use forwarded ports for external access

### 5. Manage Sessions

- **Stop** - Container stopped, worktree preserved
- **Restart** - Resume work where you left off
- **Remove** - Clean up container and worktree

## Configuration

### Environment Variables

```bash
PORT=3020                          # Server port
HOST=127.0.0.1                     # Listen address
DATA_DIR=/path/to/data             # Persistent data directory
WORKTREE_BASE=/path/to/worktrees   # Git worktrees location
CONTAINER_RUNTIME=podman           # Container runtime (podman/docker)
CONTAINER_SOCKET=/run/podman/podman.sock
LOG_LEVEL=info                     # Logging level
CLAUDE_SOURCE_USERS=user1,user2    # Users whose .claude can be mounted
AUTH_USERS=user:password           # Authentication credentials (optional)
```

### Authentication

Authentication is **optional**. If `AUTH_USERS` is not set or empty, the application runs without login - anyone can access the web UI.

To enable authentication, set `AUTH_USERS` with comma-separated `username:password` pairs:

```bash
# Single user
AUTH_USERS=admin:secretpassword

# Multiple users
AUTH_USERS=admin:pass1,developer:pass2,guest:pass3
```

**Security note:** For production deployments exposed to the internet, always configure authentication or use a reverse proxy with its own auth layer.

### Claude Code Integration

Claude Code is **not installed in the container**. Instead, the installation and settings are mapped from a local user on the host system. When creating a session, you select which user's Claude Code configuration to use.

#### License Sharing

The sandbox uses the **Claude Code subscription/license** from the source user account. This means:

- All sessions using the same `claudeSourceUser` share that user's Claude subscription
- The source user must have a valid Claude Code subscription (Max plan recommended for heavy usage)
- API usage and billing goes to the source user's account

**Recommendation:** Create a dedicated shared account for the sandbox (e.g., `claude-shared`) with:
- Active Claude Code subscription
- All required plugins installed
- MCP servers configured
- Proper `.gitconfig` settings

#### Session Isolation

Each sandbox session gets its **own isolated copy** of the Claude Code state:

| Component | Isolation | Notes |
|-----------|-----------|-------|
| Conversation history | Per-session | Each session has independent Claude conversations |
| Session state | Per-session | No mixing between concurrent sessions |
| Settings | Copied at start | Changes don't affect other sessions |
| License/subscription | Shared | Uses source user's subscription |
| Binary (`~/.local`) | Shared read-only | Claude Code executable |

This prevents Claude Code sessions from "mixing" when multiple sandbox sessions run simultaneously.

#### How it works

When a session starts with a configured `claudeSourceUser`:

1. **First start:** Copies source user's `.claude/` to session-specific directory
2. **Subsequent starts:** Reuses existing session state
3. **State location:** `DATA_DIR/claude-state/{session-id}/.claude`

Mounted directories:

| Source | Container Path | Purpose |
|--------|----------------|---------|
| `DATA_DIR/claude-state/{session}/.claude` | `/home/<user>/.claude` | Session-specific Claude state |
| `DATA_DIR/claude-state/{session}/.claude.json` | `/home/<user>/.claude.json` | Session-specific config |
| `/home/<user>/.local` | `/home/<user>/.local` | Claude Code binary (shared) |
| `/home/<user>/.gitconfig` | `/home/<user>/.gitconfig` | Git config (if session doesn't override) |

**Important:** Container paths match the source user's paths because Claude Code stores absolute paths in configuration.

#### Container user mapping

The container runs as the **same UID/GID** as the source user on the host. This ensures:
- File permissions work correctly
- Claude Code can read/write its configuration
- Git commits use the correct user identity

#### Plugins and MCP Servers

**Install all plugins and MCP servers on the shared source user account.** These are copied to each session at first start.

Recommended setup on the source user:

```bash
# Login as the source user
su - claude-shared

# Install plugins
claude plugins add frontend-design@claude-plugins-official
claude plugins add security-guidance@claude-code-plugins
claude plugins add context7@claude-plugins-official

# Add MCP servers (user scope = stored in ~/.claude.json)
claude mcp add --transport stdio --scope user playwright -- npx -y @playwright/mcp@latest --headless --no-sandbox --isolated
```

Plugins and MCP servers configured with `--scope user` are stored in `~/.claude.json` and automatically available in all sandbox sessions.

#### User setup requirements

Before a user can be used as a Claude source:

1. Add to `CLAUDE_SOURCE_USERS` environment variable
2. Configure ACL permissions (see [Step 7: Configure User Access](#step-7-configure-user-access))
3. Have Claude Code installed locally (`~/.local/bin/claude`)
4. Have active Claude Code subscription
5. Install all required plugins and MCP servers

### Project Configuration Example

```typescript
{
  name: "my-project",
  description: "Project description",
  git: {
    remote: "git@github.com:org/repo.git",
    defaultBranch: "main"
  },
  environment: {
    baseImage: "ubuntu:24.04",
    runtimes: {
      node: "20",
      java: "21"
    },
    packages: ["curl", "jq", "vim"],
    tools: {
      npm: ["typescript", "eslint"],
      pip: ["pytest"]
    },
    services: [
      { type: "postgres", version: "16", database: "app", user: "dev", password: "dev" }
    ],
    setup: "npm install",
    ports: ["3000", "8080"],
    env: {
      NODE_ENV: "development"
    }
  },
  claude: {
    claudeMd: "# Project Instructions\n...",
    mcpServers: [
      { name: "playwright", command: "npx", args: ["-y", "@playwright/mcp@latest", "--headless", "--no-sandbox", "--isolated"], enabled: true }
    ]
  }
}
```

## Data Model

### Projects
Reusable configuration templates stored in SQLite.

### Sessions
Runtime instances with:
- Reference to parent project
- Git worktree path and branch
- Container ID and port mappings
- User configuration (git name, email, GitHub token)
- Status (pending, starting, running, stopped, error)

### Images
Cached Docker images indexed by configuration hash for fast session startup.

## Security

- **Container Isolation** - Each session runs in its own container
- **Filesystem Isolation** - Worktrees are per-session, changes don't affect others
- **Network Isolation** - Service containers connected via Docker bridge network
- **Authentication** - Session-based auth with SQLite-persisted sessions
- **Permission Model** - ACL-based permissions without requiring root access

## Installation Guide

### Prerequisites

#### System Requirements
- Linux server (RHEL/CentOS 9, Ubuntu 22.04+, Debian 12+)
- 4GB+ RAM recommended
- 20GB+ disk space for containers and worktrees

#### Software Dependencies
- **Node.js 20+** - JavaScript runtime
- **pnpm** - Package manager
- **Podman** (recommended) or Docker - Container runtime
- **Git** - Version control
- **ACL tools** - For permission management (`setfacl`)

### Step 1: Install System Dependencies

#### RHEL/CentOS 9
```bash
# Install Node.js 20
dnf module install nodejs:20

# Install pnpm
npm install -g pnpm

# Install Podman
dnf install podman

# Install ACL tools
dnf install acl

# Enable Podman socket for rootless containers
systemctl --user enable --now podman.socket
```

#### Ubuntu/Debian
```bash
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
apt install -y nodejs

# Install pnpm
npm install -g pnpm

# Install Podman
apt install -y podman

# Install ACL tools
apt install -y acl

# Enable Podman socket
systemctl --user enable --now podman.socket
```

### Step 2: Create Service User

```bash
# Create dedicated user for the service
useradd -r -m -d /srv/claude-sandbox claude-sandbox

# Create directory structure
mkdir -p /srv/claude-sandbox/{app,data,worktrees}
chown -R claude-sandbox:claude-sandbox /srv/claude-sandbox
```

### Step 3: Clone and Build

```bash
# Clone repository
cd /srv/claude-sandbox
git clone <repository-url> app
cd app

# Install dependencies
pnpm install

# Build all packages
pnpm build
```

### Step 4: Configure Podman Socket Access

The service needs access to Podman socket for container management:

```bash
# Option A: Use system-wide Podman socket (recommended for production)
systemctl enable --now podman.socket

# Grant service user access to Podman socket
usermod -aG podman claude-sandbox
```

Or configure rootless Podman:

```bash
# As claude-sandbox user
su - claude-sandbox
systemctl --user enable --now podman.socket
```

### Step 5: Create systemd Service

Create `/etc/systemd/system/claude-sandbox.service`:

```ini
[Unit]
Description=Claude Sandbox Platform
After=network.target podman.socket

[Service]
Type=simple
User=claude-sandbox
Group=claude-sandbox
WorkingDirectory=/srv/claude-sandbox/app
ExecStart=/usr/bin/node packages/server/dist/index.js
Restart=on-failure
RestartSec=5

# Environment
Environment="NODE_ENV=production"
Environment="PORT=3020"
Environment="HOST=127.0.0.1"
Environment="DATA_DIR=/srv/claude-sandbox/data"
Environment="WORKTREE_BASE=/srv/claude-sandbox/worktrees"
Environment="CONTAINER_RUNTIME=podman"
Environment="CONTAINER_SOCKET=/run/podman/podman.sock"
Environment="LOG_LEVEL=info"

# Authentication (optional - omit for no login required)
# Environment="AUTH_USERS=admin:changeme"

# Users whose .claude directory can be mounted
Environment="CLAUDE_SOURCE_USERS=user1,user2"

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
systemctl daemon-reload
systemctl enable --now claude-sandbox
systemctl status claude-sandbox
```

### Step 6: Configure Reverse Proxy (Optional)

#### Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name sandbox.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://127.0.0.1:3020;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket timeout
        proxy_read_timeout 86400;
    }
}
```

#### Apache httpd

```apache
<VirtualHost *:443>
    ServerName sandbox.example.com

    SSLEngine on
    SSLCertificateFile /path/to/cert.pem
    SSLCertificateKeyFile /path/to/key.pem

    ProxyPreserveHost On
    ProxyPass / http://127.0.0.1:3020/
    ProxyPassReverse / http://127.0.0.1:3020/

    # WebSocket support
    RewriteEngine On
    RewriteCond %{HTTP:Upgrade} websocket [NC]
    RewriteCond %{HTTP:Connection} upgrade [NC]
    RewriteRule ^/?(.*) ws://127.0.0.1:3020/$1 [P,L]
</VirtualHost>
```

### Step 7: Configure User Access

Claude Code is **not installed in containers**. Instead, each user must have Claude Code installed locally, and the sandbox mounts their configuration into containers.

#### Prerequisites for each user

1. **Install Claude Code locally** (as the user):
   ```bash
   # Claude Code installs to ~/.local/bin/claude
   curl -fsSL https://claude.ai/install.sh | sh
   ```

2. **Configure MCP servers** (optional, for browser automation etc.):
   ```bash
   # Example: Add Playwright MCP for browser automation
   claude mcp add --transport stdio --scope user playwright -- npx -y @playwright/mcp@latest --headless --no-sandbox --isolated
   ```

#### Grant service access

```bash
# Grant service access to user's home directory (for path traversal)
setfacl -m u:claude-sandbox:rx /home/<username>

# Grant access to .claude directory (settings, state, conversations)
setfacl -Rm u:claude-sandbox:rwX /home/<username>/.claude
setfacl -Rdm u:claude-sandbox:rwX /home/<username>/.claude

# Grant access to .local directory (Claude Code binary)
setfacl -Rm u:claude-sandbox:rwX /home/<username>/.local
setfacl -Rdm u:claude-sandbox:rwX /home/<username>/.local
```

#### Enable user in service

Add username to `CLAUDE_SOURCE_USERS` environment variable in the service file:

```bash
Environment="CLAUDE_SOURCE_USERS=user1,user2,newuser"
```

Then reload the service:
```bash
systemctl daemon-reload
systemctl restart claude-sandbox
```

### Step 8: Verify Installation

```bash
# Check service status
systemctl status claude-sandbox

# Check logs
journalctl -u claude-sandbox -f

# Test API
curl http://127.0.0.1:3020/health
# Should return: {"status":"ok","timestamp":"..."}

# Test authentication
curl http://127.0.0.1:3020/trpc/auth.me
# Should return: {"result":{"data":{"user":null,"authRequired":true}}}
```

### Troubleshooting

#### Container permission issues
```bash
# Check Podman socket permissions
ls -la /run/podman/podman.sock

# Verify service user can access Podman
su - claude-sandbox -c "podman ps"
```

#### Git worktree issues
```bash
# Configure git safe.directory globally
git config --global --add safe.directory '*'
```

#### ACL not working
```bash
# Check if ACL is supported on filesystem
mount | grep acl

# Re-mount with ACL support if needed
mount -o remount,acl /home
```

---

## Development

### Prerequisites
- Node.js 20+
- pnpm
- Podman or Docker

### Setup

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Development mode (with hot reload)
pnpm dev
```

### Deploy

```bash
sudo ./scripts/deploy.sh
```

## API Endpoints

### tRPC Routes

- `auth.login` / `auth.logout` / `auth.me` - Authentication
- `project.*` - Project CRUD operations
- `session.*` - Session lifecycle management
- `session.git*` - Git operations (status, log, diff, commit, push, pull)
- `file.*` - File operations
- `container.*` - Container management (admin)

### WebSocket

- `/ws?session={id}` - Terminal streaming
- `/proxy/*` - HTTP/WebSocket proxy to container services

## License

Private repository.

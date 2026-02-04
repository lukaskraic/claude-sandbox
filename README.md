# Claude Sandbox

Web-based platform for creating isolated, containerized development environments that enable Claude Code to work in secure, sandboxed project spaces.

## Overview

Claude Sandbox provides a complete solution for running Claude Code (Anthropic's AI-powered CLI) in isolated containers. Each session gets its own container with a dedicated Git worktree, allowing multiple users to work on the same project simultaneously without conflicts.

### Key Features

- **Containerized Environments** - Each session runs in an isolated Linux container (Podman/Docker)
- **Git Worktree Isolation** - Every session gets its own Git branch and worktree
- **Custom Docker Images** - Auto-generated images with configurable runtimes and tools
- **Service Containers** - Built-in support for PostgreSQL, MySQL, Redis, MongoDB
- **Web Terminal** - Real-time terminal access via WebSocket (xterm.js + tmux)
- **Multi-user Support** - Session-based authentication with user isolation
- **Claude Code Integration** - Mounts `.claude` directory for persistent configuration
- **MCP Server Support** - Configure Model Context Protocol servers (e.g., Playwright)
- **Port Forwarding** - Access container services from host
- **File Browser & Editor** - View and edit files directly in the web UI

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
AUTH_USERS=user:password           # Authentication credentials
```

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
      { name: "playwright", command: "npx", args: ["-y", "@playwright/mcp@latest"], enabled: true }
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

# Authentication (change these!)
Environment="AUTH_USERS=admin:changeme"

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

For each user who wants to use their Claude Code configuration:

```bash
# Grant service access to user's home directory (for path traversal)
setfacl -m u:claude-sandbox:rx /home/<username>

# Grant access to .claude directory
setfacl -Rm u:claude-sandbox:rwX /home/<username>/.claude
setfacl -Rdm u:claude-sandbox:rwX /home/<username>/.claude

# Grant access to .local directory (Claude Code binary)
setfacl -Rm u:claude-sandbox:rwX /home/<username>/.local
setfacl -Rdm u:claude-sandbox:rwX /home/<username>/.local
```

Add user to `CLAUDE_SOURCE_USERS` environment variable in the service file.

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

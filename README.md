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

# Development mode
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

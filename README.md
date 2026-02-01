# Claude Sandbox

Platform for sandboxed Claude Code development environments.

## Quick Start

```bash
# Install dependencies
pnpm install

# Start development
pnpm dev
```

## Structure

- `packages/server` - Backend API (Express + tRPC)
- `packages/web` - Frontend (Vue 3 + Vuetify)
- `packages/shared` - Shared TypeScript types
- `docker/` - Docker images and compose files

## Requirements

- Node.js 20+
- pnpm 8+
- Podman or Docker

# Claude Sandbox Platform - MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a platform for sandboxed Claude Code development environments with project management, session lifecycle, and web UI.

**Architecture:** Monorepo with server (Express + tRPC), web (Vue 3 + Vuetify 3), shared types. Sessions run in Podman containers with git worktree mounts.

**Tech Stack:** Node.js 20, TypeScript, Express, tRPC, Vue 3, Vuetify 3, SQLite, Podman, xterm.js

---

## Prerequisites

```bash
# Set proxy (if needed)
export http_proxy=http://proxy.alanata.sk:8080
export https_proxy=http://proxy.alanata.sk:8080

# Install pnpm via npm
npm install -g pnpm

# Install podman
sudo dnf install podman
```

---

## Phase 1: Foundation

### Task 1: Initialize Monorepo Structure

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `.prettierrc`

**Step 1: Create root package.json**

```json
{
  "name": "claude-sandbox",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "pnpm -r --parallel dev",
    "build": "pnpm -r build",
    "lint": "eslint . --ext .ts,.vue",
    "format": "prettier --write .",
    "test": "pnpm -r test",
    "typecheck": "pnpm -r typecheck"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "@typescript-eslint/parser": "^7.0.0",
    "eslint": "^8.57.0",
    "prettier": "^3.2.0",
    "typescript": "^5.3.0"
  },
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=8.0.0"
  }
}
```

**Step 2: Commit**

```bash
git add -A
git commit -m "chore: initialize monorepo structure"
```

---

### Task 2-18: [See full plan below]

## Execution Checklist

- [ ] Task 1: Initialize Monorepo Structure
- [ ] Task 2: Create Shared Package
- [ ] Task 3: Create Server Package - Base Setup
- [ ] Task 4: Server - Database Layer
- [ ] Task 5: Server - Git Service
- [ ] Task 6: Server - Container Service
- [ ] Task 7: Server - Session Service
- [ ] Task 8: Server - Project Service
- [ ] Task 9: Server - tRPC Router
- [ ] Task 10: Server - WebSocket Terminal Handler
- [ ] Task 11: Server - Update Entry Point
- [ ] Task 12: Create Web Package - Base Setup
- [ ] Task 13: Web - Router and API Client
- [ ] Task 14: Web - Stores
- [ ] Task 15: Web - Views (Projects)
- [ ] Task 16: Web - Views (Sessions)
- [ ] Task 17: Docker Base Images
- [ ] Task 18: Root Configuration Files

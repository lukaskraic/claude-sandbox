# MCP Servers Support in Claude Sandbox

## Overview

Add support for configuring MCP (Model Context Protocol) servers at project level, with preset support for common servers like Playwright.

## Data Model

### New Types (`packages/shared/src/types/project.ts`)

```typescript
export interface MCPServerConfig {
  id: string                      // unique identifier
  name: string                    // display name (e.g., "playwright")
  command: string                 // command (e.g., "npx")
  args: string[]                  // arguments (e.g., ["-y", "@playwright/mcp@latest"])
  env?: Record<string, string>    // env variables
  enabled: boolean                // on/off toggle
}

export type MCPPreset = 'playwright'

// Extended ProjectClaudeConfig
export interface ProjectClaudeConfig {
  claudeMd?: string
  permissions?: string[]
  mcpServers?: MCPServerConfig[]  // NEW
}
```

## Playwright Preset

When user selects Playwright preset, automatically configure:

**MCP Server:**
- `command: "npx"`
- `args: ["-y", "@playwright/mcp@latest"]`
- `env: { PLAYWRIGHT_MCP_HEADLESS: "true", PLAYWRIGHT_MCP_BROWSER: "chromium" }`

**APT Packages (added to image):**
- `chromium`
- `fonts-liberation`
- `libnss3`
- `libatk-bridge2.0-0`
- `libgtk-3-0`
- `libgbm1`
- `libasound2`

## Session Startup

When session starts, generate `.mcp.json` in worktree root:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"],
      "env": {
        "PLAYWRIGHT_MCP_HEADLESS": "true",
        "PLAYWRIGHT_MCP_BROWSER": "chromium"
      }
    }
  }
}
```

Note: Only enabled servers are included in `.mcp.json`.

## UI Design

New expansion panel "MCP Servers" in EditProjectDialog:

```
┌─ MCP Servers ─────────────────────────────────┐
│                                               │
│  [+ Add Preset ▼]  [+ Add Custom]             │
│                                               │
│  ┌─ playwright ──────────────────────┐        │
│  │ npx -y @playwright/mcp@latest     │  [🗑]  │
│  │ HEADLESS=true, BROWSER=chromium   │        │
│  │                          [toggle] │        │
│  └───────────────────────────────────┘        │
│                                               │
└───────────────────────────────────────────────┘
```

## Files to Modify

| File | Change |
|------|--------|
| `packages/shared/src/types/project.ts` | Add `MCPServerConfig`, `MCPPreset`, extend `ProjectClaudeConfig` |
| `packages/server/src/trpc/routers/projectRouter.ts` | Add Zod validation for mcpServers |
| `packages/server/src/services/SessionService.ts` | Generate `.mcp.json` on session start |
| `packages/server/src/services/ImageBuilderService.ts` | Add Playwright deps to Dockerfile when preset active |
| `packages/web/src/components/EditProjectDialog.vue` | Add MCP Servers section |

## Implementation Order

1. Shared types
2. Server validation + SessionService (.mcp.json generation)
3. ImageBuilderService (Playwright deps)
4. Frontend UI

## Security Considerations

- Project-scoped MCP servers require user approval on first use (Claude Code feature)
- MCP servers run inside container, isolated from host
- No sensitive data in `.mcp.json` - env vars can reference container environment

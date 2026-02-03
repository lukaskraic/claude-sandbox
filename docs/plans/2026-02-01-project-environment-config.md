# Project Environment Configuration - Design Document

> **For Claude:** Use this design to implement configurable container environments per project.

**Goal:** Allow projects to define what gets installed into their container (runtimes, packages, tools, services) with automatic image caching.

**Architecture:** Visual UI + YAML editor for configuration, auto-generated Dockerfile, cached images per project, sidecar containers for services.

**Tech Stack:** TypeScript, Vue 3/Vuetify, Podman/Docker, CodeMirror for YAML editor

---

## Data Model

### New Types (packages/shared/src/types/project.ts)

```typescript
export interface ProjectRuntimes {
  java?: string      // "21", "17", "11"
  node?: string      // "20", "18", "16"
  python?: string    // "3.12", "3.11"
  go?: string        // "1.22", "1.21"
}

export interface ProjectTools {
  npm?: string[]     // ["typescript", "@vue/cli"]
  pip?: string[]     // ["requests", "flask"]
  custom?: string[]  // ["claude-code"]
}

export interface ProjectService {
  type: 'postgres' | 'mysql' | 'redis' | 'mongodb' | 'elasticsearch'
  version: string
  database?: string
  user?: string
  password?: string
}

export interface ProjectEnvironment {
  baseImage: string
  runtimes?: ProjectRuntimes
  packages?: string[]
  tools?: ProjectTools
  services?: ProjectService[]
  setup?: string
  env?: Record<string, string>
}
```

### New Database Table

```sql
CREATE TABLE IF NOT EXISTS project_images (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  image_tag TEXT NOT NULL,
  config_hash TEXT NOT NULL,
  status TEXT DEFAULT 'building',
  error TEXT,
  built_at TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
```

---

## Implementation Phases

### Phase 1: Backend Foundation
- 1.1 Update shared types
- 1.2 Add project_images table + migration
- 1.3 ImageBuilderService - Dockerfile generation
- 1.4 ImageBuilderService - build & cache logic

### Phase 2: Session Integration
- 2.1 Check/build image on session start
- 2.2 Start service containers (postgres, redis)
- 2.3 Create network and connect containers
- 2.4 Set ENV variables for services

### Phase 3: Frontend - Visual Editor
- 3.1 RuntimesSelector component
- 3.2 PackagesInput component
- 3.3 ToolsConfig component
- 3.4 ServicesConfig component
- 3.5 ImageStatus component

### Phase 4: Frontend - YAML Editor
- 4.1 YAML tab with CodeMirror
- 4.2 Validation and error display
- 4.3 Sync Visual ↔ YAML
- 4.4 Format & Validate buttons

### Phase 5: Testing & Polish
- 5.1 Test build flow with various combinations
- 5.2 Test services networking
- 5.3 Error handling and UX polish

---

## UI Design

### Visual Editor
- Dropdown for base image
- Checkboxes for runtimes with version select
- Chip input for packages
- Services configuration cards
- Image status indicator + Rebuild button

### YAML Editor
- CodeMirror with YAML syntax highlighting
- Real-time validation
- Format and Validate buttons
- Bidirectional sync with Visual editor

---

## Flow

### Image Build Flow
1. Check if cached image exists (by config hash)
2. If exists and status=ready → use it
3. If not → generate Dockerfile → build → tag → cache

### Session Start Flow
1. Get/build project image
2. Start service containers (postgres, redis, etc.)
3. Create docker network
4. Start dev container with service ENV vars
5. Run setup script if any

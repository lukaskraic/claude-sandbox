# Claude Sandbox MVP Completion Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete missing MVP features: File Browser API, Files UI tab, and Docker base image.

**Architecture:** Add file operations API to backend using fs module with path validation to prevent directory traversal. Add Files tab to SessionDetailView with tree browser. Create base Docker image with Claude Code pre-installed.

**Tech Stack:** Node.js/Express, Vue 3/Vuetify 3, Podman/Docker

---

## Task 1: Add File Router to Backend

**Files:**
- Create: `packages/server/src/trpc/routers/fileRouter.ts`
- Modify: `packages/server/src/trpc/router.ts`

**Step 1: Create file router with list endpoint**

Create `packages/server/src/trpc/routers/fileRouter.ts`:

```typescript
import { z } from 'zod'
import { initTRPC, TRPCError } from '@trpc/server'
import { promises as fs } from 'fs'
import path from 'path'
import type { Context } from '../context.js'

const t = initTRPC.context<Context>().create()

function validatePath(worktreePath: string, requestedPath: string): string {
  const fullPath = path.join(worktreePath, requestedPath)
  const resolved = path.resolve(fullPath)

  // Prevent directory traversal
  if (!resolved.startsWith(path.resolve(worktreePath))) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Invalid path: directory traversal not allowed',
    })
  }

  return resolved
}

export const fileRouter = t.router({
  list: t.procedure
    .input(z.object({
      sessionId: z.string(),
      path: z.string().default('/'),
    }))
    .query(async ({ ctx, input }) => {
      const session = await ctx.services.sessionService.get(input.sessionId)
      if (!session?.worktree?.path) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session has no worktree' })
      }

      const fullPath = validatePath(session.worktree.path, input.path)
      const entries = await fs.readdir(fullPath, { withFileTypes: true })

      return entries.map((entry) => ({
        name: entry.name,
        isDirectory: entry.isDirectory(),
        path: path.join(input.path, entry.name),
      }))
    }),

  read: t.procedure
    .input(z.object({
      sessionId: z.string(),
      path: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const session = await ctx.services.sessionService.get(input.sessionId)
      if (!session?.worktree?.path) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session has no worktree' })
      }

      const fullPath = validatePath(session.worktree.path, input.path)
      const stat = await fs.stat(fullPath)

      if (stat.isDirectory()) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot read directory as file' })
      }

      const content = await fs.readFile(fullPath, 'utf-8')
      return { content, size: stat.size }
    }),

  write: t.procedure
    .input(z.object({
      sessionId: z.string(),
      path: z.string(),
      content: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.services.sessionService.get(input.sessionId)
      if (!session?.worktree?.path) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session has no worktree' })
      }

      const fullPath = validatePath(session.worktree.path, input.path)
      await fs.writeFile(fullPath, input.content, 'utf-8')
      return { success: true }
    }),

  delete: t.procedure
    .input(z.object({
      sessionId: z.string(),
      path: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.services.sessionService.get(input.sessionId)
      if (!session?.worktree?.path) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session has no worktree' })
      }

      const fullPath = validatePath(session.worktree.path, input.path)
      const stat = await fs.stat(fullPath)

      if (stat.isDirectory()) {
        await fs.rm(fullPath, { recursive: true })
      } else {
        await fs.unlink(fullPath)
      }

      return { success: true }
    }),
})
```

**Step 2: Register file router in main router**

Modify `packages/server/src/trpc/router.ts`, add import and merge:

```typescript
import { fileRouter } from './routers/fileRouter.js'

export const appRouter = t.router({
  project: projectRouter,
  session: sessionRouter,
  file: fileRouter,
})
```

**Step 3: Verify TypeScript compiles**

Run: `cd /home/licencieclaude13/work/claude-sandbox && pnpm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add packages/server/src/trpc/routers/fileRouter.ts packages/server/src/trpc/router.ts
git commit -m "feat(server): add file operations API"
```

---

## Task 2: Add Files Tab to SessionDetailView

**Files:**
- Modify: `packages/web/src/views/SessionDetailView.vue`

**Step 1: Add Files tab and file browser component**

Add to template tabs section:

```vue
<v-tab value="files">Files</v-tab>
```

Add window-item for files:

```vue
<v-window-item value="files" style="height: 100%; overflow: auto;">
  <div v-if="session.status === 'running'" class="pa-2">
    <div class="d-flex align-center mb-2">
      <v-breadcrumbs :items="breadcrumbs" density="compact">
        <template #divider>/</template>
      </v-breadcrumbs>
      <v-spacer />
      <v-btn size="small" icon="mdi-refresh" @click="loadFiles" />
    </div>
    <v-list density="compact">
      <v-list-item
        v-if="currentPath !== '/'"
        @click="navigateUp"
        prepend-icon="mdi-folder-arrow-up"
      >
        <v-list-item-title>..</v-list-item-title>
      </v-list-item>
      <v-list-item
        v-for="file in files"
        :key="file.path"
        @click="file.isDirectory ? navigateTo(file.path) : openFile(file)"
        :prepend-icon="file.isDirectory ? 'mdi-folder' : 'mdi-file-document'"
      >
        <v-list-item-title>{{ file.name }}</v-list-item-title>
      </v-list-item>
    </v-list>
  </div>
  <div v-else class="d-flex align-center justify-center" style="height: 100%;">
    <p class="text-grey">Session is not running</p>
  </div>
</v-window-item>
```

**Step 2: Add file state and methods to script**

Add to script setup:

```typescript
interface FileEntry {
  name: string
  isDirectory: boolean
  path: string
}

const currentPath = ref('/')
const files = ref<FileEntry[]>([])
const selectedFile = ref<FileEntry | null>(null)
const fileContent = ref('')

const breadcrumbs = computed(() => {
  const parts = currentPath.value.split('/').filter(Boolean)
  return [
    { title: 'root', path: '/' },
    ...parts.map((part, idx) => ({
      title: part,
      path: '/' + parts.slice(0, idx + 1).join('/'),
    })),
  ]
})

async function loadFiles() {
  if (!session.value) return
  try {
    files.value = await trpc.file.list.query({
      sessionId: session.value.id,
      path: currentPath.value,
    })
  } catch (err) {
    console.error('Failed to load files:', err)
  }
}

function navigateTo(path: string) {
  currentPath.value = path
  loadFiles()
}

function navigateUp() {
  const parts = currentPath.value.split('/').filter(Boolean)
  parts.pop()
  currentPath.value = '/' + parts.join('/')
  loadFiles()
}

async function openFile(file: FileEntry) {
  if (!session.value) return
  try {
    const result = await trpc.file.read.query({
      sessionId: session.value.id,
      path: file.path,
    })
    selectedFile.value = file
    fileContent.value = result.content
  } catch (err) {
    console.error('Failed to read file:', err)
  }
}
```

**Step 3: Load files when session is running**

Add to watch:

```typescript
watch(() => session.value?.status, async (newStatus) => {
  if (newStatus === 'running') {
    await loadSessionData()
    await loadFiles()
  }
})
```

**Step 4: Verify build**

Run: `cd /home/licencieclaude13/work/claude-sandbox && pnpm run build`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add packages/web/src/views/SessionDetailView.vue
git commit -m "feat(web): add Files tab to session detail view"
```

---

## Task 3: Create Docker Base Image

**Files:**
- Create: `docker/base-images/node/Dockerfile`
- Create: `docker/base-images/build.sh`

**Step 1: Create Node.js base image Dockerfile**

Create `docker/base-images/node/Dockerfile`:

```dockerfile
FROM node:20-bookworm

# Install Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code

# Install common dev tools
RUN apt-get update && apt-get install -y \
    git \
    curl \
    wget \
    vim \
    nano \
    jq \
    && rm -rf /var/lib/apt/lists/*

# Create dev user with sudo access
RUN useradd -m -s /bin/bash -G sudo dev \
    && echo "dev ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

# Set up working directory
WORKDIR /workspace

# Switch to dev user
USER dev

# Set environment
ENV HOME=/home/dev
ENV PATH="/home/dev/.local/bin:${PATH}"

CMD ["bash"]
```

**Step 2: Create build script**

Create `docker/base-images/build.sh`:

```bash
#!/bin/bash
set -e

REGISTRY=${REGISTRY:-"localhost"}
TAG=${TAG:-"latest"}

echo "Building claude-sandbox/node:${TAG}..."
podman build -t ${REGISTRY}/claude-sandbox/node:${TAG} -f node/Dockerfile .

echo "Build complete!"
echo "To push: podman push ${REGISTRY}/claude-sandbox/node:${TAG}"
```

**Step 3: Make build script executable**

Run: `chmod +x /home/licencieclaude13/work/claude-sandbox/docker/base-images/build.sh`

**Step 4: Commit**

```bash
git add docker/base-images/
git commit -m "feat(docker): add Node.js base image with Claude Code"
```

---

## Task 4: Deploy Updated Application

**Step 1: Build application**

Run: `cd /home/licencieclaude13/work/claude-sandbox && pnpm run build`
Expected: Build succeeds without errors

**Step 2: Copy server files**

Run:
```bash
sudo cp /home/licencieclaude13/work/claude-sandbox/packages/server/dist/*.js /srv/claude-sandbox/app/packages/server/dist/
sudo cp -r /home/licencieclaude13/work/claude-sandbox/packages/server/dist/trpc /srv/claude-sandbox/app/packages/server/dist/
```

**Step 3: Copy frontend files**

Run:
```bash
sudo rm -rf /srv/claude-sandbox/app/packages/web/dist
sudo cp -r /home/licencieclaude13/work/claude-sandbox/packages/web/dist /srv/claude-sandbox/app/packages/web/
```

**Step 4: Set ownership**

Run:
```bash
sudo chown -R claude-sandbox:claude-sandbox /srv/claude-sandbox/app/packages
```

**Step 5: Restart service**

Run:
```bash
sudo systemctl restart claude-sandbox
```

**Step 6: Verify deployment**

Run:
```bash
curl -s http://127.0.0.1:3020/health
```
Expected: `{"status":"ok",...}`

---

## Task 5: Build Docker Base Image on Server

**Step 1: Create docker directory on server**

Run:
```bash
sudo mkdir -p /srv/claude-sandbox/docker/base-images
sudo cp -r /home/licencieclaude13/work/claude-sandbox/docker/base-images/* /srv/claude-sandbox/docker/base-images/
sudo chown -R claude-sandbox:claude-sandbox /srv/claude-sandbox/docker
```

**Step 2: Build base image**

Run:
```bash
cd /srv/claude-sandbox/docker/base-images && sudo podman build -t localhost/claude-sandbox/node:latest -f node/Dockerfile .
```
Expected: Image builds successfully

**Step 3: Verify image**

Run:
```bash
sudo podman images | grep claude-sandbox
```
Expected: Shows `localhost/claude-sandbox/node` image

---

## Task 6: Configure claudeSourceUsers

**Step 1: Update server config**

Set environment variable or update config to include available users:

Run:
```bash
sudo systemctl edit claude-sandbox
```

Add:
```ini
[Service]
Environment=CLAUDE_SOURCE_USERS=licencieclaude13,kula
```

**Step 2: Restart service**

Run:
```bash
sudo systemctl daemon-reload
sudo systemctl restart claude-sandbox
```

**Step 3: Verify configuration**

Run:
```bash
curl -s http://127.0.0.1:3020/trpc/session.claudeSourceUsers
```
Expected: Returns list of users

---

## Verification Checklist

After completing all tasks:

- [ ] Server responds on https://claudeui.alanata.sk/
- [ ] Projects page loads correctly
- [ ] Can create new project
- [ ] Can create session with claudeSourceUser selection
- [ ] Can start session
- [ ] Terminal tab works
- [ ] Files tab shows worktree contents
- [ ] Git status displays correctly
- [ ] Docker base image exists

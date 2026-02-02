<template>
  <v-container fluid v-if="session" class="pa-2">
    <v-row class="mb-1" dense align="center">
      <v-col cols="auto">
        <v-btn icon="mdi-arrow-left" variant="text" :to="`/projects/${session.projectId}`" size="small" />
      </v-col>
      <v-col cols="auto" class="d-flex align-center">
        <span class="text-h6">{{ session.name }}</span>
        <v-chip :color="statusColor" size="small" class="ml-2">{{ session.status }}</v-chip>
      </v-col>
      <v-col cols="auto" v-if="gitStatus" class="d-flex align-center">
        <v-icon size="small" class="mr-1">mdi-source-branch</v-icon>
        <span class="text-body-2 font-weight-medium">{{ gitStatus.branch }}</span>
        <span v-if="session.worktree?.baseBranch" class="text-caption text-grey ml-1">
          (from {{ session.worktree.baseBranch }})
        </span>
        <v-chip v-if="gitStatus.ahead > 0" size="x-small" color="info" class="ml-1">
          +{{ gitStatus.ahead }}
        </v-chip>
        <v-chip v-if="gitStatus.behind > 0" size="x-small" color="warning" class="ml-1">
          -{{ gitStatus.behind }}
        </v-chip>
        <v-btn
          icon="mdi-refresh"
          size="x-small"
          variant="text"
          @click="loadGitStatus"
          class="ml-1"
        />
      </v-col>
      <v-col cols="auto" v-if="session.status === 'running' && availablePorts.length > 0" class="d-flex align-center">
        <v-icon size="small" class="mr-1">mdi-lan-connect</v-icon>
        <span class="text-caption text-grey mr-2">Ports:</span>
        <v-chip
          v-for="port in availablePorts"
          :key="port.container"
          size="small"
          variant="outlined"
          class="mr-1"
          :href="port.url"
          target="_blank"
          link
        >
          {{ port.container }}:{{ port.host }}
          <v-icon end size="x-small">mdi-open-in-new</v-icon>
        </v-chip>
      </v-col>
      <v-spacer />
      <v-col cols="auto">
        <v-btn
          v-if="session.status === 'stopped' || session.status === 'pending'"
          color="success"
          size="small"
          @click="start"
          :loading="loading"
        >
          Start
        </v-btn>
        <v-btn
          v-if="session.status === 'running'"
          color="warning"
          size="small"
          @click="stop"
          :loading="loading"
          class="mr-2"
        >
          Stop
        </v-btn>
        <v-btn
          v-if="session.status === 'running'"
          size="small"
          @click="restart"
          :loading="loading"
        >
          Restart
        </v-btn>
      </v-col>
    </v-row>

    <v-card>
      <v-tabs v-model="activeTab" density="compact">
        <v-tab value="terminal">Terminal</v-tab>
        <v-tab value="files">Files</v-tab>
        <v-tab value="git">Git Changes</v-tab>
        <v-tab value="logs">Logs</v-tab>
      </v-tabs>
      <v-card-text :style="{ height: terminalHeight, padding: 0 }">
        <v-window v-model="activeTab" style="height: 100%;">
          <v-window-item value="terminal" style="height: 100%; overflow: hidden;">
            <TerminalView
              v-if="session.status === 'running'"
              :session-id="session.id"
              :active="activeTab === 'terminal'"
            />
            <div v-else class="d-flex align-center justify-center" style="height: 100%;">
              <p class="text-grey">Session is not running</p>
            </div>
          </v-window-item>

          <v-window-item value="files" style="height: 100%; overflow: hidden;">
            <div v-if="session.status === 'running'" class="d-flex flex-column" style="height: 100%;">
              <div class="file-toolbar d-flex align-center px-2 py-1">
                <v-btn icon="mdi-file-plus" size="small" variant="text" title="New File" @click="showNewFileDialog = true" />
                <v-btn icon="mdi-folder-plus" size="small" variant="text" title="New Folder" @click="showNewFolderDialog = true" />
                <v-btn icon="mdi-refresh" size="small" variant="text" title="Refresh" @click="loadRootFiles" />
                <v-divider vertical class="mx-2" />
                <v-btn
                  v-if="selectedFilePath"
                  icon="mdi-delete"
                  size="small"
                  variant="text"
                  color="error"
                  title="Delete"
                  @click="deleteSelectedFile"
                />
                <v-spacer />
                <v-btn-toggle v-model="editMode" density="compact" mandatory>
                  <v-btn value="view" size="small">
                    <v-icon size="small">mdi-eye</v-icon>
                  </v-btn>
                  <v-btn value="edit" size="small">
                    <v-icon size="small">mdi-pencil</v-icon>
                  </v-btn>
                </v-btn-toggle>
              </div>
              <div class="d-flex" style="flex: 1; overflow: hidden;">
                <div class="file-tree" style="width: 280px; border-right: 1px solid rgba(255,255,255,0.12); overflow: auto;">
                  <div v-if="filesLoading" class="d-flex justify-center pa-4">
                    <v-progress-circular indeterminate size="24" />
                  </div>
                  <div v-else-if="filesError" class="pa-4 text-error">{{ filesError }}</div>
                  <v-list v-else density="compact" nav>
                    <FileTreeNode
                      v-for="item in treeItems"
                      :key="item.path"
                      :item="item"
                      :selected-path="selectedFilePath"
                      :depth="0"
                      @select="onFileSelect"
                      @toggle="onFolderToggle"
                    />
                  </v-list>
                </div>
                <div class="file-content" style="flex: 1; overflow: hidden;">
                  <div v-if="fileLoading" class="d-flex justify-center align-center" style="height: 100%;">
                    <v-progress-circular indeterminate color="primary" />
                  </div>
                  <div v-else-if="selectedFilePath && !isTextFile" class="d-flex flex-column align-center justify-center" style="height: 100%;">
                    <v-icon size="48" color="grey" class="mb-4">mdi-file-question</v-icon>
                    <span class="text-grey">Binary or unsupported file type</span>
                  </div>
                  <CodeEditor
                    v-else-if="selectedFileContent !== null && editMode === 'edit'"
                    :content="selectedFileContent"
                    :filename="selectedFilePath"
                    @save="onFileSave"
                  />
                  <CodeViewer
                    v-else-if="selectedFileContent !== null && editMode === 'view'"
                    :content="selectedFileContent"
                    :filename="selectedFilePath"
                  />
                  <div v-else class="d-flex align-center justify-center" style="height: 100%;">
                    <span class="text-grey">Select a file to view</span>
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="d-flex align-center justify-center" style="height: 100%;">
              <p class="text-grey">Session is not running</p>
            </div>

            <!-- New File Dialog -->
            <v-dialog v-model="showNewFileDialog" max-width="400">
              <v-card>
                <v-card-title>New File</v-card-title>
                <v-card-text>
                  <v-text-field
                    v-model="newFileName"
                    label="File path"
                    placeholder="path/to/file.txt"
                    hint="Relative to workspace root"
                    persistent-hint
                    autofocus
                  />
                </v-card-text>
                <v-card-actions>
                  <v-spacer />
                  <v-btn variant="text" @click="showNewFileDialog = false">Cancel</v-btn>
                  <v-btn color="primary" @click="createNewFile">Create</v-btn>
                </v-card-actions>
              </v-card>
            </v-dialog>

            <!-- New Folder Dialog -->
            <v-dialog v-model="showNewFolderDialog" max-width="400">
              <v-card>
                <v-card-title>New Folder</v-card-title>
                <v-card-text>
                  <v-text-field
                    v-model="newFolderName"
                    label="Folder path"
                    placeholder="path/to/folder"
                    hint="Relative to workspace root"
                    persistent-hint
                    autofocus
                  />
                </v-card-text>
                <v-card-actions>
                  <v-spacer />
                  <v-btn variant="text" @click="showNewFolderDialog = false">Cancel</v-btn>
                  <v-btn color="primary" @click="createNewFolder">Create</v-btn>
                </v-card-actions>
              </v-card>
            </v-dialog>
          </v-window-item>

          <v-window-item value="git" style="height: 100%; overflow: auto;">
            <div v-if="session.status === 'running'" class="pa-4">
              <!-- Header with refresh -->
              <div class="d-flex align-center mb-4">
                <span class="text-subtitle-1 font-weight-medium">Git Changes</span>
                <v-btn
                  icon="mdi-refresh"
                  size="small"
                  variant="text"
                  @click="loadGitDiff"
                  :loading="diffLoading"
                  class="ml-2"
                />
                <v-spacer />
                <div v-if="gitStatus" class="d-flex align-center ga-2">
                  <span class="text-success text-caption">+{{ totalAdditions }}</span>
                  <span class="text-error text-caption">-{{ totalDeletions }}</span>
                  <span class="text-caption text-grey ml-2">{{ allFileChanges.length }} files</span>
                </div>
              </div>

              <v-alert v-if="gitError" type="error" variant="tonal" class="mb-4">
                {{ gitError }}
              </v-alert>

              <div v-if="diffLoading" class="d-flex justify-center pa-4">
                <v-progress-circular indeterminate color="primary" />
              </div>

              <template v-else>
                <div v-if="allFileChanges.length === 0 && !gitError" class="text-grey text-center py-8">
                  <v-icon size="48" color="grey-lighten-1">mdi-source-branch-check</v-icon>
                  <p class="mt-2">Working tree clean</p>
                </div>

                <!-- GitHub-style file list -->
                <div v-else class="git-file-list">
                  <div
                    v-for="file in allFileChanges"
                    :key="file.path"
                    class="git-file-item"
                  >
                    <!-- File header - clickable -->
                    <div
                      class="git-file-header"
                      @click="toggleFileExpanded(file.path)"
                    >
                      <v-icon size="small" class="mr-2">
                        {{ expandedFiles[file.path] ? 'mdi-chevron-down' : 'mdi-chevron-right' }}
                      </v-icon>
                      <v-icon
                        size="small"
                        :color="file.status === 'staged' ? 'success' : file.status === 'untracked' ? 'grey' : 'warning'"
                        class="mr-2"
                      >
                        {{ file.status === 'untracked' ? 'mdi-file-plus' : file.status === 'staged' ? 'mdi-check' : 'mdi-pencil' }}
                      </v-icon>
                      <span class="git-file-name">{{ file.path }}</span>
                      <v-spacer />
                      <span v-if="file.additions > 0" class="text-success text-caption mr-2">+{{ file.additions }}</span>
                      <span v-if="file.deletions > 0" class="text-error text-caption">-{{ file.deletions }}</span>
                      <v-chip
                        size="x-small"
                        :color="file.status === 'staged' ? 'success' : file.status === 'untracked' ? 'grey' : 'warning'"
                        variant="tonal"
                        class="ml-2"
                      >
                        {{ file.status }}
                      </v-chip>
                    </div>
                    <!-- File diff - collapsible -->
                    <div v-if="expandedFiles[file.path] && file.diff" class="git-file-diff">
                      <div class="diff-container" v-html="renderFileDiff(file.diff)"></div>
                    </div>
                    <div v-else-if="expandedFiles[file.path] && file.status === 'untracked'" class="git-file-diff text-grey pa-4">
                      New file (not yet tracked)
                    </div>
                  </div>
                </div>
              </template>
            </div>
            <div v-else class="d-flex align-center justify-center" style="height: 100%;">
              <p class="text-grey">Session is not running</p>
            </div>
          </v-window-item>

          <v-window-item value="logs" style="height: 100%; overflow: auto;">
            <div v-if="session.status === 'running'" class="pa-4">
              <div class="d-flex align-center mb-4">
                <span class="text-subtitle-1 font-weight-medium">Container Logs</span>
                <v-btn
                  icon="mdi-refresh"
                  size="small"
                  variant="text"
                  @click="loadLogs"
                  :loading="logsLoading"
                  class="ml-2"
                />
              </div>
              <v-sheet rounded class="pa-3 bg-grey-darken-4">
                <pre v-if="logs" class="logs-content">{{ logs }}</pre>
                <p v-else class="text-grey">No logs available</p>
              </v-sheet>
            </div>
            <div v-else class="d-flex align-center justify-center" style="height: 100%;">
              <p class="text-grey">Session is not running</p>
            </div>
          </v-window-item>
        </v-window>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useSessionStore } from '@/stores/sessionStore'
import { useProjectStore } from '@/stores/projectStore'
import { trpc } from '@/api/trpc'
import type { GitStatus, SessionStatus } from '@claude-sandbox/shared'
import { html as diff2html } from 'diff2html'
import 'diff2html/bundles/css/diff2html.min.css'
import TerminalView from '@/components/TerminalView.vue'
import FileTreeNode from '@/components/FileTreeNode.vue'
import CodeEditor from '@/components/CodeEditor.vue'
import CodeViewer from '@/components/CodeViewer.vue'

interface TreeItem {
  name: string
  path: string
  isDirectory: boolean
  children?: TreeItem[]
  loaded?: boolean
  expanded?: boolean
}

const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'json', 'js', 'ts', 'tsx', 'jsx', 'vue', 'html', 'css', 'scss', 'less',
  'py', 'java', 'c', 'cpp', 'h', 'hpp', 'go', 'rs', 'rb', 'php', 'sh', 'bash', 'zsh',
  'yml', 'yaml', 'toml', 'xml', 'svg', 'sql', 'graphql', 'dockerfile', 'makefile',
  'gitignore', 'env', 'ini', 'cfg', 'conf', 'log', 'csv', 'lock',
])

const route = useRoute()
const sessionStore = useSessionStore()
const projectStore = useProjectStore()

const activeTab = ref('terminal')
const loading = ref(false)
const logs = ref('')
const gitStatus = ref<GitStatus | null>(null)
const stagedDiff = ref('')
const unstagedDiff = ref('')
const gitPanels = ref<string[]>(['unstaged'])  // Default open unstaged panel
const expandedFiles = ref<Record<string, boolean>>({})
const diffLoading = ref(false)
const logsLoading = ref(false)
const gitError = ref<string | null>(null)
const terminalHeight = ref('calc(100vh - 140px)')

const treeItems = ref<TreeItem[]>([])
const selectedFilePath = ref('')
const selectedFileContent = ref<string | null>(null)
const fileLoading = ref(false)
const filesLoading = ref(false)
const filesError = ref<string | null>(null)
const editMode = ref<'view' | 'edit'>('view')
const showNewFileDialog = ref(false)
const showNewFolderDialog = ref(false)
const newFileName = ref('')
const newFolderName = ref('')

const session = computed(() => sessionStore.sessionById(route.params.id as string))
const project = computed(() => session.value ? projectStore.projectById(session.value.projectId) : null)

// Get available ports with URLs for clicking
const availablePorts = computed(() => {
  if (!session.value?.container?.ports) return []
  const ports = session.value.container.ports
  // Get base hostname (strip port from current location)
  const baseHost = window.location.hostname
  return Object.entries(ports)
    .filter(([, host]) => host && host > 0)  // Filter out unassigned ports (0)
    .map(([container, host]) => ({
      container: parseInt(container),
      host,
      url: `http://${baseHost}:${host}`,
    }))
    .sort((a, b) => a.container - b.container)
})

const isTextFile = computed(() => {
  if (!selectedFilePath.value) return true
  const name = selectedFilePath.value.split('/').pop() || ''
  const ext = name.split('.').pop()?.toLowerCase() || ''
  const lowerName = name.toLowerCase()
  return TEXT_EXTENSIONS.has(ext) || lowerName === 'dockerfile' || lowerName === 'makefile' || lowerName.startsWith('.')
})

const stagedDiffHtml = computed(() => {
  if (!stagedDiff.value) return ''
  return diff2html(stagedDiff.value, {
    drawFileList: false,
    matching: 'lines',
    outputFormat: 'line-by-line',
  })
})

const unstagedDiffHtml = computed(() => {
  if (!unstagedDiff.value) return ''
  return diff2html(unstagedDiff.value, {
    drawFileList: false,
    matching: 'lines',
    outputFormat: 'line-by-line',
  })
})

interface FileChange {
  path: string
  status: 'staged' | 'unstaged' | 'untracked'
  diff: string
  additions: number
  deletions: number
}

function parseDiffByFile(diffContent: string, status: 'staged' | 'unstaged'): FileChange[] {
  if (!diffContent) return []

  const files: FileChange[] = []
  const fileDiffs = diffContent.split(/(?=^diff --git)/m).filter(Boolean)

  for (const fileDiff of fileDiffs) {
    const pathMatch = fileDiff.match(/^diff --git a\/(.+?) b\//)
    if (!pathMatch) continue

    const path = pathMatch[1]
    let additions = 0
    let deletions = 0

    const lines = fileDiff.split('\n')
    for (const line of lines) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        additions++
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        deletions++
      }
    }

    files.push({
      path,
      status,
      diff: fileDiff,
      additions,
      deletions,
    })
  }

  return files
}

const allFileChanges = computed<FileChange[]>(() => {
  const files: FileChange[] = []

  // Parse staged changes
  files.push(...parseDiffByFile(stagedDiff.value, 'staged'))

  // Parse unstaged changes
  files.push(...parseDiffByFile(unstagedDiff.value, 'unstaged'))

  // Add untracked files
  if (gitStatus.value?.untracked) {
    for (const path of gitStatus.value.untracked) {
      files.push({
        path,
        status: 'untracked',
        diff: '',
        additions: 0,
        deletions: 0,
      })
    }
  }

  return files.sort((a, b) => a.path.localeCompare(b.path))
})

const totalAdditions = computed(() => {
  return allFileChanges.value.reduce((sum, f) => sum + f.additions, 0)
})

const totalDeletions = computed(() => {
  return allFileChanges.value.reduce((sum, f) => sum + f.deletions, 0)
})

function toggleFileExpanded(path: string) {
  expandedFiles.value = {
    ...expandedFiles.value,
    [path]: !expandedFiles.value[path]
  }
}

function renderFileDiff(diffContent: string): string {
  if (!diffContent) return ''
  // Simple diff rendering - more stable than diff2html for scrolling
  const lines = diffContent.split('\n')
  let oldLine = 0
  let newLine = 0

  const htmlLines = lines.map(line => {
    const escaped = line
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')

    // Parse hunk header to get line numbers
    const hunkMatch = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
    if (hunkMatch) {
      oldLine = parseInt(hunkMatch[1]) - 1
      newLine = parseInt(hunkMatch[2]) - 1
      return `<div class="diff-line diff-hunk"><span class="diff-ln"></span><span class="diff-ln"></span>${escaped}</div>`
    }

    if (line.startsWith('+') && !line.startsWith('+++')) {
      newLine++
      return `<div class="diff-line diff-add"><span class="diff-ln"></span><span class="diff-ln">${newLine}</span>${escaped}</div>`
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      oldLine++
      return `<div class="diff-line diff-del"><span class="diff-ln">${oldLine}</span><span class="diff-ln"></span>${escaped}</div>`
    } else if (line.startsWith('diff ') || line.startsWith('index ') || line.startsWith('---') || line.startsWith('+++')) {
      return `<div class="diff-line diff-meta">${escaped}</div>`
    } else {
      oldLine++
      newLine++
      return `<div class="diff-line"><span class="diff-ln">${oldLine}</span><span class="diff-ln">${newLine}</span>${escaped}</div>`
    }
  })
  return `<div class="diff-content">${htmlLines.join('')}</div>`
}

const statusColor = computed(() => {
  const colors: Record<SessionStatus, string> = {
    pending: 'grey',
    starting: 'orange',
    running: 'success',
    stopping: 'orange',
    stopped: 'grey',
    error: 'error',
  }
  return session.value ? colors[session.value.status] : 'grey'
})

function updateHeight() {
  terminalHeight.value = `calc(100vh - 140px)`
}

onMounted(async () => {
  window.addEventListener('resize', updateHeight)
  await Promise.all([
    sessionStore.fetchSessions(),
    projectStore.fetchProjects(),
  ])

  // Load session data first
  await loadSessionData()

  // If running, load files and git data
  if (session.value?.status === 'running') {
    await Promise.all([
      loadRootFiles(),
      loadGitDiff(),
    ])
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', updateHeight)
})

watch(() => session.value?.status, async (newStatus) => {
  if (newStatus === 'running') {
    await loadSessionData()
    await loadRootFiles()
    await loadGitDiff()
  }
})

watch(activeTab, async (tab) => {
  if (tab === 'git' && session.value?.status === 'running') {
    await loadGitDiff()
  }
  if (tab === 'files' && session.value?.status === 'running' && treeItems.value.length === 0) {
    await loadRootFiles()
  }
  if (tab === 'logs' && session.value?.status === 'running') {
    await loadLogs()
  }
})

async function loadSessionData() {
  if (!session.value) return

  await loadLogs()

  if (session.value.status === 'running') {
    await loadGitStatus()
  }
}

async function loadLogs() {
  if (!session.value) return
  logsLoading.value = true

  try {
    const logsResult = await trpc.session.logs.query({ id: session.value.id })
    logs.value = logsResult.stdout + logsResult.stderr
  } catch (err) {
    console.error('Failed to load logs:', err)
    logs.value = ''
  } finally {
    logsLoading.value = false
  }
}

async function loadGitStatus() {
  if (!session.value || session.value.status !== 'running') return
  gitError.value = null

  try {
    const status = await trpc.session.gitStatus.query({ id: session.value.id })
    gitStatus.value = status
  } catch (err) {
    console.error('Failed to load git status:', err)
    gitError.value = err instanceof Error ? err.message : 'Failed to load git status'
    gitStatus.value = null
  }
}

async function loadGitDiff() {
  if (!session.value || session.value.status !== 'running') return
  diffLoading.value = true
  gitError.value = null

  try {
    const [staged, unstaged, status] = await Promise.all([
      trpc.session.gitDiff.query({ id: session.value.id, staged: true }),
      trpc.session.gitDiff.query({ id: session.value.id, staged: false }),
      trpc.session.gitStatus.query({ id: session.value.id }),
    ])
    stagedDiff.value = staged
    unstagedDiff.value = unstaged
    gitStatus.value = status
  } catch (err) {
    console.error('Failed to load git diff:', err)
    gitError.value = err instanceof Error ? err.message : 'Failed to load git data'
    stagedDiff.value = ''
    unstagedDiff.value = ''
  } finally {
    diffLoading.value = false
  }
}

async function loadRootFiles() {
  if (!session.value) return
  filesLoading.value = true
  filesError.value = null
  try {
    const files = await trpc.file.list.query({
      sessionId: session.value.id,
      path: '.',
    })
    treeItems.value = files.map((f: { name: string; path: string; type: string }) => ({
      name: f.name,
      path: f.path,
      isDirectory: f.type === 'directory',
      children: f.type === 'directory' ? [] : undefined,
      loaded: false,
      expanded: false,
    }))
  } catch (err) {
    console.error('Failed to load root files:', err)
    filesError.value = err instanceof Error ? err.message : 'Failed to load files'
  } finally {
    filesLoading.value = false
  }
}

async function loadChildren(item: TreeItem): Promise<void> {
  if (!session.value || !item.isDirectory || item.loaded) return
  try {
    const files = await trpc.file.list.query({
      sessionId: session.value.id,
      path: item.path,
    })
    item.children = files.map((f: { name: string; path: string; type: string }) => ({
      name: f.name,
      path: f.path,
      isDirectory: f.type === 'directory',
      children: f.type === 'directory' ? [] : undefined,
      loaded: false,
      expanded: false,
    }))
    item.loaded = true
  } catch (err) {
    console.error('Failed to load children:', err)
  }
}

async function onFolderToggle(item: TreeItem) {
  item.expanded = !item.expanded
  if (item.expanded && !item.loaded) {
    await loadChildren(item)
  }
}

async function onFileSelect(item: TreeItem) {
  if (item.isDirectory) return

  selectedFilePath.value = item.path

  if (!isTextFile.value) {
    selectedFileContent.value = null
    return
  }

  fileLoading.value = true
  try {
    const result = await trpc.file.read.query({
      sessionId: session.value!.id,
      path: item.path,
    })
    selectedFileContent.value = result.content
  } catch (err) {
    console.error('Failed to read file:', err)
    selectedFileContent.value = 'Failed to load file content'
  } finally {
    fileLoading.value = false
  }
}

async function onFileSave(content: string) {
  if (!session.value || !selectedFilePath.value) return
  try {
    await trpc.file.write.mutate({
      sessionId: session.value.id,
      path: selectedFilePath.value,
      content,
    })
    selectedFileContent.value = content
  } catch (err) {
    console.error('Failed to save file:', err)
    alert('Failed to save file')
  }
}

async function createNewFile() {
  if (!session.value || !newFileName.value.trim()) return
  try {
    const path = newFileName.value.startsWith('/') ? newFileName.value : `./${newFileName.value}`
    await trpc.file.write.mutate({
      sessionId: session.value.id,
      path,
      content: '',
    })
    showNewFileDialog.value = false
    newFileName.value = ''
    await loadRootFiles()
  } catch (err) {
    console.error('Failed to create file:', err)
    alert('Failed to create file')
  }
}

async function createNewFolder() {
  if (!session.value || !newFolderName.value.trim()) return
  try {
    const path = newFolderName.value.startsWith('/') ? newFolderName.value : `./${newFolderName.value}`
    await trpc.file.write.mutate({
      sessionId: session.value.id,
      path: `${path}/.gitkeep`,
      content: '',
    })
    showNewFolderDialog.value = false
    newFolderName.value = ''
    await loadRootFiles()
  } catch (err) {
    console.error('Failed to create folder:', err)
    alert('Failed to create folder')
  }
}

async function deleteSelectedFile() {
  if (!session.value || !selectedFilePath.value) return
  if (!confirm(`Delete ${selectedFilePath.value}?`)) return
  try {
    await trpc.file.delete.mutate({
      sessionId: session.value.id,
      path: selectedFilePath.value,
    })
    selectedFilePath.value = ''
    selectedFileContent.value = null
    await loadRootFiles()
  } catch (err) {
    console.error('Failed to delete file:', err)
    alert('Failed to delete file')
  }
}

async function start() {
  if (!session.value) return
  loading.value = true
  try {
    await sessionStore.startSession(session.value.id)
  } finally {
    loading.value = false
  }
}

async function stop() {
  if (!session.value) return
  loading.value = true
  try {
    await sessionStore.stopSession(session.value.id)
  } finally {
    loading.value = false
  }
}

async function restart() {
  if (!session.value) return
  loading.value = true
  try {
    await sessionStore.stopSession(session.value.id)
    await sessionStore.startSession(session.value.id)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.file-toolbar {
  background: #252526;
  border-bottom: 1px solid #333;
  min-height: 40px;
}

.file-tree {
  background: rgba(0, 0, 0, 0.1);
}

.file-content {
  background: #1e1e1e;
}

.untracked-list {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
}

/* diff2html dark theme */
.diff-container :deep(.d2h-wrapper) {
  background: #1e1e1e;
  border-radius: 8px;
  overflow: hidden;
}

.diff-container :deep(.d2h-file-wrapper) {
  border: 1px solid #333;
  border-radius: 8px;
  margin-bottom: 16px;
}

.diff-container :deep(.d2h-file-header) {
  background: #252526;
  padding: 10px 16px;
}

.diff-container :deep(.d2h-file-name-wrapper) {
  color: #e0e0e0;
}

.diff-container :deep(.d2h-tag) {
  background: #333;
  color: #aaa;
}

.diff-container :deep(.d2h-diff-table) {
  font-family: 'Fira Code', 'Monaco', 'Consolas', monospace;
  font-size: 13px;
}

.diff-container :deep(.d2h-code-side-line),
.diff-container :deep(.d2h-code-line) {
  background: #1e1e1e;
  color: #d4d4d4;
}

.diff-container :deep(.d2h-code-linenumber) {
  background: #252526;
  color: #606060;
  width: 50px;
  cursor: default;
}

.diff-container :deep(.d2h-ins.d2h-change),
.diff-container :deep(.d2h-ins) {
  background: rgba(46, 160, 67, 0.2);
}

.diff-container :deep(.d2h-del.d2h-change),
.diff-container :deep(.d2h-del) {
  background: rgba(248, 81, 73, 0.2);
}

.diff-container :deep(.d2h-info) {
  background: #252526;
  color: #569cd6;
}

.diff-container :deep(.d2h-code-line ins) {
  background: rgba(46, 160, 67, 0.4);
  text-decoration: none;
}

.diff-container :deep(.d2h-code-line del) {
  background: rgba(248, 81, 73, 0.4);
  text-decoration: none;
}

/* GitHub-style git file list */
.git-file-list {
  border: 1px solid #333;
  border-radius: 8px;
  overflow: hidden;
}

.git-file-item {
  border-bottom: 1px solid #333;
}

.git-file-item:last-child {
  border-bottom: none;
}

.git-file-header {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  cursor: pointer;
  background: #252526;
  transition: background 0.15s ease;
}

.git-file-header:hover {
  background: #2d2d2d;
}

.git-file-name {
  font-family: 'Fira Code', 'Monaco', 'Consolas', monospace;
  font-size: 13px;
  color: #e0e0e0;
}

.git-file-diff {
  border-top: 1px solid #333;
  background: #1e1e1e;
  max-height: 500px;
  overflow: auto;
}

.git-file-diff :deep(.diff-content) {
  margin: 0;
  font-family: 'Fira Code', 'Monaco', 'Consolas', monospace;
  font-size: 12px;
  line-height: 1.6;
  background: #1e1e1e;
}

.git-file-diff :deep(.diff-line) {
  display: flex;
  white-space: pre;
  min-height: 1.6em;
}

.git-file-diff :deep(.diff-ln) {
  display: inline-block;
  width: 45px;
  padding: 0 8px;
  text-align: right;
  color: #606060;
  background: #252526;
  user-select: none;
  flex-shrink: 0;
}

.git-file-diff :deep(.diff-add) {
  background: rgba(46, 160, 67, 0.2);
  color: #d4d4d4;
}

.git-file-diff :deep(.diff-add .diff-ln:last-of-type) {
  background: rgba(46, 160, 67, 0.3);
}

.git-file-diff :deep(.diff-del) {
  background: rgba(248, 81, 73, 0.2);
  color: #d4d4d4;
}

.git-file-diff :deep(.diff-del .diff-ln:first-of-type) {
  background: rgba(248, 81, 73, 0.3);
}

.git-file-diff :deep(.diff-hunk) {
  background: rgba(56, 139, 253, 0.15);
  color: #79c0ff;
  padding-left: 8px;
}

.git-file-diff :deep(.diff-meta) {
  color: #606060;
  padding-left: 8px;
}

.git-file-diff .diff-container :deep(.d2h-file-header) {
  display: none;
}

.git-file-diff .diff-container :deep(.d2h-file-wrapper) {
  border: none;
  border-radius: 0;
  margin-bottom: 0;
}

/* Logs styling */
.logs-content {
  font-family: 'Fira Code', 'Monaco', 'Consolas', monospace;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
  color: #d4d4d4;
  max-height: 60vh;
  overflow: auto;
}
</style>

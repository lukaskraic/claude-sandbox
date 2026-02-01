<template>
  <v-container fluid v-if="session">
    <v-row>
      <v-col cols="12">
        <v-btn icon="mdi-arrow-left" variant="text" to="/sessions" />
        <span class="text-h4 ml-2">{{ session.name }}</span>
        <v-chip :color="statusColor" class="ml-4">{{ session.status }}</v-chip>
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12" md="3">
        <v-card>
          <v-card-title>Session Info</v-card-title>
          <v-card-text>
            <v-list density="compact">
              <v-list-item>
                <v-list-item-title>{{ project?.name }}</v-list-item-title>
                <v-list-item-subtitle>Project</v-list-item-subtitle>
              </v-list-item>
              <v-list-item v-if="session.worktree">
                <v-list-item-title>{{ session.worktree.branch }}</v-list-item-title>
                <v-list-item-subtitle>Branch</v-list-item-subtitle>
              </v-list-item>
              <v-list-item v-if="session.container">
                <v-list-item-title>{{ session.container.id.slice(0, 12) }}</v-list-item-title>
                <v-list-item-subtitle>Container</v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </v-card-text>
          <v-card-actions>
            <v-btn
              v-if="session.status === 'stopped' || session.status === 'pending'"
              color="success"
              @click="start"
              :loading="loading"
            >
              Start
            </v-btn>
            <v-btn
              v-if="session.status === 'running'"
              color="warning"
              @click="stop"
              :loading="loading"
            >
              Stop
            </v-btn>
            <v-btn
              v-if="session.status === 'running'"
              @click="restart"
              :loading="loading"
            >
              Restart
            </v-btn>
          </v-card-actions>
        </v-card>

        <v-card class="mt-4" v-if="gitStatus">
          <v-card-title>Git Status</v-card-title>
          <v-card-text>
            <p><strong>Branch:</strong> {{ gitStatus.branch }}</p>
            <p v-if="gitStatus.ahead > 0">{{ gitStatus.ahead }} ahead</p>
            <p v-if="gitStatus.behind > 0">{{ gitStatus.behind }} behind</p>
            <v-divider class="my-2" />
            <p v-if="gitStatus.staged.length > 0">
              <strong>Staged:</strong> {{ gitStatus.staged.length }} files
            </p>
            <p v-if="gitStatus.unstaged.length > 0">
              <strong>Modified:</strong> {{ gitStatus.unstaged.length }} files
            </p>
            <p v-if="gitStatus.untracked.length > 0">
              <strong>Untracked:</strong> {{ gitStatus.untracked.length }} files
            </p>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="9">
        <v-card>
          <v-tabs v-model="activeTab">
            <v-tab value="terminal">Terminal</v-tab>
            <v-tab value="logs">Logs</v-tab>
          </v-tabs>
          <v-card-text style="height: 500px; padding: 0;">
            <v-window v-model="activeTab" style="height: 100%;">
              <v-window-item value="terminal" style="height: 100%;">
                <TerminalView
                  v-if="session.status === 'running'"
                  :session-id="session.id"
                  :active="activeTab === 'terminal'"
                />
                <div v-else class="d-flex align-center justify-center" style="height: 100%;">
                  <p class="text-grey">Session is not running</p>
                </div>
              </v-window-item>
              <v-window-item value="logs" style="height: 100%; overflow: auto;">
                <pre class="pa-4">{{ logs }}</pre>
              </v-window-item>
            </v-window>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useSessionStore } from '@/stores/sessionStore'
import { useProjectStore } from '@/stores/projectStore'
import { trpc } from '@/api/trpc'
import type { GitStatus, SessionStatus } from '@claude-sandbox/shared'
import TerminalView from '@/components/TerminalView.vue'

const route = useRoute()
const sessionStore = useSessionStore()
const projectStore = useProjectStore()

const activeTab = ref('terminal')
const loading = ref(false)
const logs = ref('')
const gitStatus = ref<GitStatus | null>(null)

const session = computed(() => sessionStore.sessionById(route.params.id as string))
const project = computed(() => session.value ? projectStore.projectById(session.value.projectId) : null)

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

onMounted(async () => {
  await Promise.all([
    sessionStore.fetchSessions(),
    projectStore.fetchProjects(),
  ])
  await loadSessionData()
})

watch(() => session.value?.status, async (newStatus) => {
  if (newStatus === 'running') {
    await loadSessionData()
  }
})

async function loadSessionData() {
  if (!session.value) return

  try {
    const [logsResult, statusResult] = await Promise.all([
      trpc.session.logs.query({ id: session.value.id }),
      session.value.status === 'running'
        ? trpc.session.gitStatus.query({ id: session.value.id })
        : Promise.resolve(null),
    ])
    logs.value = logsResult.stdout + logsResult.stderr
    gitStatus.value = statusResult
  } catch (err) {
    console.error('Failed to load session data:', err)
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

<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <div class="d-flex align-center mb-4">
          <v-btn
            v-if="projectId"
            icon="mdi-arrow-left"
            variant="text"
            :to="`/projects/${projectId}`"
            class="mr-2"
          />
          <h1 class="text-h4">
            {{ project ? `${project.name} Sessions` : 'All Sessions' }}
          </h1>
          <v-spacer />
          <v-btn
            v-if="projectId"
            color="primary"
            prepend-icon="mdi-plus"
            @click="showCreateDialog = true"
          >
            New Session
          </v-btn>
        </div>
      </v-col>
    </v-row>

    <v-row v-if="sessionStore.loading">
      <v-col cols="12" class="text-center">
        <v-progress-circular indeterminate color="primary" />
      </v-col>
    </v-row>

    <v-row v-else-if="filteredSessions.length === 0">
      <v-col cols="12">
        <v-alert type="info" variant="tonal">
          {{ projectId ? 'No sessions for this project. Create one to get started.' : 'No sessions. Create a session from a project.' }}
        </v-alert>
      </v-col>
    </v-row>

    <v-row v-else>
      <v-col cols="12">
        <v-table>
          <thead>
            <tr>
              <th>Name</th>
              <th v-if="!projectId">Project</th>
              <th>Status</th>
              <th>Branch</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="session in filteredSessions" :key="session.id">
              <td>
                <router-link :to="`/sessions/${session.id}`">{{ session.name }}</router-link>
              </td>
              <td v-if="!projectId">{{ getProjectName(session.projectId) }}</td>
              <td>
                <v-chip :color="statusColor(session.status)" size="small">
                  {{ session.status }}
                </v-chip>
              </td>
              <td>{{ session.worktree?.branch || '-' }}</td>
              <td>
                <v-btn
                  v-if="session.status === 'stopped' || session.status === 'pending'"
                  icon="mdi-play"
                  size="small"
                  color="success"
                  variant="text"
                  @click="sessionStore.startSession(session.id)"
                />
                <v-btn
                  v-if="session.status === 'running'"
                  icon="mdi-stop"
                  size="small"
                  color="warning"
                  variant="text"
                  @click="sessionStore.stopSession(session.id)"
                />
                <v-btn
                  icon="mdi-delete"
                  size="small"
                  color="error"
                  variant="text"
                  @click="removeSession(session.id)"
                />
              </td>
            </tr>
          </tbody>
        </v-table>
      </v-col>
    </v-row>

    <CreateSessionDialog
      v-if="projectId"
      v-model="showCreateDialog"
      :project-id="projectId"
      @created="onSessionCreated"
    />
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useSessionStore } from '@/stores/sessionStore'
import { useProjectStore } from '@/stores/projectStore'
import type { SessionStatus } from '@claude-sandbox/shared'
import CreateSessionDialog from '@/components/CreateSessionDialog.vue'

const route = useRoute()
const sessionStore = useSessionStore()
const projectStore = useProjectStore()
const showCreateDialog = ref(false)

const projectId = computed(() => route.params.projectId as string | undefined)
const project = computed(() => projectId.value ? projectStore.projectById(projectId.value) : null)

const filteredSessions = computed(() => {
  if (!projectId.value) {
    return sessionStore.sessions
  }
  return sessionStore.sessions.filter(s => s.projectId === projectId.value)
})

onMounted(async () => {
  await Promise.all([
    sessionStore.fetchSessions(),
    projectStore.fetchProjects(),
  ])
})

watch(projectId, () => {
  sessionStore.fetchSessions()
})

function getProjectName(projectId: string): string {
  return projectStore.projectById(projectId)?.name || projectId
}

function statusColor(status: SessionStatus): string {
  const colors: Record<SessionStatus, string> = {
    pending: 'grey',
    starting: 'orange',
    running: 'success',
    stopping: 'orange',
    stopped: 'grey',
    error: 'error',
  }
  return colors[status]
}

async function removeSession(id: string) {
  if (confirm('Are you sure you want to remove this session?')) {
    await sessionStore.removeSession(id)
  }
}

function onSessionCreated() {
  showCreateDialog.value = false
}
</script>

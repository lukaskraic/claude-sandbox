<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <h1 class="text-h4 mb-4">All Sessions</h1>
      </v-col>
    </v-row>

    <v-row v-if="sessionStore.loading">
      <v-col cols="12" class="text-center">
        <v-progress-circular indeterminate color="primary" />
      </v-col>
    </v-row>

    <v-row v-else-if="sessionStore.sessions.length === 0">
      <v-col cols="12">
        <v-alert type="info" variant="tonal">
          No sessions. Create a session from a project.
        </v-alert>
      </v-col>
    </v-row>

    <v-row v-else>
      <v-col cols="12">
        <v-table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Project</th>
              <th>Status</th>
              <th>Branch</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="session in sessionStore.sessions" :key="session.id">
              <td>
                <router-link :to="`/sessions/${session.id}`">{{ session.name }}</router-link>
              </td>
              <td>{{ getProjectName(session.projectId) }}</td>
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
  </v-container>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useSessionStore } from '@/stores/sessionStore'
import { useProjectStore } from '@/stores/projectStore'
import type { SessionStatus } from '@claude-sandbox/shared'

const sessionStore = useSessionStore()
const projectStore = useProjectStore()

onMounted(async () => {
  await Promise.all([
    sessionStore.fetchSessions(),
    projectStore.fetchProjects(),
  ])
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
</script>

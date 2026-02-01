<template>
  <v-container v-if="project">
    <v-row>
      <v-col cols="12">
        <v-btn icon="mdi-arrow-left" variant="text" to="/projects" />
        <span class="text-h4 ml-2">{{ project.name }}</span>
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12" md="6">
        <v-card>
          <v-card-title>Project Info</v-card-title>
          <v-card-text>
            <v-list density="compact">
              <v-list-item>
                <template #prepend><v-icon>mdi-git</v-icon></template>
                <v-list-item-title>{{ project.git.remote }}</v-list-item-title>
                <v-list-item-subtitle>Git Remote</v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <template #prepend><v-icon>mdi-source-branch</v-icon></template>
                <v-list-item-title>{{ project.git.defaultBranch }}</v-list-item-title>
                <v-list-item-subtitle>Default Branch</v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <template #prepend><v-icon>mdi-docker</v-icon></template>
                <v-list-item-title>{{ project.environment.baseImage }}</v-list-item-title>
                <v-list-item-subtitle>Base Image</v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="6">
        <v-card>
          <v-card-title>
            Sessions
            <v-spacer />
            <v-btn size="small" color="primary" @click="showCreateSession = true">
              New Session
            </v-btn>
          </v-card-title>
          <v-card-text>
            <v-list v-if="sessions.length > 0">
              <v-list-item
                v-for="session in sessions"
                :key="session.id"
                :to="`/sessions/${session.id}`"
              >
                <template #prepend>
                  <v-icon :color="statusColor(session.status)">
                    {{ statusIcon(session.status) }}
                  </v-icon>
                </template>
                <v-list-item-title>{{ session.name }}</v-list-item-title>
                <v-list-item-subtitle>{{ session.status }}</v-list-item-subtitle>
              </v-list-item>
            </v-list>
            <p v-else class="text-grey">No sessions yet</p>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-dialog v-model="showCreateSession" max-width="400">
      <v-card>
        <v-card-title>Create Session</v-card-title>
        <v-card-text>
          <v-text-field v-model="newSessionName" label="Session Name" />
          <v-text-field v-model="newSessionBranch" label="Branch (optional)" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="showCreateSession = false">Cancel</v-btn>
          <v-btn color="primary" @click="createSession">Create</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useProjectStore } from '@/stores/projectStore'
import { useSessionStore } from '@/stores/sessionStore'
import type { SessionStatus } from '@claude-sandbox/shared'

const route = useRoute()
const projectStore = useProjectStore()
const sessionStore = useSessionStore()

const showCreateSession = ref(false)
const newSessionName = ref('')
const newSessionBranch = ref('')

const project = computed(() => projectStore.projectById(route.params.id as string))
const sessions = computed(() => sessionStore.sessionsByProject(route.params.id as string))

onMounted(async () => {
  if (projectStore.projects.length === 0) {
    await projectStore.fetchProjects()
  }
  await sessionStore.fetchSessions()
})

function statusColor(status: SessionStatus): string {
  const colors: Record<SessionStatus, string> = {
    pending: 'grey',
    starting: 'orange',
    running: 'green',
    stopping: 'orange',
    stopped: 'grey',
    error: 'red',
  }
  return colors[status]
}

function statusIcon(status: SessionStatus): string {
  const icons: Record<SessionStatus, string> = {
    pending: 'mdi-clock-outline',
    starting: 'mdi-loading',
    running: 'mdi-play-circle',
    stopping: 'mdi-loading',
    stopped: 'mdi-stop-circle',
    error: 'mdi-alert-circle',
  }
  return icons[status]
}

async function createSession() {
  if (!newSessionName.value) return
  await sessionStore.createSession(route.params.id as string, {
    name: newSessionName.value,
    branch: newSessionBranch.value || undefined,
  })
  showCreateSession.value = false
  newSessionName.value = ''
  newSessionBranch.value = ''
}
</script>

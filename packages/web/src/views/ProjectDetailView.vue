<template>
  <v-container v-if="project" fluid class="pa-4">
    <!-- Header -->
    <v-row class="mb-4">
      <v-col cols="12" class="d-flex align-center">
        <v-btn icon="mdi-arrow-left" variant="text" to="/projects" />
        <div class="ml-2">
          <div class="text-h4">{{ project.name }}</div>
          <div v-if="project.description" class="text-subtitle-1 text-grey">{{ project.description }}</div>
        </div>
        <v-spacer />
        <v-btn
          icon="mdi-refresh"
          variant="text"
          :loading="refreshing"
          @click="refreshAll"
          class="mr-2"
        />
        <v-btn color="primary" @click="showEditProject = true">
          <v-icon start>mdi-pencil</v-icon>
          Edit
        </v-btn>
      </v-col>
    </v-row>

    <v-row>
      <!-- Left Column: Configuration -->
      <v-col cols="12" lg="7">
        <!-- Git & Base Image -->
        <v-card class="mb-4">
          <v-card-text>
            <v-row>
              <v-col cols="12" md="6">
                <div class="text-overline text-grey">Git Repository</div>
                <div class="d-flex align-center mb-2">
                  <v-icon class="mr-2" color="grey">mdi-git</v-icon>
                  <span class="text-body-1 text-truncate">{{ project.git.remote }}</span>
                </div>
                <div class="d-flex align-center">
                  <v-icon class="mr-2" size="small" color="grey">mdi-source-branch</v-icon>
                  <span class="text-body-2">{{ project.git.defaultBranch }}</span>
                </div>
              </v-col>
              <v-col cols="12" md="6">
                <div class="text-overline text-grey">Base Image</div>
                <div class="d-flex align-center">
                  <v-icon class="mr-2" color="blue">mdi-docker</v-icon>
                  <code class="text-body-1">{{ project.environment.baseImage }}</code>
                </div>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <!-- Environment Configuration -->
        <v-card class="mb-4">
          <v-card-title class="d-flex align-center">
            <v-icon class="mr-2">mdi-cog</v-icon>
            Environment
            <v-spacer />
            <v-btn
              v-if="hasCustomEnvironment"
              size="small"
              variant="tonal"
              :loading="rebuildingImage"
              @click="rebuildImage"
            >
              <v-icon start>mdi-refresh</v-icon>
              Rebuild
            </v-btn>
          </v-card-title>
          <v-card-text>
            <!-- Image Status -->
            <v-alert
              v-if="imageStatus"
              :type="imageStatusType"
              density="compact"
              class="mb-4"
              variant="tonal"
            >
              <div class="d-flex align-center">
                <code>{{ imageStatus.imageTag }}</code>
                <v-spacer />
                <span v-if="imageStatus.status === 'ready' && imageStatus.builtAt" class="text-caption">
                  Built {{ formatDate(imageStatus.builtAt) }}
                </span>
                <span v-else-if="imageStatus.status === 'building'" class="text-caption">Building...</span>
                <span v-else-if="imageStatus.status === 'failed'" class="text-caption text-error">{{ imageStatus.error }}</span>
              </div>
            </v-alert>

            <!-- Runtimes -->
            <div v-if="hasRuntimes" class="mb-4">
              <div class="text-overline text-grey mb-2">Runtimes</div>
              <div class="d-flex flex-wrap ga-2">
                <v-chip v-if="project.environment.runtimes?.java" color="red" variant="tonal">
                  <v-icon start size="small">mdi-language-java</v-icon>
                  Java {{ project.environment.runtimes.java }}
                </v-chip>
                <v-chip v-if="project.environment.runtimes?.node" color="green" variant="tonal">
                  <v-icon start size="small">mdi-nodejs</v-icon>
                  Node {{ project.environment.runtimes.node }}
                </v-chip>
                <v-chip v-if="project.environment.runtimes?.python" color="blue" variant="tonal">
                  <v-icon start size="small">mdi-language-python</v-icon>
                  Python {{ project.environment.runtimes.python }}
                </v-chip>
                <v-chip v-if="project.environment.runtimes?.go" color="cyan" variant="tonal">
                  <v-icon start size="small">mdi-language-go</v-icon>
                  Go {{ project.environment.runtimes.go }}
                </v-chip>
              </div>
            </div>

            <!-- Services -->
            <div v-if="project.environment.services?.length" class="mb-4">
              <div class="text-overline text-grey mb-2">Services</div>
              <div class="d-flex flex-wrap ga-2">
                <v-chip
                  v-for="service in project.environment.services"
                  :key="service.type"
                  :color="serviceColor(service.type)"
                  variant="tonal"
                >
                  <v-icon start size="small">{{ serviceIcon(service.type) }}</v-icon>
                  {{ service.type }}:{{ service.version }}
                </v-chip>
              </div>
            </div>

            <!-- Tools -->
            <div v-if="hasTools" class="mb-4">
              <div class="text-overline text-grey mb-2">Tools</div>
              <div class="d-flex flex-wrap ga-2">
                <v-chip
                  v-for="tool in project.environment.tools?.npm"
                  :key="`npm-${tool}`"
                  color="green"
                  variant="outlined"
                  size="small"
                >
                  npm: {{ tool }}
                </v-chip>
                <v-chip
                  v-for="tool in project.environment.tools?.pip"
                  :key="`pip-${tool}`"
                  color="blue"
                  variant="outlined"
                  size="small"
                >
                  pip: {{ tool }}
                </v-chip>
                <v-chip
                  v-if="project.environment.tools?.custom?.includes('claude-code')"
                  color="purple"
                  variant="tonal"
                  size="small"
                >
                  <v-icon start size="small">mdi-robot</v-icon>
                  Claude Code
                </v-chip>
              </div>
            </div>

            <!-- Packages -->
            <div v-if="project.environment.packages?.length" class="mb-4">
              <div class="text-overline text-grey mb-2">System Packages</div>
              <div class="d-flex flex-wrap ga-1">
                <v-chip
                  v-for="pkg in project.environment.packages"
                  :key="pkg"
                  size="small"
                  variant="outlined"
                >
                  {{ pkg }}
                </v-chip>
              </div>
            </div>

            <!-- Ports -->
            <div v-if="project.environment.ports?.length" class="mb-4">
              <div class="text-overline text-grey mb-2">Exposed Ports</div>
              <div class="d-flex flex-wrap ga-2">
                <v-chip
                  v-for="port in project.environment.ports"
                  :key="port"
                  color="orange"
                  variant="tonal"
                  size="small"
                >
                  <v-icon start size="small">mdi-lan-connect</v-icon>
                  {{ port }}
                </v-chip>
              </div>
            </div>

            <!-- Environment Variables -->
            <div v-if="project.environment.env && Object.keys(project.environment.env).length" class="mb-4">
              <div class="text-overline text-grey mb-2">Environment Variables</div>
              <div class="d-flex flex-wrap ga-1">
                <v-chip
                  v-for="(value, key) in project.environment.env"
                  :key="key"
                  size="small"
                  variant="outlined"
                >
                  {{ key }}
                </v-chip>
              </div>
            </div>

            <!-- Setup Script -->
            <div v-if="project.environment.setup" class="mb-4">
              <div class="text-overline text-grey mb-2">Setup Script</div>
              <v-sheet rounded class="pa-2 bg-grey-darken-3">
                <pre class="text-caption" style="white-space: pre-wrap; margin: 0;">{{ project.environment.setup }}</pre>
              </v-sheet>
            </div>

            <div v-if="!hasCustomEnvironment" class="text-grey text-center py-4">
              Using base image only - no custom configuration
            </div>
          </v-card-text>
        </v-card>

        <!-- Mounts -->
        <v-card v-if="project.mounts?.length" class="mb-4">
          <v-card-title>
            <v-icon class="mr-2">mdi-folder-network</v-icon>
            Volume Mounts
          </v-card-title>
          <v-card-text>
            <v-list density="compact">
              <v-list-item v-for="(mount, i) in project.mounts" :key="i">
                <template #prepend>
                  <v-icon :color="mount.readonly ? 'grey' : 'primary'">
                    {{ mount.readonly ? 'mdi-folder-lock' : 'mdi-folder' }}
                  </v-icon>
                </template>
                <v-list-item-title>
                  <code>{{ mount.source }}</code>
                  <v-icon size="small" class="mx-2">mdi-arrow-right</v-icon>
                  <code>{{ mount.target }}</code>
                </v-list-item-title>
                <template #append>
                  <v-chip v-if="mount.readonly" size="x-small" color="grey">readonly</v-chip>
                </template>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>

        <!-- Claude Configuration -->
        <v-card v-if="project.claude?.claudeMd || project.claude?.permissions?.length" class="mb-4">
          <v-card-title>
            <v-icon class="mr-2" color="purple">mdi-robot</v-icon>
            Claude Configuration
          </v-card-title>
          <v-card-text>
            <div v-if="project.claude?.permissions?.length" class="mb-4">
              <div class="text-overline text-grey mb-2">Permissions</div>
              <div class="d-flex flex-wrap ga-1">
                <v-chip
                  v-for="perm in project.claude.permissions"
                  :key="perm"
                  size="small"
                  color="purple"
                  variant="outlined"
                >
                  {{ perm }}
                </v-chip>
              </div>
            </div>
            <div v-if="project.claude?.claudeMd">
              <div class="text-overline text-grey mb-2">CLAUDE.md</div>
              <v-sheet rounded class="pa-2 bg-grey-darken-3">
                <pre class="text-caption" style="white-space: pre-wrap; margin: 0; max-height: 200px; overflow: auto;">{{ project.claude.claudeMd }}</pre>
              </v-sheet>
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Right Column: Sessions -->
      <v-col cols="12" lg="5">
        <v-card>
          <v-card-title class="d-flex align-center">
            <v-icon class="mr-2">mdi-console</v-icon>
            Sessions
            <v-spacer />
            <v-btn
              variant="text"
              size="small"
              :to="`/projects/${route.params.id}/sessions`"
              class="mr-2"
            >
              View All
            </v-btn>
            <v-btn color="primary" size="small" @click="showCreateSession = true">
              <v-icon start>mdi-plus</v-icon>
              New
            </v-btn>
          </v-card-title>
          <v-card-text>
            <v-list v-if="sessions.length > 0" lines="two">
              <v-list-item
                v-for="session in sessions"
                :key="session.id"
                rounded
              >
                <template #prepend>
                  <router-link :to="`/sessions/${session.id}`" class="text-decoration-none">
                    <v-avatar :color="statusColor(session.status)" size="40">
                      <v-icon color="white">{{ statusIcon(session.status) }}</v-icon>
                    </v-avatar>
                  </router-link>
                </template>
                <router-link :to="`/sessions/${session.id}`" class="text-decoration-none" style="flex: 1;">
                  <v-list-item-title class="font-weight-medium">{{ session.name }}</v-list-item-title>
                  <v-list-item-subtitle>
                    <v-chip :color="statusColor(session.status)" size="x-small" variant="tonal" class="mr-2">
                      {{ session.status }}
                    </v-chip>
                    <span v-if="session.worktree?.branch" class="text-caption">
                      <v-icon size="x-small">mdi-source-branch</v-icon>
                      {{ session.worktree.branch }}
                    </span>
                  </v-list-item-subtitle>
                </router-link>
                <template #append>
                  <div class="d-flex align-center ga-1">
                    <v-btn
                      v-if="session.status === 'stopped' || session.status === 'pending'"
                      icon="mdi-play"
                      size="small"
                      color="success"
                      variant="text"
                      :loading="sessionLoading[session.id]"
                      @click.stop="startSession(session.id)"
                    />
                    <v-btn
                      v-if="session.status === 'running'"
                      icon="mdi-stop"
                      size="small"
                      color="warning"
                      variant="text"
                      :loading="sessionLoading[session.id]"
                      @click.stop="stopSession(session.id)"
                    />
                    <v-btn
                      v-if="session.status === 'starting' || session.status === 'stopping'"
                      icon="mdi-loading"
                      size="small"
                      variant="text"
                      disabled
                      class="mdi-spin"
                    />
                    <v-btn
                      icon="mdi-delete"
                      size="small"
                      color="error"
                      variant="text"
                      :disabled="session.status === 'starting' || session.status === 'stopping'"
                      @click.stop="deleteSession(session.id)"
                    />
                    <router-link :to="`/sessions/${session.id}`">
                      <v-icon>mdi-chevron-right</v-icon>
                    </router-link>
                  </div>
                </template>
              </v-list-item>
            </v-list>
            <div v-else class="text-center py-8">
              <v-icon size="64" color="grey-lighten-1">mdi-console-line</v-icon>
              <p class="text-grey mt-2">No sessions yet</p>
              <v-btn color="primary" variant="tonal" class="mt-2" @click="showCreateSession = true">
                Create First Session
              </v-btn>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Container Resources -->
    <v-row class="mt-4">
      <v-col cols="12">
        <ContainerManagement
          :project-id="route.params.id as string"
          :project-name="project.name"
        />
      </v-col>
    </v-row>

    <!-- Create Session Dialog -->
    <v-dialog v-model="showCreateSession" max-width="450">
      <v-card>
        <v-card-title>
          <v-icon class="mr-2">mdi-plus-circle</v-icon>
          Create Session
        </v-card-title>
        <v-card-text>
          <v-text-field
            v-model="newSessionName"
            label="Session Name"
            hint="A descriptive name for this session"
            autofocus
          />
          <v-text-field
            v-model="newSessionBranch"
            label="Branch (optional)"
            hint="Leave empty to create a new session branch"
          />
          <v-select
            v-if="claudeSourceUsers.length > 0"
            v-model="newSessionClaudeUser"
            :items="claudeSourceUsers"
            label="Claude Source User"
            hint="User whose .claude directory will be mounted"
            persistent-hint
            clearable
            class="mb-2"
          />
          <v-text-field
            v-model="newSessionGitUserName"
            label="Git User Name (optional)"
            hint="For git commits in this session"
            persistent-hint
            class="mb-2"
          />
          <v-text-field
            v-model="newSessionGitUserEmail"
            label="Git User Email (optional)"
            hint="For git commits in this session"
            persistent-hint
            class="mb-2"
          />
          <v-text-field
            v-model="newSessionGithubToken"
            label="GitHub Token (optional)"
            hint="For gh CLI and git push/pull operations"
            persistent-hint
            type="password"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="showCreateSession = false">Cancel</v-btn>
          <v-btn color="primary" :disabled="!newSessionName" @click="createSession">
            Create
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Edit Project Dialog -->
    <EditProjectDialog
      v-model="showEditProject"
      :project="project"
      @updated="handleProjectUpdated"
    />
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useProjectStore } from '@/stores/projectStore'
import { useSessionStore } from '@/stores/sessionStore'
import { trpc } from '@/api/trpc'
import type { SessionStatus, ProjectImage, ServiceType } from '@claude-sandbox/shared'
import EditProjectDialog from '@/components/EditProjectDialog.vue'
import ContainerManagement from '@/components/ContainerManagement.vue'

const route = useRoute()
const projectStore = useProjectStore()
const sessionStore = useSessionStore()

const showCreateSession = ref(false)
const showEditProject = ref(false)
const newSessionName = ref('')
const newSessionBranch = ref('')
const newSessionClaudeUser = ref<string | null>(null)
const newSessionGitUserName = ref('lukas.kraic')
const newSessionGitUserEmail = ref('lukas.kraic@alanata.sk')
const newSessionGithubToken = ref('')
const claudeSourceUsers = ref<string[]>([])
const imageStatus = ref<ProjectImage | null>(null)
const rebuildingImage = ref(false)
const sessionLoading = ref<Record<string, boolean>>({})
const refreshing = ref(false)

const project = computed(() => projectStore.projectById(route.params.id as string))
const sessions = computed(() => sessionStore.sessionsByProject(route.params.id as string))

const hasRuntimes = computed(() => {
  const rt = project.value?.environment.runtimes
  return rt && (rt.java || rt.node || rt.python || rt.go)
})

const hasTools = computed(() => {
  const tools = project.value?.environment.tools
  return tools && (tools.npm?.length || tools.pip?.length || tools.custom?.length)
})

const hasCustomEnvironment = computed(() => {
  const env = project.value?.environment
  return env && (hasRuntimes.value || hasTools.value || env.packages?.length || env.services?.length)
})

const imageStatusType = computed(() => {
  if (!imageStatus.value) return 'info'
  switch (imageStatus.value.status) {
    case 'ready': return 'success'
    case 'building': return 'info'
    case 'failed': return 'error'
    default: return 'info'
  }
})

// Polling for session status updates
let pollingInterval: ReturnType<typeof setInterval> | null = null

const hasTransitioningSessions = computed(() => {
  return sessions.value.some(s => s.status === 'starting' || s.status === 'stopping')
})

function startPolling() {
  if (pollingInterval) return
  pollingInterval = setInterval(async () => {
    await sessionStore.fetchSessions()
    // Stop polling if no more transitioning sessions
    if (!hasTransitioningSessions.value && pollingInterval) {
      clearInterval(pollingInterval)
      pollingInterval = null
    }
  }, 3000) // Poll every 3 seconds
}

// Watch for transitioning sessions and start/stop polling
watch(hasTransitioningSessions, (hasTransitioning) => {
  if (hasTransitioning) {
    startPolling()
  }
})

onMounted(async () => {
  if (projectStore.projects.length === 0) {
    await projectStore.fetchProjects()
  }
  await sessionStore.fetchSessions()

  // Start polling if any sessions are transitioning
  if (hasTransitioningSessions.value) {
    startPolling()
  }

  try {
    claudeSourceUsers.value = await trpc.session.claudeSourceUsers.query()
  } catch (err) {
    console.error('Failed to load claude source users:', err)
  }

  await loadImageStatus()

  // Start polling if image is building
  if (imageStatus.value?.status === 'building') {
    startImagePolling()
  }
})

onUnmounted(() => {
  if (pollingInterval) {
    clearInterval(pollingInterval)
    pollingInterval = null
  }
  if (imagePollingInterval) {
    clearInterval(imagePollingInterval)
    imagePollingInterval = null
  }
})

async function loadImageStatus() {
  try {
    imageStatus.value = await trpc.project.getImageStatus.query({ id: route.params.id as string })
  } catch (err) {
    console.error('Failed to load image status:', err)
  }
}

async function refreshAll() {
  refreshing.value = true
  try {
    await Promise.all([
      projectStore.fetchProjects(),
      sessionStore.fetchSessions(),
      loadImageStatus(),
    ])
  } finally {
    refreshing.value = false
  }
}

async function rebuildImage() {
  rebuildingImage.value = true
  try {
    await trpc.project.rebuildImage.mutate({ id: route.params.id as string })
    await loadImageStatus()
    // Start polling for image build status
    startImagePolling()
  } catch (err) {
    console.error('Failed to rebuild image:', err)
  } finally {
    rebuildingImage.value = false
  }
}

// Polling for image build status
let imagePollingInterval: ReturnType<typeof setInterval> | null = null

function startImagePolling() {
  if (imagePollingInterval) return
  imagePollingInterval = setInterval(async () => {
    await loadImageStatus()
    // Stop polling when build is complete
    if (imageStatus.value?.status !== 'building' && imagePollingInterval) {
      clearInterval(imagePollingInterval)
      imagePollingInterval = null
    }
  }, 3000)
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleString()
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

function statusIcon(status: SessionStatus): string {
  const icons: Record<SessionStatus, string> = {
    pending: 'mdi-clock-outline',
    starting: 'mdi-loading mdi-spin',
    running: 'mdi-play',
    stopping: 'mdi-loading mdi-spin',
    stopped: 'mdi-stop',
    error: 'mdi-alert',
  }
  return icons[status]
}

function serviceColor(type: ServiceType): string {
  const colors: Record<ServiceType, string> = {
    postgres: 'blue',
    mysql: 'orange',
    redis: 'red',
    mongodb: 'green',
    elasticsearch: 'yellow',
  }
  return colors[type] || 'grey'
}

function serviceIcon(type: ServiceType): string {
  const icons: Record<ServiceType, string> = {
    postgres: 'mdi-elephant',
    mysql: 'mdi-dolphin',
    redis: 'mdi-flash',
    mongodb: 'mdi-leaf',
    elasticsearch: 'mdi-magnify',
  }
  return icons[type] || 'mdi-database'
}

async function createSession() {
  if (!newSessionName.value) return
  await sessionStore.createSession(route.params.id as string, {
    name: newSessionName.value,
    branch: newSessionBranch.value || undefined,
    claudeSourceUser: newSessionClaudeUser.value || undefined,
    gitUserName: newSessionGitUserName.value || undefined,
    gitUserEmail: newSessionGitUserEmail.value || undefined,
    githubToken: newSessionGithubToken.value || undefined,
  })
  showCreateSession.value = false
  newSessionName.value = ''
  newSessionBranch.value = ''
  newSessionClaudeUser.value = null
  newSessionGitUserName.value = 'lukas.kraic'
  newSessionGitUserEmail.value = 'lukas.kraic@alanata.sk'
  newSessionGithubToken.value = ''
  // Refetch to get fresh data
  await sessionStore.fetchSessions()
}

async function startSession(id: string) {
  sessionLoading.value[id] = true
  try {
    await sessionStore.startSession(id)
    // Start polling for status updates
    startPolling()
  } finally {
    sessionLoading.value[id] = false
  }
}

async function stopSession(id: string) {
  sessionLoading.value[id] = true
  try {
    await sessionStore.stopSession(id)
    // Start polling for status updates
    startPolling()
  } finally {
    sessionLoading.value[id] = false
  }
}

async function deleteSession(id: string) {
  if (!confirm('Are you sure you want to delete this session?')) return
  try {
    await sessionStore.removeSession(id)
  } catch (err) {
    console.error('Failed to delete session:', err)
  }
}

async function handleProjectUpdated() {
  await projectStore.fetchProjects()
  await loadImageStatus()
}
</script>

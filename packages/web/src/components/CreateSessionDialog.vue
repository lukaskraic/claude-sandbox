<template>
  <v-dialog v-model="model" max-width="500" persistent>
    <v-card>
      <v-card-title>Create New Session</v-card-title>
      <v-card-text>
        <v-form ref="form" @submit.prevent="submit">
          <v-text-field
            v-model="sessionName"
            label="Session Name"
            :rules="[v => !!v || 'Name is required']"
            autofocus
            class="mb-4"
          />

          <v-radio-group v-model="worktreeMode" inline class="mb-4" hide-details>
            <v-radio label="New worktree" value="new" />
            <v-radio
              label="Use existing worktree"
              value="existing"
              :disabled="availableWorktrees.length === 0"
            />
          </v-radio-group>

          <v-text-field
            v-if="worktreeMode === 'new'"
            v-model="branch"
            label="Branch (optional)"
            hint="Leave empty to create a new branch from default"
            persistent-hint
            class="mb-4"
          />
          <v-select
            v-if="worktreeMode === 'existing'"
            v-model="selectedWorktree"
            :items="worktreeItems"
            label="Select worktree"
            :rules="[v => !!v || 'Select a worktree']"
            class="mb-4"
          />

          <v-select
            v-model="claudeSourceUser"
            :items="claudeSourceUsers"
            label="Claude Config Source"
            hint="User whose .claude directory to mount"
            persistent-hint
            clearable
            class="mb-4"
          />
          <v-text-field
            v-model="gitUserName"
            label="Git User Name (optional)"
            hint="For git commits in this session"
            persistent-hint
            class="mb-4"
          />
          <v-text-field
            v-model="gitUserEmail"
            label="Git User Email (optional)"
            hint="For git commits in this session"
            persistent-hint
            class="mb-4"
          />
          <v-text-field
            v-model="githubToken"
            label="GitHub Token (optional)"
            hint="For gh CLI and git push/pull operations"
            persistent-hint
            type="password"
          />
        </v-form>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="close">Cancel</v-btn>
        <v-btn color="primary" :loading="loading" @click="submit">Create</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useSessionStore } from '@/stores/sessionStore'
import { trpc } from '@/api/trpc'
import type { WorktreeInfo } from '@claude-sandbox/shared'

const props = defineProps<{
  projectId: string
}>()

const emit = defineEmits<{
  created: []
}>()

const model = defineModel<boolean>({ default: false })
const sessionStore = useSessionStore()

const form = ref()
const sessionName = ref('')
const branch = ref('')
const worktreeMode = ref<'new' | 'existing'>('new')
const selectedWorktree = ref<string | null>(null)
const availableWorktrees = ref<WorktreeInfo[]>([])
const claudeSourceUser = ref<string | null>(null)
const claudeSourceUsers = ref<string[]>([])
const gitUserName = ref('')
const gitUserEmail = ref('')
const githubToken = ref('')
const loading = ref(false)

const worktreeItems = computed(() =>
  availableWorktrees.value.map(wt => ({
    title: `${wt.branch} (${wt.path.split('/').pop()?.slice(0, 8)})`,
    value: wt.path,
  }))
)

onMounted(async () => {
  try {
    claudeSourceUsers.value = await trpc.session.claudeSourceUsers.query()
    if (claudeSourceUsers.value.length > 0) {
      claudeSourceUser.value = claudeSourceUsers.value[0]
    }
  } catch (err) {
    console.error('Failed to load claude source users:', err)
  }
})

// Fetch available worktrees when dialog opens
watch(model, async (open) => {
  if (open) {
    try {
      availableWorktrees.value = await trpc.worktree.listAvailable.query({ projectId: props.projectId })
    } catch (err) {
      console.error('Failed to load available worktrees:', err)
      availableWorktrees.value = []
    }
  }
})

// Reset worktree selection when switching modes
watch(worktreeMode, () => {
  selectedWorktree.value = null
  branch.value = ''
})

function close() {
  model.value = false
  sessionName.value = ''
  branch.value = ''
  worktreeMode.value = 'new'
  selectedWorktree.value = null
  gitUserName.value = ''
  gitUserEmail.value = ''
  githubToken.value = ''
}

async function submit() {
  const { valid } = await form.value.validate()
  if (!valid) return

  loading.value = true
  try {
    await sessionStore.createSession(props.projectId, {
      name: sessionName.value,
      branch: worktreeMode.value === 'new' ? (branch.value || undefined) : undefined,
      worktreePath: worktreeMode.value === 'existing' ? (selectedWorktree.value || undefined) : undefined,
      claudeSourceUser: claudeSourceUser.value || undefined,
      gitUserName: gitUserName.value || undefined,
      gitUserEmail: gitUserEmail.value || undefined,
      githubToken: githubToken.value || undefined,
    })
    emit('created')
    close()
  } catch (err) {
    console.error('Failed to create session:', err)
  } finally {
    loading.value = false
  }
}
</script>

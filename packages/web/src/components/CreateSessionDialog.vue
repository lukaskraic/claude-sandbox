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
          <v-text-field
            v-model="branch"
            label="Branch (optional)"
            hint="Leave empty to create a new branch from default"
            persistent-hint
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
import { ref, onMounted } from 'vue'
import { useSessionStore } from '@/stores/sessionStore'
import { trpc } from '@/api/trpc'

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
const claudeSourceUser = ref<string | null>(null)
const claudeSourceUsers = ref<string[]>([])
const gitUserName = ref('')
const gitUserEmail = ref('')
const loading = ref(false)

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

function close() {
  model.value = false
  sessionName.value = ''
  branch.value = ''
  gitUserName.value = ''
  gitUserEmail.value = ''
}

async function submit() {
  const { valid } = await form.value.validate()
  if (!valid) return

  loading.value = true
  try {
    await sessionStore.createSession(props.projectId, {
      name: sessionName.value,
      branch: branch.value || undefined,
      claudeSourceUser: claudeSourceUser.value || undefined,
      gitUserName: gitUserName.value || undefined,
      gitUserEmail: gitUserEmail.value || undefined,
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

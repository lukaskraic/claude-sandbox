<template>
  <v-dialog :model-value="modelValue" max-width="600" @update:model-value="$emit('update:modelValue', $event)">
    <v-card>
      <v-card-title>Create New Project</v-card-title>
      <v-card-text>
        <v-form ref="form" v-model="valid">
          <v-text-field
            v-model="formData.name"
            label="Project Name"
            hint="Lowercase letters, numbers, and hyphens only"
            :rules="[rules.required, rules.projectName]"
          />
          <v-text-field
            v-model="formData.description"
            label="Description"
          />
          <v-text-field
            v-model="formData.git.remote"
            label="Git Remote URL"
            :rules="[rules.required, rules.url]"
          />
          <v-text-field
            v-model="formData.git.defaultBranch"
            label="Default Branch"
            :rules="[rules.required]"
          />
          <v-text-field
            v-model="formData.environment.baseImage"
            label="Base Image"
            hint="e.g., node:20-bookworm"
            :rules="[rules.required]"
          />
          <v-textarea
            v-model="formData.setup"
            label="Setup Script"
            hint="Commands to run when session starts"
            rows="3"
          />
        </v-form>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn @click="$emit('update:modelValue', false)">Cancel</v-btn>
        <v-btn color="primary" :loading="loading" :disabled="!valid" @click="submit">
          Create
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useProjectStore } from '@/stores/projectStore'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'created': []
}>()

const projectStore = useProjectStore()
const form = ref()
const valid = ref(false)
const loading = ref(false)

const formData = reactive({
  name: '',
  description: '',
  git: {
    remote: '',
    defaultBranch: 'main',
    worktreeBase: '',
  },
  environment: {
    baseImage: 'node:20-bookworm',
  },
  setup: '',
})

const rules = {
  required: (v: string) => !!v || 'Required',
  projectName: (v: string) => /^[a-z0-9-]+$/.test(v) || 'Lowercase letters, numbers, and hyphens only',
  url: (v: string) => /^https?:\/\//.test(v) || v.startsWith('git@') || 'Invalid URL',
}

async function submit() {
  if (!form.value.validate()) return

  loading.value = true
  try {
    await projectStore.createProject(formData)
    emit('created')
    resetForm()
  } finally {
    loading.value = false
  }
}

function resetForm() {
  formData.name = ''
  formData.description = ''
  formData.git.remote = ''
  formData.git.defaultBranch = 'main'
  formData.environment.baseImage = 'node:20-bookworm'
  formData.setup = ''
}
</script>

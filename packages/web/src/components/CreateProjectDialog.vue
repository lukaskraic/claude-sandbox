<template>
  <v-dialog :model-value="modelValue" max-width="800" @update:model-value="$emit('update:modelValue', $event)">
    <v-card>
      <v-card-title>Create New Project</v-card-title>
      <v-card-text>
        <v-form ref="form" v-model="valid">
          <!-- Basic Info -->
          <v-row>
            <v-col cols="6">
              <v-text-field
                v-model="formData.name"
                label="Project Name"
                hint="Lowercase letters, numbers, and hyphens only"
                :rules="[rules.required, rules.projectName]"
              />
            </v-col>
            <v-col cols="6">
              <v-text-field
                v-model="formData.description"
                label="Description"
              />
            </v-col>
          </v-row>

          <!-- Git Config -->
          <v-row>
            <v-col cols="8">
              <v-text-field
                v-model="formData.git.remote"
                label="Git Remote URL"
                :rules="[rules.required, rules.url]"
              />
            </v-col>
            <v-col cols="4">
              <v-text-field
                v-model="formData.git.defaultBranch"
                label="Default Branch"
                :rules="[rules.required]"
              />
            </v-col>
          </v-row>

          <v-divider class="my-4" />

          <!-- Environment Configuration -->
          <div class="text-subtitle-1 mb-2">Environment Configuration</div>

          <v-text-field
            v-model="formData.environment.baseImage"
            label="Base Image"
            hint="e.g., ubuntu:22.04, node:20-bookworm"
            :rules="[rules.required]"
          />

          <!-- Runtimes -->
          <v-expansion-panels class="mb-4">
            <v-expansion-panel title="Runtimes">
              <v-expansion-panel-text>
                <v-row>
                  <v-col cols="6" md="3">
                    <v-select
                      v-model="formData.environment.runtimes.java"
                      label="Java"
                      :items="['', '21', '17', '11']"
                      clearable
                      hint="JDK version"
                    />
                  </v-col>
                  <v-col cols="6" md="3">
                    <v-select
                      v-model="formData.environment.runtimes.node"
                      label="Node.js"
                      :items="['', '22', '20', '18', '16']"
                      clearable
                      hint="Node version"
                    />
                  </v-col>
                  <v-col cols="6" md="3">
                    <v-select
                      v-model="formData.environment.runtimes.python"
                      label="Python"
                      :items="['', '3.12', '3.11', '3.10', '3.9']"
                      clearable
                      hint="Python version"
                    />
                  </v-col>
                  <v-col cols="6" md="3">
                    <v-select
                      v-model="formData.environment.runtimes.go"
                      label="Go"
                      :items="['', '1.22', '1.21', '1.20']"
                      clearable
                      hint="Go version"
                    />
                  </v-col>
                </v-row>
              </v-expansion-panel-text>
            </v-expansion-panel>

            <!-- Packages -->
            <v-expansion-panel title="System Packages">
              <v-expansion-panel-text>
                <v-combobox
                  v-model="formData.environment.packages"
                  label="APT Packages"
                  hint="Press Enter to add packages"
                  multiple
                  chips
                  closable-chips
                />
              </v-expansion-panel-text>
            </v-expansion-panel>

            <!-- Tools -->
            <v-expansion-panel title="Development Tools">
              <v-expansion-panel-text>
                <v-combobox
                  v-model="formData.environment.tools.npm"
                  label="NPM Global Packages"
                  hint="e.g., typescript, @vue/cli"
                  multiple
                  chips
                  closable-chips
                  class="mb-4"
                />
                <v-combobox
                  v-model="formData.environment.tools.pip"
                  label="Python Packages (pip)"
                  hint="e.g., requests, flask"
                  multiple
                  chips
                  closable-chips
                  class="mb-4"
                />
                <v-checkbox
                  v-model="installClaudeCode"
                  label="Install Claude Code CLI"
                  hint="Installs @anthropic-ai/claude-code globally"
                />
              </v-expansion-panel-text>
            </v-expansion-panel>

            <!-- Services -->
            <v-expansion-panel title="Services">
              <v-expansion-panel-text>
                <div v-for="(service, index) in formData.environment.services" :key="index" class="mb-4">
                  <v-row align="center">
                    <v-col cols="4">
                      <v-select
                        v-model="service.type"
                        label="Service Type"
                        :items="serviceTypes"
                        :rules="[rules.required]"
                      />
                    </v-col>
                    <v-col cols="3">
                      <v-text-field
                        v-model="service.version"
                        label="Version"
                        :rules="[rules.required]"
                      />
                    </v-col>
                    <v-col cols="3">
                      <v-text-field
                        v-model="service.database"
                        label="Database"
                        hint="For postgres/mysql"
                      />
                    </v-col>
                    <v-col cols="2">
                      <v-btn icon="mdi-delete" color="error" variant="text" @click="removeService(index)" />
                    </v-col>
                  </v-row>
                </div>
                <v-btn prepend-icon="mdi-plus" variant="outlined" @click="addService">
                  Add Service
                </v-btn>
              </v-expansion-panel-text>
            </v-expansion-panel>

            <!-- Setup Script -->
            <v-expansion-panel title="Setup Script">
              <v-expansion-panel-text>
                <v-textarea
                  v-model="formData.environment.setup"
                  label="Setup Script"
                  hint="Commands to run when session starts (e.g., npm install)"
                  rows="4"
                  font="monospace"
                />
              </v-expansion-panel-text>
            </v-expansion-panel>

            <!-- Ports -->
            <v-expansion-panel title="Port Mapping">
              <v-expansion-panel-text>
                <v-combobox
                  v-model="formData.environment.ports"
                  label="Exposed Ports"
                  hint="Format: container:host (e.g., 3000:3000)"
                  multiple
                  chips
                  closable-chips
                />
              </v-expansion-panel-text>
            </v-expansion-panel>
          </v-expansion-panels>
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
import { ref, reactive, computed } from 'vue'
import { useProjectStore } from '@/stores/projectStore'
import type { ServiceType } from '@claude-sandbox/shared'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'created': []
}>()

const projectStore = useProjectStore()
const form = ref()
const valid = ref(false)
const loading = ref(false)
const installClaudeCode = ref(false)

const serviceTypes: ServiceType[] = ['postgres', 'mysql', 'redis', 'mongodb', 'elasticsearch']

interface ServiceConfig {
  type: ServiceType
  version: string
  database?: string
  user?: string
  password?: string
}

const formData = reactive({
  name: '',
  description: '',
  git: {
    remote: '',
    defaultBranch: 'main',
    worktreeBase: '',
  },
  environment: {
    baseImage: 'ubuntu:22.04',
    runtimes: {
      java: '' as string | undefined,
      node: '' as string | undefined,
      python: '' as string | undefined,
      go: '' as string | undefined,
    },
    packages: [] as string[],
    tools: {
      npm: [] as string[],
      pip: [] as string[],
      custom: [] as string[],
    },
    services: [] as ServiceConfig[],
    setup: '',
    ports: [] as string[],
    env: {} as Record<string, string>,
  },
})

const rules = {
  required: (v: string) => !!v || 'Required',
  projectName: (v: string) => /^[a-z0-9-]+$/.test(v) || 'Lowercase letters, numbers, and hyphens only',
  url: (v: string) => /^https?:\/\//.test(v) || v.startsWith('git@') || 'Invalid URL',
}

function addService() {
  formData.environment.services.push({
    type: 'postgres',
    version: '16',
    database: 'app',
  })
}

function removeService(index: number) {
  formData.environment.services.splice(index, 1)
}

async function submit() {
  if (!form.value.validate()) return

  loading.value = true
  try {
    // Build the project data
    const projectData = {
      name: formData.name,
      description: formData.description || undefined,
      git: {
        remote: formData.git.remote,
        defaultBranch: formData.git.defaultBranch,
      },
      environment: {
        baseImage: formData.environment.baseImage,
        runtimes: cleanRuntimes(formData.environment.runtimes),
        packages: formData.environment.packages.length > 0 ? formData.environment.packages : undefined,
        tools: cleanTools(),
        services: formData.environment.services.length > 0 ? formData.environment.services : undefined,
        setup: formData.environment.setup || undefined,
        ports: formData.environment.ports.length > 0 ? formData.environment.ports : undefined,
      },
    }

    await projectStore.createProject(projectData)
    emit('created')
    resetForm()
  } finally {
    loading.value = false
  }
}

function cleanRuntimes(runtimes: typeof formData.environment.runtimes) {
  const cleaned: Record<string, string> = {}
  if (runtimes.java) cleaned.java = runtimes.java
  if (runtimes.node) cleaned.node = runtimes.node
  if (runtimes.python) cleaned.python = runtimes.python
  if (runtimes.go) cleaned.go = runtimes.go
  return Object.keys(cleaned).length > 0 ? cleaned : undefined
}

function cleanTools() {
  const tools: { npm?: string[]; pip?: string[]; custom?: string[] } = {}
  if (formData.environment.tools.npm.length > 0) tools.npm = formData.environment.tools.npm
  if (formData.environment.tools.pip.length > 0) tools.pip = formData.environment.tools.pip
  if (installClaudeCode.value) {
    tools.custom = ['claude-code']
  }
  return Object.keys(tools).length > 0 ? tools : undefined
}

function resetForm() {
  formData.name = ''
  formData.description = ''
  formData.git.remote = ''
  formData.git.defaultBranch = 'main'
  formData.environment.baseImage = 'ubuntu:22.04'
  formData.environment.runtimes = { java: '', node: '', python: '', go: '' }
  formData.environment.packages = []
  formData.environment.tools = { npm: [], pip: [], custom: [] }
  formData.environment.services = []
  formData.environment.setup = ''
  formData.environment.ports = []
  installClaudeCode.value = false
}
</script>

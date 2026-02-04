<template>
  <v-dialog :model-value="modelValue" max-width="900" @update:model-value="$emit('update:modelValue', $event)">
    <v-card>
      <v-card-title class="d-flex align-center">
        <span>Edit Project: {{ project?.name }}</span>
        <v-spacer />
        <v-btn-toggle v-model="editMode" mandatory density="compact" color="primary">
          <v-btn value="form" size="small">
            <v-icon start>mdi-form-select</v-icon>
            Form
          </v-btn>
          <v-btn value="yaml" size="small">
            <v-icon start>mdi-code-braces</v-icon>
            YAML
          </v-btn>
        </v-btn-toggle>
      </v-card-title>
      <v-card-text>
        <!-- YAML Edit Mode -->
        <div v-if="editMode === 'yaml'">
          <v-alert type="info" density="compact" class="mb-4">
            Edit configuration as YAML. Changes will be validated before saving.
          </v-alert>
          <v-textarea
            v-model="yamlContent"
            label="Project Configuration (YAML)"
            rows="25"
            style="font-family: monospace; font-size: 13px;"
            :error-messages="yamlError"
            hide-details="auto"
          />
        </div>

        <!-- Form Edit Mode -->
        <v-form v-else ref="form" v-model="valid">
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
            hint="e.g., ubuntu:22.04, eclipse-temurin:21-jdk"
            :rules="[rules.required]"
          />

          <v-expansion-panels class="mb-4">
            <!-- Runtimes -->
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
                <div v-for="(service, index) in formData.environment.services" :key="index" class="mb-4 pa-3 bg-grey-darken-4 rounded">
                  <v-row align="center">
                    <v-col cols="3">
                      <v-select
                        v-model="service.type"
                        label="Service Type"
                        :items="serviceTypes"
                        :rules="[rules.required]"
                        density="compact"
                      />
                    </v-col>
                    <v-col cols="2">
                      <v-text-field
                        v-model="service.version"
                        label="Version"
                        :rules="[rules.required]"
                        density="compact"
                      />
                    </v-col>
                    <v-col cols="2">
                      <v-text-field
                        v-model="service.database"
                        label="Database"
                        hint="For postgres/mysql"
                        density="compact"
                      />
                    </v-col>
                    <v-col cols="2">
                      <v-text-field
                        v-model="service.user"
                        label="User"
                        density="compact"
                      />
                    </v-col>
                    <v-col cols="2">
                      <v-text-field
                        v-model="service.password"
                        label="Password"
                        type="password"
                        density="compact"
                      />
                    </v-col>
                    <v-col cols="1">
                      <v-btn icon="mdi-delete" color="error" variant="text" size="small" @click="removeService(index)" />
                    </v-col>
                  </v-row>
                  <v-row v-if="(service.type === 'postgres' || service.type === 'mysql') && project">
                    <v-col cols="12">
                      <SqlFileUpload
                        v-model="service.initSqlFile"
                        :project-id="project.id"
                      />
                    </v-col>
                  </v-row>
                </div>
                <v-btn prepend-icon="mdi-plus" variant="outlined" @click="addService">
                  Add Service
                </v-btn>
              </v-expansion-panel-text>
            </v-expansion-panel>

            <!-- Environment Variables -->
            <v-expansion-panel title="Environment Variables">
              <v-expansion-panel-text>
                <div v-for="(_, key, index) in formData.environment.env" :key="index" class="mb-2">
                  <v-row align="center">
                    <v-col cols="5">
                      <v-text-field
                        :model-value="key"
                        label="Variable Name"
                        density="compact"
                        @update:model-value="renameEnvVar(key, $event)"
                      />
                    </v-col>
                    <v-col cols="5">
                      <v-text-field
                        v-model="formData.environment.env[key]"
                        label="Value"
                        density="compact"
                      />
                    </v-col>
                    <v-col cols="2">
                      <v-btn icon="mdi-delete" color="error" variant="text" size="small" @click="removeEnvVar(key)" />
                    </v-col>
                  </v-row>
                </div>
                <v-row>
                  <v-col cols="5">
                    <v-text-field
                      v-model="newEnvKey"
                      label="New Variable Name"
                      density="compact"
                    />
                  </v-col>
                  <v-col cols="5">
                    <v-text-field
                      v-model="newEnvValue"
                      label="Value"
                      density="compact"
                    />
                  </v-col>
                  <v-col cols="2">
                    <v-btn icon="mdi-plus" color="primary" variant="text" :disabled="!newEnvKey" @click="addEnvVar" />
                  </v-col>
                </v-row>
              </v-expansion-panel-text>
            </v-expansion-panel>

            <!-- Proxy Configuration -->
            <v-expansion-panel title="Proxy Configuration">
              <v-expansion-panel-text>
                <v-alert type="info" density="compact" class="mb-4">
                  Configure proxy settings for apt, npm, and other tools during image build and runtime.
                  If left empty, environment variables from the server will be used.
                </v-alert>
                <v-row>
                  <v-col cols="12" md="6">
                    <v-text-field
                      v-model="formData.environment.proxy.http"
                      label="HTTP Proxy"
                      hint="e.g., http://proxy.example.com:8080"
                      persistent-hint
                    />
                  </v-col>
                  <v-col cols="12" md="6">
                    <v-text-field
                      v-model="formData.environment.proxy.https"
                      label="HTTPS Proxy"
                      hint="e.g., http://proxy.example.com:8080"
                      persistent-hint
                    />
                  </v-col>
                </v-row>
                <v-text-field
                  v-model="formData.environment.proxy.noProxy"
                  label="No Proxy"
                  hint="Comma-separated list of hosts to bypass proxy (e.g., localhost,127.0.0.1,.local)"
                  persistent-hint
                />
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
                  style="font-family: monospace;"
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

            <!-- Mounts -->
            <v-expansion-panel title="Volume Mounts">
              <v-expansion-panel-text>
                <div v-for="(mount, index) in formData.mounts" :key="index" class="mb-2">
                  <v-row align="center">
                    <v-col cols="4">
                      <v-text-field
                        v-model="mount.source"
                        label="Source Path"
                        hint="Host path (use ~ for home)"
                        density="compact"
                      />
                    </v-col>
                    <v-col cols="4">
                      <v-text-field
                        v-model="mount.target"
                        label="Target Path"
                        hint="Container path"
                        density="compact"
                      />
                    </v-col>
                    <v-col cols="2">
                      <v-checkbox
                        v-model="mount.readonly"
                        label="Read-only"
                        density="compact"
                        hide-details
                      />
                    </v-col>
                    <v-col cols="2">
                      <v-btn icon="mdi-delete" color="error" variant="text" size="small" @click="removeMount(index)" />
                    </v-col>
                  </v-row>
                </div>
                <v-btn prepend-icon="mdi-plus" variant="outlined" @click="addMount">
                  Add Mount
                </v-btn>
              </v-expansion-panel-text>
            </v-expansion-panel>

            <!-- Claude Config -->
            <v-expansion-panel title="Claude Configuration">
              <v-expansion-panel-text>
                <v-textarea
                  v-model="formData.claude.claudeMd"
                  label="CLAUDE.md Content"
                  hint="Custom instructions for Claude Code in this project"
                  rows="8"
                  style="font-family: monospace;"
                  class="mb-4"
                />
                <v-combobox
                  v-model="formData.claude.permissions"
                  label="Permissions"
                  hint="e.g., Bash(npm:*), Bash(git:*)"
                  multiple
                  chips
                  closable-chips
                />
              </v-expansion-panel-text>
            </v-expansion-panel>

            <!-- MCP Servers -->
            <v-expansion-panel title="MCP Servers">
              <v-expansion-panel-text>
                <v-alert type="info" density="compact" class="mb-4">
                  Configure MCP servers for Claude Code. Playwright preset includes Chromium browser dependencies.
                </v-alert>

                <div class="d-flex gap-2 mb-4">
                  <v-menu>
                    <template #activator="{ props: menuProps }">
                      <v-btn v-bind="menuProps" prepend-icon="mdi-plus" variant="outlined" size="small">
                        Add Preset
                      </v-btn>
                    </template>
                    <v-list density="compact">
                      <v-list-item
                        title="Playwright"
                        subtitle="Browser automation with headless Chromium"
                        @click="addMcpPreset('playwright')"
                      />
                    </v-list>
                  </v-menu>
                  <v-btn prepend-icon="mdi-plus" variant="outlined" size="small" @click="addCustomMcpServer">
                    Add Custom
                  </v-btn>
                </div>

                <div v-for="(server, index) in formData.claude.mcpServers" :key="server.id" class="mb-4 pa-3 bg-grey-darken-4 rounded">
                  <v-row align="center">
                    <v-col cols="3">
                      <v-text-field
                        v-model="server.name"
                        label="Name"
                        density="compact"
                        :rules="[rules.required]"
                      />
                    </v-col>
                    <v-col cols="3">
                      <v-text-field
                        v-model="server.command"
                        label="Command"
                        density="compact"
                        :rules="[rules.required]"
                      />
                    </v-col>
                    <v-col cols="4">
                      <v-combobox
                        v-model="server.args"
                        label="Arguments"
                        density="compact"
                        multiple
                        chips
                        closable-chips
                        hint="Press Enter to add"
                      />
                    </v-col>
                    <v-col cols="1">
                      <v-switch
                        :model-value="server.enabled"
                        hide-details
                        density="compact"
                        color="primary"
                        @update:model-value="toggleMcpServer(index)"
                      />
                    </v-col>
                    <v-col cols="1">
                      <v-btn icon="mdi-delete" color="error" variant="text" size="small" @click="removeMcpServer(index)" />
                    </v-col>
                  </v-row>
                  <v-row v-if="server.env && Object.keys(server.env).length > 0">
                    <v-col cols="12">
                      <div class="text-caption text-grey">
                        Env: {{ Object.entries(server.env).map(([k, v]) => `${k}=${v}`).join(', ') }}
                      </div>
                    </v-col>
                  </v-row>
                </div>

                <div v-if="formData.claude.mcpServers.length === 0" class="text-grey text-center py-4">
                  No MCP servers configured
                </div>
              </v-expansion-panel-text>
            </v-expansion-panel>
          </v-expansion-panels>
        </v-form>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn @click="$emit('update:modelValue', false)">Cancel</v-btn>
        <v-btn color="primary" :loading="loading" :disabled="editMode === 'form' && !valid" @click="submit">
          Save
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import { trpc } from '@/api/trpc'
import type { Project, ServiceType, ProjectMount, MCPServerConfig, MCPPreset } from '@claude-sandbox/shared'
import * as yaml from 'js-yaml'
import SqlFileUpload from './SqlFileUpload.vue'

const props = defineProps<{
  modelValue: boolean
  project: Project | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'updated': []
}>()

const form = ref()
const valid = ref(false)
const loading = ref(false)
const installClaudeCode = ref(false)
const editMode = ref<'form' | 'yaml'>('form')
const yamlContent = ref('')
const yamlError = ref('')

const newEnvKey = ref('')
const newEnvValue = ref('')

const serviceTypes: ServiceType[] = ['postgres', 'mysql', 'redis', 'mongodb', 'elasticsearch']

// MCP Presets
const MCP_PRESETS: Record<MCPPreset, Omit<MCPServerConfig, 'id' | 'enabled'>> = {
  playwright: {
    name: 'playwright',
    command: 'npx',
    args: ['-y', '@playwright/mcp@latest'],
    env: {
      PLAYWRIGHT_MCP_HEADLESS: 'true',
      PLAYWRIGHT_MCP_BROWSER: 'chromium',
    },
  },
}

interface ServiceConfig {
  type: ServiceType
  version: string
  database?: string
  user?: string
  password?: string
  initSqlFile?: string
}

const formData = reactive({
  name: '',
  description: '',
  git: {
    remote: '',
    defaultBranch: 'main',
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
    proxy: {
      http: '',
      https: '',
      noProxy: '',
    },
  },
  mounts: [] as ProjectMount[],
  claude: {
    claudeMd: '',
    permissions: [] as string[],
    mcpServers: [] as MCPServerConfig[],
  },
})

const rules = {
  required: (v: string) => !!v || 'Required',
  projectName: (v: string) => /^[a-z0-9-]+$/.test(v) || 'Lowercase letters, numbers, and hyphens only',
  url: (v: string) => /^https?:\/\//.test(v) || v.startsWith('git@') || 'Invalid URL',
}

// Watch for project changes and populate form
watch(() => props.project, (newProject) => {
  if (newProject) {
    // Reset to form mode when dialog opens with new project
    editMode.value = 'form'
    yamlError.value = ''

    formData.name = newProject.name
    formData.description = newProject.description || ''
    formData.git.remote = newProject.git.remote
    formData.git.defaultBranch = newProject.git.defaultBranch
    formData.environment.baseImage = newProject.environment.baseImage
    formData.environment.runtimes = {
      java: newProject.environment.runtimes?.java || '',
      node: newProject.environment.runtimes?.node || '',
      python: newProject.environment.runtimes?.python || '',
      go: newProject.environment.runtimes?.go || '',
    }
    formData.environment.packages = newProject.environment.packages || []
    formData.environment.tools = {
      npm: newProject.environment.tools?.npm || [],
      pip: newProject.environment.tools?.pip || [],
      custom: newProject.environment.tools?.custom || [],
    }
    formData.environment.services = (newProject.environment.services || []).map(s => ({ ...s }))
    formData.environment.setup = newProject.environment.setup || ''
    formData.environment.ports = newProject.environment.ports || []
    formData.environment.env = { ...(newProject.environment.env || {}) }
    formData.environment.proxy = {
      http: newProject.environment.proxy?.http || '',
      https: newProject.environment.proxy?.https || '',
      noProxy: newProject.environment.proxy?.noProxy || '',
    }
    formData.mounts = (newProject.mounts || []).map(m => ({ ...m }))
    formData.claude = {
      claudeMd: newProject.claude?.claudeMd || '',
      permissions: newProject.claude?.permissions || [],
      mcpServers: (newProject.claude?.mcpServers || []).map(s => ({ ...s })),
    }
    installClaudeCode.value = newProject.environment.tools?.custom?.includes('claude-code') || false

    // Update YAML content
    updateYamlFromForm()
  }
}, { immediate: true })

// Watch edit mode changes
watch(editMode, (newMode, oldMode) => {
  if (!oldMode) return // Skip initial trigger

  if (newMode === 'yaml' && oldMode === 'form') {
    updateYamlFromForm()
  } else if (newMode === 'form' && oldMode === 'yaml') {
    try {
      updateFormFromYaml()
      yamlError.value = ''
    } catch (e) {
      yamlError.value = e instanceof Error ? e.message : 'Invalid YAML'
      // Don't force back to YAML - show error and let user fix or stay
      console.error('YAML parse error:', e)
    }
  }
})

function updateYamlFromForm() {
  const config = {
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
      env: Object.keys(formData.environment.env).length > 0 ? formData.environment.env : undefined,
      proxy: cleanProxy(),
    },
    mounts: formData.mounts.length > 0 ? formData.mounts : undefined,
    claude: (formData.claude.claudeMd || formData.claude.permissions.length > 0 || formData.claude.mcpServers.length > 0) ? {
      claudeMd: formData.claude.claudeMd || undefined,
      permissions: formData.claude.permissions.length > 0 ? formData.claude.permissions : undefined,
      mcpServers: formData.claude.mcpServers.length > 0 ? formData.claude.mcpServers : undefined,
    } : undefined,
  }
  yamlContent.value = yaml.dump(config, { indent: 2, lineWidth: -1 })
}

function updateFormFromYaml() {
  const parsed = yaml.load(yamlContent.value) as any
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid YAML structure')
  }

  formData.name = parsed.name || ''
  formData.description = parsed.description || ''
  formData.git.remote = parsed.git?.remote || ''
  formData.git.defaultBranch = parsed.git?.defaultBranch || 'main'
  formData.environment.baseImage = parsed.environment?.baseImage || 'ubuntu:22.04'
  formData.environment.runtimes = {
    java: parsed.environment?.runtimes?.java || '',
    node: parsed.environment?.runtimes?.node || '',
    python: parsed.environment?.runtimes?.python || '',
    go: parsed.environment?.runtimes?.go || '',
  }
  formData.environment.packages = parsed.environment?.packages || []
  formData.environment.tools = {
    npm: parsed.environment?.tools?.npm || [],
    pip: parsed.environment?.tools?.pip || [],
    custom: parsed.environment?.tools?.custom || [],
  }
  formData.environment.services = parsed.environment?.services || []
  formData.environment.setup = parsed.environment?.setup || ''
  formData.environment.ports = parsed.environment?.ports || []
  formData.environment.env = parsed.environment?.env || {}
  formData.environment.proxy = {
    http: parsed.environment?.proxy?.http || '',
    https: parsed.environment?.proxy?.https || '',
    noProxy: parsed.environment?.proxy?.noProxy || '',
  }
  formData.mounts = parsed.mounts || []
  formData.claude = {
    claudeMd: parsed.claude?.claudeMd || '',
    permissions: parsed.claude?.permissions || [],
    mcpServers: parsed.claude?.mcpServers || [],
  }
  installClaudeCode.value = formData.environment.tools.custom?.includes('claude-code') || false
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

function addMount() {
  formData.mounts.push({
    source: '',
    target: '',
    readonly: false,
  })
}

function removeMount(index: number) {
  formData.mounts.splice(index, 1)
}

function addEnvVar() {
  if (newEnvKey.value) {
    formData.environment.env[newEnvKey.value] = newEnvValue.value
    newEnvKey.value = ''
    newEnvValue.value = ''
  }
}

function removeEnvVar(key: string) {
  delete formData.environment.env[key]
}

function renameEnvVar(oldKey: string, newKey: string) {
  if (oldKey !== newKey && newKey) {
    const value = formData.environment.env[oldKey]
    delete formData.environment.env[oldKey]
    formData.environment.env[newKey] = value
  }
}

function addMcpPreset(preset: MCPPreset) {
  const presetConfig = MCP_PRESETS[preset]
  if (!presetConfig) return

  // Check if already added
  if (formData.claude.mcpServers.some(s => s.name === presetConfig.name)) {
    return
  }

  formData.claude.mcpServers.push({
    id: crypto.randomUUID(),
    ...presetConfig,
    enabled: true,
  })
}

function addCustomMcpServer() {
  formData.claude.mcpServers.push({
    id: crypto.randomUUID(),
    name: '',
    command: 'npx',
    args: [],
    env: {},
    enabled: true,
  })
}

function removeMcpServer(index: number) {
  formData.claude.mcpServers.splice(index, 1)
}

function toggleMcpServer(index: number) {
  formData.claude.mcpServers[index].enabled = !formData.claude.mcpServers[index].enabled
}

async function submit() {
  if (editMode.value === 'yaml') {
    try {
      updateFormFromYaml()
      yamlError.value = ''
    } catch (e) {
      yamlError.value = e instanceof Error ? e.message : 'Invalid YAML'
      return
    }
  } else {
    const isValid = await form.value?.validate()
    if (!isValid?.valid) {
      return
    }
  }

  if (!props.project) return

  loading.value = true
  try {
    const updateData = {
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
        env: Object.keys(formData.environment.env).length > 0 ? formData.environment.env : undefined,
        proxy: cleanProxy(),
      },
      mounts: formData.mounts.length > 0 ? formData.mounts : undefined,
      claude: (formData.claude.claudeMd || formData.claude.permissions.length > 0 || formData.claude.mcpServers.length > 0) ? {
        claudeMd: formData.claude.claudeMd || undefined,
        permissions: formData.claude.permissions.length > 0 ? formData.claude.permissions : undefined,
        mcpServers: formData.claude.mcpServers.length > 0 ? formData.claude.mcpServers : undefined,
      } : undefined,
    }

    await trpc.project.update.mutate({ id: props.project.id, data: updateData })
    emit('updated')
    emit('update:modelValue', false)
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
  return Object.keys(cleaned).length > 0 ? cleaned : null
}

function cleanTools() {
  const tools: { npm?: string[]; pip?: string[]; custom?: string[] } = {}
  if (formData.environment.tools.npm.length > 0) tools.npm = formData.environment.tools.npm
  if (formData.environment.tools.pip.length > 0) tools.pip = formData.environment.tools.pip
  if (installClaudeCode.value) {
    tools.custom = ['claude-code']
  }
  // Return null (not undefined) to explicitly clear - undefined gets dropped by JSON.stringify
  return Object.keys(tools).length > 0 ? tools : null
}

function cleanProxy() {
  const proxy: { http?: string; https?: string; noProxy?: string } = {}
  if (formData.environment.proxy.http) proxy.http = formData.environment.proxy.http
  if (formData.environment.proxy.https) proxy.https = formData.environment.proxy.https
  if (formData.environment.proxy.noProxy) proxy.noProxy = formData.environment.proxy.noProxy
  return Object.keys(proxy).length > 0 ? proxy : null
}
</script>

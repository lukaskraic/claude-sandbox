<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <div class="d-flex align-center mb-4">
          <h1 class="text-h4">Worktrees</h1>
          <v-spacer />
          <v-btn
            v-if="orphanedWorktrees.length > 0"
            color="error"
            variant="outlined"
            prepend-icon="mdi-delete-sweep"
            @click="confirmDeleteAllOrphans"
          >
            Delete All Orphans ({{ orphanedWorktrees.length }})
          </v-btn>
        </div>
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12">
        <v-row class="mb-2">
          <v-col cols="4">
            <v-select
              v-model="filterProject"
              :items="projectOptions"
              label="Filter by project"
              clearable
              density="compact"
              hide-details
            />
          </v-col>
          <v-col cols="4">
            <v-select
              v-model="filterStatus"
              :items="statusOptions"
              label="Filter by status"
              clearable
              density="compact"
              hide-details
            />
          </v-col>
        </v-row>
      </v-col>
    </v-row>

    <v-row v-if="loading">
      <v-col cols="12" class="text-center">
        <v-progress-circular indeterminate color="primary" />
      </v-col>
    </v-row>

    <v-row v-else-if="filteredWorktrees.length === 0">
      <v-col cols="12">
        <v-alert type="info" variant="tonal">
          No worktrees found.
        </v-alert>
      </v-col>
    </v-row>

    <v-row v-else>
      <v-col cols="12">
        <v-table>
          <thead>
            <tr>
              <th>Project</th>
              <th>Branch</th>
              <th>Commit</th>
              <th>Session</th>
              <th>Claude State</th>
              <th>Last Modified</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="wt in filteredWorktrees" :key="wt.path">
              <td>
                <v-chip size="small" color="primary" variant="tonal">
                  {{ wt.projectName }}
                </v-chip>
              </td>
              <td>{{ wt.branch }}</td>
              <td>
                <code>{{ wt.commit.slice(0, 8) }}</code>
              </td>
              <td>
                <router-link v-if="wt.session" :to="`/sessions/${wt.session.id}`">
                  <v-chip :color="sessionStatusColor(wt.session.status)" size="small">
                    {{ wt.session.name }}
                  </v-chip>
                </router-link>
                <v-chip v-else size="small" color="warning" variant="outlined">
                  Orphaned
                </v-chip>
              </td>
              <td>
                <v-icon v-if="wt.claudeStateExists" color="success" size="small">mdi-check-circle</v-icon>
                <v-icon v-else color="grey" size="small">mdi-minus-circle-outline</v-icon>
              </td>
              <td>
                <span v-if="wt.lastModified" class="text-body-2 text-grey">
                  {{ formatDate(wt.lastModified) }}
                </span>
                <span v-else>-</span>
              </td>
              <td>
                <v-btn
                  icon="mdi-delete"
                  size="small"
                  color="error"
                  variant="text"
                  :disabled="wt.session?.status === 'running' || wt.session?.status === 'starting'"
                  @click="confirmDelete(wt)"
                />
              </td>
            </tr>
          </tbody>
        </v-table>
      </v-col>
    </v-row>

    <v-dialog v-model="deleteDialog" max-width="500">
      <v-card>
        <v-card-title>Delete Worktree</v-card-title>
        <v-card-text>
          <p>Are you sure you want to delete this worktree?</p>
          <p v-if="deleteTarget" class="mt-2">
            <strong>Branch:</strong> {{ deleteTarget.branch }}<br>
            <strong>Project:</strong> {{ deleteTarget.projectName }}
          </p>
          <v-checkbox
            v-model="deleteClaudeState"
            label="Also delete Claude state data"
            :disabled="!deleteTarget?.claudeStateExists"
            hide-details
            class="mt-2"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="deleteDialog = false">Cancel</v-btn>
          <v-btn color="error" @click="executeDelete">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="bulkDeleteDialog" max-width="500">
      <v-card>
        <v-card-title>Delete All Orphaned Worktrees</v-card-title>
        <v-card-text>
          <p>This will delete {{ orphanedWorktrees.length }} orphaned worktree(s) and their Claude state data.</p>
          <p class="mt-2 text-warning">This action cannot be undone.</p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="bulkDeleteDialog = false">Cancel</v-btn>
          <v-btn color="error" :loading="deleting" @click="executeBulkDelete">Delete All</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { trpc } from '@/api/trpc'
import type { WorktreeInfo, SessionStatus } from '@claude-sandbox/shared'

const worktrees = ref<WorktreeInfo[]>([])
const loading = ref(false)
const deleting = ref(false)
const filterProject = ref<string | null>(null)
const filterStatus = ref<string | null>(null)
const deleteDialog = ref(false)
const bulkDeleteDialog = ref(false)
const deleteTarget = ref<WorktreeInfo | null>(null)
const deleteClaudeState = ref(true)

const projectOptions = computed(() => {
  const names = [...new Set(worktrees.value.map(wt => wt.projectName))]
  return names.sort()
})

const statusOptions = [
  { title: 'Orphaned', value: 'orphaned' },
  { title: 'Attached', value: 'attached' },
]

const orphanedWorktrees = computed(() =>
  worktrees.value.filter(wt => !wt.session)
)

const filteredWorktrees = computed(() => {
  let result = worktrees.value
  if (filterProject.value) {
    result = result.filter(wt => wt.projectName === filterProject.value)
  }
  if (filterStatus.value === 'orphaned') {
    result = result.filter(wt => !wt.session)
  } else if (filterStatus.value === 'attached') {
    result = result.filter(wt => !!wt.session)
  }
  return result
})

onMounted(() => fetchWorktrees())

async function fetchWorktrees() {
  loading.value = true
  try {
    worktrees.value = await trpc.worktree.list.query()
  } finally {
    loading.value = false
  }
}

function sessionStatusColor(status: SessionStatus): string {
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString()
}

function confirmDelete(wt: WorktreeInfo) {
  deleteTarget.value = wt
  deleteClaudeState.value = wt.claudeStateExists
  deleteDialog.value = true
}

async function executeDelete() {
  if (!deleteTarget.value) return
  try {
    await trpc.worktree.delete.mutate({
      worktreePath: deleteTarget.value.path,
      cleanClaudeState: deleteClaudeState.value,
    })
    worktrees.value = worktrees.value.filter(wt => wt.path !== deleteTarget.value!.path)
  } finally {
    deleteDialog.value = false
    deleteTarget.value = null
  }
}

function confirmDeleteAllOrphans() {
  bulkDeleteDialog.value = true
}

async function executeBulkDelete() {
  deleting.value = true
  try {
    for (const wt of orphanedWorktrees.value) {
      await trpc.worktree.delete.mutate({
        worktreePath: wt.path,
        cleanClaudeState: true,
      })
    }
    await fetchWorktrees()
  } finally {
    deleting.value = false
    bulkDeleteDialog.value = false
  }
}
</script>

<template>
  <div>
    <v-data-table
      v-model="selected"
      :headers="headers"
      :items="containers"
      :loading="loading"
      show-select
      item-value="id"
      class="elevation-0"
    >
      <template #item.state="{ item }">
        <v-chip
          :color="getStateColor(item.state)"
          size="small"
          label
        >
          {{ item.state }}
        </v-chip>
      </template>

      <template #item.type="{ item }">
        <v-chip
          :color="item.type === 'main' ? 'primary' : 'secondary'"
          size="small"
          variant="outlined"
        >
          {{ item.type }}
        </v-chip>
      </template>

      <template #item.name="{ item }">
        <div>
          <div class="font-weight-medium">{{ item.name }}</div>
          <div v-if="item.sessionName" class="text-caption text-medium-emphasis">
            Session: {{ item.sessionName }}
          </div>
        </div>
      </template>

      <template #item.ports="{ item }">
        <div v-if="Object.keys(item.ports).length > 0">
          <v-chip
            v-for="(hostPort, containerPort) in item.ports"
            :key="containerPort"
            size="x-small"
            class="mr-1"
          >
            {{ containerPort }}:{{ hostPort }}
          </v-chip>
        </div>
        <span v-else class="text-medium-emphasis">-</span>
      </template>

      <template #item.created="{ item }">
        {{ formatDate(item.created) }}
      </template>

      <template #item.stats="{ item }">
        <div v-if="stats.get(item.id)" class="d-flex ga-2">
          <v-tooltip location="top">
            <template #activator="{ props }">
              <v-chip v-bind="props" size="x-small" color="info">
                CPU {{ stats.get(item.id)?.cpuPercent.toFixed(1) }}%
              </v-chip>
            </template>
            CPU Usage
          </v-tooltip>
          <v-tooltip location="top">
            <template #activator="{ props }">
              <v-chip v-bind="props" size="x-small" color="warning">
                MEM {{ stats.get(item.id)?.memoryPercent.toFixed(1) }}%
              </v-chip>
            </template>
            {{ formatBytes(stats.get(item.id)?.memoryUsage || 0) }} / {{ formatBytes(stats.get(item.id)?.memoryLimit || 0) }}
          </v-tooltip>
        </div>
        <v-btn
          v-else-if="item.state === 'running'"
          size="x-small"
          variant="text"
          @click="emit('fetchStats', item.id)"
        >
          Load Stats
        </v-btn>
        <span v-else class="text-medium-emphasis">-</span>
      </template>

      <template #item.actions="{ item }">
        <div class="d-flex ga-1">
          <v-btn
            v-if="item.state !== 'running'"
            icon="mdi-play"
            size="x-small"
            color="success"
            variant="text"
            @click="emit('start', item.id)"
          />
          <v-btn
            v-if="item.state === 'running'"
            icon="mdi-stop"
            size="x-small"
            color="warning"
            variant="text"
            @click="emit('stop', item.id)"
          />
          <v-btn
            icon="mdi-delete"
            size="x-small"
            color="error"
            variant="text"
            @click="emit('remove', item.id)"
          />
        </div>
      </template>
    </v-data-table>

    <div v-if="selected.length > 0" class="mt-4 d-flex ga-2 align-center">
      <span class="text-body-2">{{ selected.length }} selected</span>
      <v-btn
        size="small"
        color="warning"
        variant="tonal"
        prepend-icon="mdi-stop"
        @click="emit('batchStop', selected)"
      >
        Stop Selected
      </v-btn>
      <v-btn
        size="small"
        color="error"
        variant="tonal"
        prepend-icon="mdi-delete"
        @click="emit('batchRemove', selected)"
      >
        Remove Selected
      </v-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { ProjectContainer, ContainerStats, ContainerState } from '@claude-sandbox/shared'

defineProps<{
  containers: ProjectContainer[]
  stats: Map<string, ContainerStats>
  loading: boolean
}>()

const emit = defineEmits<{
  start: [id: string]
  stop: [id: string]
  remove: [id: string]
  batchStop: [ids: string[]]
  batchRemove: [ids: string[]]
  fetchStats: [id: string]
}>()

const selected = ref<string[]>([])

const headers = [
  { title: 'Name', key: 'name', sortable: true },
  { title: 'Image', key: 'image', sortable: true },
  { title: 'Type', key: 'type', sortable: true },
  { title: 'State', key: 'state', sortable: true },
  { title: 'Ports', key: 'ports', sortable: false },
  { title: 'Stats', key: 'stats', sortable: false },
  { title: 'Created', key: 'created', sortable: true },
  { title: 'Actions', key: 'actions', sortable: false, align: 'end' as const },
]

function getStateColor(state: ContainerState): string {
  const colors: Record<ContainerState, string> = {
    running: 'success',
    created: 'info',
    paused: 'warning',
    restarting: 'warning',
    removing: 'error',
    exited: 'grey',
    dead: 'error',
  }
  return colors[state] || 'grey'
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleString()
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}
</script>

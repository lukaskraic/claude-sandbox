<template>
  <v-data-table
    :headers="headers"
    :items="volumes"
    :loading="loading"
    item-value="id"
    class="elevation-0"
  >
    <template #item.driver="{ item }">
      <v-chip size="small" variant="outlined">{{ item.driver }}</v-chip>
    </template>

    <template #item.size="{ item }">
      {{ item.size ? formatBytes(item.size) : '-' }}
    </template>

    <template #item.usedByContainers="{ item }">
      <v-chip
        :color="item.usedByContainers.length > 0 ? 'success' : 'grey'"
        size="small"
      >
        {{ item.usedByContainers.length }}
      </v-chip>
    </template>

    <template #item.created="{ item }">
      {{ formatDate(item.created) }}
    </template>

    <template #item.mountpoint="{ item }">
      <code class="text-caption">{{ truncatePath(item.mountpoint) }}</code>
    </template>
  </v-data-table>
</template>

<script setup lang="ts">
import type { ProjectVolume } from '@claude-sandbox/shared'

defineProps<{
  volumes: ProjectVolume[]
  loading: boolean
}>()

const headers = [
  { title: 'Name', key: 'name', sortable: true },
  { title: 'Driver', key: 'driver', sortable: true },
  { title: 'Mount Point', key: 'mountpoint', sortable: false },
  { title: 'Size', key: 'size', sortable: true },
  { title: 'Used By', key: 'usedByContainers', sortable: false },
  { title: 'Created', key: 'created', sortable: true },
]

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleString()
}

function truncatePath(path: string, maxLength = 50): string {
  if (path.length <= maxLength) return path
  return '...' + path.slice(-maxLength + 3)
}
</script>

<template>
  <v-data-table
    :headers="headers"
    :items="images"
    :loading="loading"
    item-value="id"
    class="elevation-0"
  >
    <template #item.tags="{ item }">
      <div>
        <v-chip
          v-for="tag in item.tags"
          :key="tag"
          size="small"
          class="mr-1 mb-1"
        >
          {{ tag }}
        </v-chip>
        <span v-if="item.tags.length === 0" class="text-medium-emphasis">&lt;untagged&gt;</span>
      </div>
    </template>

    <template #item.size="{ item }">
      {{ formatBytes(item.size) }}
    </template>

    <template #item.usedByContainers="{ item }">
      <v-chip
        :color="item.usedByContainers > 0 ? 'success' : 'grey'"
        size="small"
      >
        {{ item.usedByContainers }}
      </v-chip>
    </template>

    <template #item.created="{ item }">
      {{ formatDate(item.created) }}
    </template>

    <template #item.actions="{ item }">
      <v-btn
        icon="mdi-delete"
        size="x-small"
        color="error"
        variant="text"
        :disabled="item.usedByContainers > 0"
        @click="emit('remove', item.id)"
      />
    </template>
  </v-data-table>
</template>

<script setup lang="ts">
import type { ContainerImage } from '@claude-sandbox/shared'

defineProps<{
  images: ContainerImage[]
  loading: boolean
}>()

const emit = defineEmits<{
  remove: [id: string]
}>()

const headers = [
  { title: 'Tags', key: 'tags', sortable: false },
  { title: 'Size', key: 'size', sortable: true },
  { title: 'Used By', key: 'usedByContainers', sortable: true },
  { title: 'Created', key: 'created', sortable: true },
  { title: 'Actions', key: 'actions', sortable: false, align: 'end' as const },
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
</script>

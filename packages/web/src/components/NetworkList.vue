<template>
  <v-data-table
    :headers="headers"
    :items="networks"
    :loading="loading"
    item-value="id"
    class="elevation-0"
  >
    <template #item.driver="{ item }">
      <v-chip size="small" variant="outlined">{{ item.driver }}</v-chip>
    </template>

    <template #item.scope="{ item }">
      <v-chip size="small" :color="item.scope === 'local' ? 'info' : 'warning'">
        {{ item.scope }}
      </v-chip>
    </template>

    <template #item.containers="{ item }">
      <v-chip
        :color="item.containers.length > 0 ? 'success' : 'grey'"
        size="small"
      >
        {{ item.containers.length }}
      </v-chip>
    </template>

    <template #item.created="{ item }">
      {{ formatDate(item.created) }}
    </template>
  </v-data-table>
</template>

<script setup lang="ts">
import type { ProjectNetwork } from '@claude-sandbox/shared'

defineProps<{
  networks: ProjectNetwork[]
  loading: boolean
}>()

const headers = [
  { title: 'Name', key: 'name', sortable: true },
  { title: 'Driver', key: 'driver', sortable: true },
  { title: 'Scope', key: 'scope', sortable: true },
  { title: 'Containers', key: 'containers', sortable: false },
  { title: 'Created', key: 'created', sortable: true },
]

function formatDate(date: Date): string {
  return new Date(date).toLocaleString()
}
</script>

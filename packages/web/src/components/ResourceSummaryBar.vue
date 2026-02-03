<template>
  <div class="resource-summary-bar d-flex flex-wrap ga-4">
    <v-card variant="tonal" class="summary-card">
      <v-card-text class="d-flex align-center pa-3">
        <v-icon color="primary" class="mr-2">mdi-docker</v-icon>
        <div>
          <div class="text-h6">{{ summary?.containers.total || 0 }}</div>
          <div class="text-caption text-medium-emphasis">
            Containers
            <span v-if="summary?.containers.running" class="text-success">
              ({{ summary.containers.running }} running)
            </span>
          </div>
        </div>
      </v-card-text>
    </v-card>

    <v-card variant="tonal" class="summary-card">
      <v-card-text class="d-flex align-center pa-3">
        <v-icon color="secondary" class="mr-2">mdi-package-variant</v-icon>
        <div>
          <div class="text-h6">{{ summary?.images.total || 0 }}</div>
          <div class="text-caption text-medium-emphasis">
            Images
            <span v-if="summary?.images.size" class="text-medium-emphasis">
              ({{ formatBytes(summary.images.size) }})
            </span>
          </div>
        </div>
      </v-card-text>
    </v-card>

    <v-card variant="tonal" class="summary-card">
      <v-card-text class="d-flex align-center pa-3">
        <v-icon color="info" class="mr-2">mdi-lan</v-icon>
        <div>
          <div class="text-h6">{{ summary?.networks.total || 0 }}</div>
          <div class="text-caption text-medium-emphasis">Networks</div>
        </div>
      </v-card-text>
    </v-card>

    <v-card variant="tonal" class="summary-card">
      <v-card-text class="d-flex align-center pa-3">
        <v-icon color="warning" class="mr-2">mdi-database</v-icon>
        <div>
          <div class="text-h6">{{ summary?.volumes.total || 0 }}</div>
          <div class="text-caption text-medium-emphasis">
            Volumes
            <span v-if="summary?.volumes.size" class="text-medium-emphasis">
              ({{ formatBytes(summary.volumes.size) }})
            </span>
          </div>
        </div>
      </v-card-text>
    </v-card>

    <v-card v-if="summary?.containers.orphaned" variant="tonal" color="error" class="summary-card">
      <v-card-text class="d-flex align-center pa-3">
        <v-icon class="mr-2">mdi-alert-circle</v-icon>
        <div>
          <div class="text-h6">{{ summary.containers.orphaned }}</div>
          <div class="text-caption">Orphaned</div>
        </div>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import type { ProjectResourceSummary } from '@claude-sandbox/shared'

defineProps<{
  summary: ProjectResourceSummary | null
}>()

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}
</script>

<style scoped>
.summary-card {
  min-width: 140px;
}
</style>

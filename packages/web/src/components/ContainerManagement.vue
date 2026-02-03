<template>
  <v-card>
    <v-card-title class="d-flex align-center">
      <v-icon class="mr-2">mdi-docker</v-icon>
      Container Resources
      <v-spacer />
      <v-btn
        icon="mdi-refresh"
        variant="text"
        :loading="containerStore.loading"
        @click="refresh"
      />
    </v-card-title>

    <v-card-text>
      <ResourceSummaryBar :summary="containerStore.summary" class="mb-4" />

      <v-alert
        v-if="containerStore.orphanedContainers.length > 0"
        type="warning"
        variant="tonal"
        class="mb-4"
      >
        <div class="d-flex align-center">
          <span>
            {{ containerStore.orphanedContainers.length }} orphaned container(s) found
          </span>
          <v-spacer />
          <v-btn
            size="small"
            color="warning"
            variant="tonal"
            @click="showCleanupDialog = true"
          >
            Cleanup
          </v-btn>
        </div>
      </v-alert>

      <v-alert
        v-if="containerStore.error"
        type="error"
        variant="tonal"
        closable
        class="mb-4"
        @click:close="containerStore.clearError()"
      >
        {{ containerStore.error }}
      </v-alert>

      <v-tabs v-model="activeTab">
        <v-tab value="containers">
          <v-icon class="mr-2">mdi-docker</v-icon>
          Containers
          <v-chip size="x-small" class="ml-2">{{ containerStore.containers.length }}</v-chip>
        </v-tab>
        <v-tab value="images">
          <v-icon class="mr-2">mdi-package-variant</v-icon>
          Images
          <v-chip size="x-small" class="ml-2">{{ containerStore.images.length }}</v-chip>
        </v-tab>
        <v-tab value="networks">
          <v-icon class="mr-2">mdi-lan</v-icon>
          Networks
          <v-chip size="x-small" class="ml-2">{{ containerStore.networks.length }}</v-chip>
        </v-tab>
        <v-tab value="volumes">
          <v-icon class="mr-2">mdi-database</v-icon>
          Volumes
          <v-chip size="x-small" class="ml-2">{{ containerStore.volumes.length }}</v-chip>
        </v-tab>
      </v-tabs>

      <v-tabs-window v-model="activeTab">
        <v-tabs-window-item value="containers">
          <ContainerList
            :containers="containerStore.containers"
            :stats="containerStore.stats"
            :loading="containerStore.loading"
            @start="handleStartContainer"
            @stop="handleStopContainer"
            @remove="handleRemoveContainer"
            @batch-stop="handleBatchStop"
            @batch-remove="handleBatchRemove"
            @fetch-stats="handleFetchStats"
          />
        </v-tabs-window-item>

        <v-tabs-window-item value="images">
          <ImageList
            :images="containerStore.images"
            :loading="containerStore.loading"
            @remove="handleRemoveImage"
          />
        </v-tabs-window-item>

        <v-tabs-window-item value="networks">
          <NetworkList
            :networks="containerStore.networks"
            :loading="containerStore.loading"
          />
        </v-tabs-window-item>

        <v-tabs-window-item value="volumes">
          <VolumeList
            :volumes="containerStore.volumes"
            :loading="containerStore.loading"
          />
        </v-tabs-window-item>
      </v-tabs-window>
    </v-card-text>
  </v-card>

  <ConfirmDialog
    v-model="showStopDialog"
    title="Stop Container"
    :message="`Are you sure you want to stop container ${selectedContainerId}?`"
    confirm-text="Stop"
    color="warning"
    icon="mdi-stop"
    @confirm="confirmStopContainer"
  />

  <ConfirmDialog
    v-model="showRemoveDialog"
    title="Remove Container"
    :message="`Are you sure you want to remove container ${selectedContainerId}? This action cannot be undone.`"
    confirm-text="Remove"
    color="error"
    icon="mdi-delete"
    @confirm="confirmRemoveContainer"
  />

  <ConfirmDialog
    v-model="showBatchStopDialog"
    title="Stop Containers"
    :message="`Are you sure you want to stop ${selectedContainerIds.length} container(s)?`"
    confirm-text="Stop All"
    color="warning"
    icon="mdi-stop"
    @confirm="confirmBatchStop"
  />

  <ConfirmDialog
    v-model="showBatchRemoveDialog"
    title="Remove Containers"
    :message="`Are you sure you want to remove ${selectedContainerIds.length} container(s)? This action cannot be undone.`"
    confirm-text="Remove All"
    color="error"
    icon="mdi-delete"
    @confirm="confirmBatchRemove"
  />

  <ConfirmDialog
    v-model="showRemoveImageDialog"
    title="Remove Image"
    message="Are you sure you want to remove this image? This action cannot be undone."
    confirm-text="Remove"
    color="error"
    icon="mdi-delete"
    @confirm="confirmRemoveImage"
  />

  <ConfirmDialog
    v-model="showCleanupDialog"
    title="Cleanup Orphaned Containers"
    :message="`Are you sure you want to remove ${containerStore.orphanedContainers.length} orphaned container(s)?`"
    confirm-text="Cleanup"
    color="warning"
    icon="mdi-broom"
    @confirm="confirmCleanup"
  />
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useContainerStore } from '@/stores/containerStore'
import ResourceSummaryBar from './ResourceSummaryBar.vue'
import ContainerList from './ContainerList.vue'
import ImageList from './ImageList.vue'
import NetworkList from './NetworkList.vue'
import VolumeList from './VolumeList.vue'
import ConfirmDialog from './ConfirmDialog.vue'

const props = defineProps<{
  projectId: string
  projectName: string
}>()

const containerStore = useContainerStore()

const activeTab = ref('containers')
const selectedContainerId = ref('')
const selectedContainerIds = ref<string[]>([])
const selectedImageId = ref('')

const showStopDialog = ref(false)
const showRemoveDialog = ref(false)
const showBatchStopDialog = ref(false)
const showBatchRemoveDialog = ref(false)
const showRemoveImageDialog = ref(false)
const showCleanupDialog = ref(false)

onMounted(() => {
  refresh()
})

async function refresh() {
  await containerStore.fetchAll(props.projectId, props.projectName)
}

function handleStartContainer(id: string) {
  containerStore.startContainer(id)
}

function handleStopContainer(id: string) {
  selectedContainerId.value = id
  showStopDialog.value = true
}

function handleRemoveContainer(id: string) {
  selectedContainerId.value = id
  showRemoveDialog.value = true
}

function handleBatchStop(ids: string[]) {
  selectedContainerIds.value = ids
  showBatchStopDialog.value = true
}

function handleBatchRemove(ids: string[]) {
  selectedContainerIds.value = ids
  showBatchRemoveDialog.value = true
}

function handleFetchStats(id: string) {
  containerStore.fetchContainerStats(id)
}

function handleRemoveImage(id: string) {
  selectedImageId.value = id
  showRemoveImageDialog.value = true
}

async function confirmStopContainer() {
  await containerStore.stopContainer(selectedContainerId.value)
  showStopDialog.value = false
  await refresh()
}

async function confirmRemoveContainer() {
  await containerStore.removeContainer(selectedContainerId.value)
  showRemoveDialog.value = false
  await refresh()
}

async function confirmBatchStop() {
  await containerStore.batchStopContainers(selectedContainerIds.value)
  showBatchStopDialog.value = false
  selectedContainerIds.value = []
  await refresh()
}

async function confirmBatchRemove() {
  await containerStore.batchRemoveContainers(selectedContainerIds.value)
  showBatchRemoveDialog.value = false
  selectedContainerIds.value = []
  await refresh()
}

async function confirmRemoveImage() {
  await containerStore.removeImage(selectedImageId.value)
  showRemoveImageDialog.value = false
  await refresh()
}

async function confirmCleanup() {
  await containerStore.cleanupOrphans(props.projectId)
  showCleanupDialog.value = false
  await refresh()
}
</script>

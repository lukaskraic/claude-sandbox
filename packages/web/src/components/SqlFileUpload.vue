<template>
  <div class="sql-file-upload">
    <v-row align="center">
      <v-col cols="8">
        <v-text-field
          :model-value="modelValue"
          label="Init SQL File"
          hint="Path to SQL file (upload or use from project)"
          density="compact"
          placeholder="uploads/project-id/schema.sql"
          prepend-inner-icon="mdi-file-document-outline"
          readonly
          @click="showFileDialog = true"
        >
          <template #append-inner>
            <v-btn
              v-if="modelValue"
              icon="mdi-close"
              size="x-small"
              variant="text"
              @click.stop="clearFile"
            />
          </template>
        </v-text-field>
      </v-col>
      <v-col cols="4">
        <v-btn
          prepend-icon="mdi-upload"
          variant="outlined"
          size="small"
          :loading="uploading"
          @click="triggerUpload"
        >
          Upload SQL
        </v-btn>
        <input
          ref="fileInput"
          type="file"
          accept=".sql,.dump,.bak,.gz"
          style="display: none;"
          @change="handleFileSelect"
        >
      </v-col>
    </v-row>

    <!-- Upload progress -->
    <v-progress-linear
      v-if="uploading"
      :model-value="uploadProgress"
      color="primary"
      class="mt-2"
    />

    <!-- Uploaded files dialog -->
    <v-dialog v-model="showFileDialog" max-width="600">
      <v-card>
        <v-card-title>Select SQL File</v-card-title>
        <v-card-text>
          <v-list v-if="uploadedFiles.length > 0">
            <v-list-item
              v-for="file in uploadedFiles"
              :key="file.filename"
              :title="file.filename"
              :subtitle="formatSize(file.size)"
              @click="selectFile(file)"
            >
              <template #prepend>
                <v-icon>mdi-file-document</v-icon>
              </template>
              <template #append>
                <v-btn
                  icon="mdi-delete"
                  size="small"
                  variant="text"
                  color="error"
                  @click.stop="deleteFile(file.filename)"
                />
              </template>
            </v-list-item>
          </v-list>
          <v-alert v-else type="info" density="compact">
            No SQL files uploaded yet. Use the upload button to add files.
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="showFileDialog = false">Cancel</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Error snackbar -->
    <v-snackbar v-model="showError" color="error" timeout="5000">
      {{ errorMessage }}
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const props = defineProps<{
  modelValue: string | undefined
  projectId: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | undefined]
}>()

interface UploadedFile {
  filename: string
  path: string
  size: number
  modified: string
}

const fileInput = ref<HTMLInputElement>()
const uploading = ref(false)
const uploadProgress = ref(0)
const showFileDialog = ref(false)
const uploadedFiles = ref<UploadedFile[]>([])
const showError = ref(false)
const errorMessage = ref('')

onMounted(() => {
  loadUploadedFiles()
})

async function loadUploadedFiles() {
  try {
    const response = await fetch(`/api/upload/projects/${props.projectId}/files`)
    if (response.ok) {
      uploadedFiles.value = await response.json()
    }
  } catch (error) {
    console.error('Failed to load uploaded files:', error)
  }
}

function triggerUpload() {
  fileInput.value?.click()
}

async function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  uploading.value = true
  uploadProgress.value = 0

  try {
    const formData = new FormData()
    formData.append('file', file)

    const xhr = new XMLHttpRequest()

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        uploadProgress.value = Math.round((e.loaded / e.total) * 100)
      }
    })

    await new Promise<void>((resolve, reject) => {
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve()
        } else {
          reject(new Error(xhr.responseText || 'Upload failed'))
        }
      }
      xhr.onerror = () => reject(new Error('Network error'))

      xhr.open('POST', `/api/upload/projects/${props.projectId}/sql`)
      xhr.send(formData)
    })

    const result = JSON.parse(xhr.responseText)
    emit('update:modelValue', result.path)
    await loadUploadedFiles()

  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Upload failed'
    showError.value = true
  } finally {
    uploading.value = false
    uploadProgress.value = 0
    if (input) input.value = ''
  }
}

function selectFile(file: UploadedFile) {
  emit('update:modelValue', file.path)
  showFileDialog.value = false
}

function clearFile() {
  emit('update:modelValue', undefined)
}

async function deleteFile(filename: string) {
  try {
    const response = await fetch(`/api/upload/projects/${props.projectId}/files/${filename}`, {
      method: 'DELETE'
    })
    if (response.ok) {
      await loadUploadedFiles()
      if (props.modelValue?.includes(filename)) {
        emit('update:modelValue', undefined)
      }
    }
  } catch (error) {
    errorMessage.value = 'Failed to delete file'
    showError.value = true
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}
</script>

<style scoped>
.sql-file-upload {
  width: 100%;
}
</style>

<template>
  <v-dialog v-model="model" max-width="400" persistent>
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon v-if="icon" :color="color" class="mr-2">{{ icon }}</v-icon>
        {{ title }}
      </v-card-title>
      <v-card-text>
        {{ message }}
        <slot />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="cancel">{{ cancelText }}</v-btn>
        <v-btn :color="color" :loading="loading" @click="confirm">{{ confirmText }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'

withDefaults(defineProps<{
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  color?: string
  icon?: string
}>(), {
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  color: 'primary',
  icon: '',
})

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

const model = defineModel<boolean>({ default: false })
const loading = ref(false)

function cancel() {
  model.value = false
  emit('cancel')
}

function confirm() {
  emit('confirm')
}

defineExpose({ loading })
</script>

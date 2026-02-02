<template>
  <div>
    <v-list-item
      density="compact"
      :style="{ paddingLeft: `${depth * 16 + 8}px` }"
      :class="{ 'v-list-item--active': selectedPath === item.path }"
      @click="handleClick"
    >
      <template v-slot:prepend>
        <v-icon size="small">
          {{ item.isDirectory ? (item.expanded ? 'mdi-folder-open' : 'mdi-folder') : fileIcon }}
        </v-icon>
      </template>
      <v-list-item-title class="text-body-2">{{ item.name }}</v-list-item-title>
    </v-list-item>

    <template v-if="item.isDirectory && item.expanded && item.children">
      <FileTreeNode
        v-for="child in item.children"
        :key="child.path"
        :item="child"
        :selected-path="selectedPath"
        :depth="depth + 1"
        @select="$emit('select', $event)"
        @toggle="$emit('toggle', $event)"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface TreeItem {
  name: string
  path: string
  isDirectory: boolean
  children?: TreeItem[]
  loaded?: boolean
  expanded?: boolean
}

const props = defineProps<{
  item: TreeItem
  selectedPath: string
  depth: number
}>()

const emit = defineEmits<{
  select: [item: TreeItem]
  toggle: [item: TreeItem]
}>()

const fileIcon = computed(() => {
  const name = props.item.name
  const ext = name.split('.').pop()?.toLowerCase() || ''
  const icons: Record<string, string> = {
    ts: 'mdi-language-typescript',
    tsx: 'mdi-language-typescript',
    js: 'mdi-language-javascript',
    jsx: 'mdi-language-javascript',
    vue: 'mdi-vuejs',
    json: 'mdi-code-json',
    md: 'mdi-language-markdown',
    html: 'mdi-language-html5',
    css: 'mdi-language-css3',
    scss: 'mdi-sass',
    py: 'mdi-language-python',
    java: 'mdi-language-java',
    sh: 'mdi-console',
    yml: 'mdi-file-cog',
    yaml: 'mdi-file-cog',
    dockerfile: 'mdi-docker',
    gitignore: 'mdi-git',
    lock: 'mdi-lock',
  }

  if (name.toLowerCase() === 'dockerfile') return 'mdi-docker'
  if (name.toLowerCase() === 'makefile') return 'mdi-cog'
  if (name.startsWith('.')) return 'mdi-file-hidden'

  return icons[ext] || 'mdi-file-document-outline'
})

function handleClick() {
  if (props.item.isDirectory) {
    emit('toggle', props.item)
  } else {
    emit('select', props.item)
  }
}
</script>

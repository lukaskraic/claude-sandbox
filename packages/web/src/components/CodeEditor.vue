<template>
  <div class="code-editor">
    <div class="editor-toolbar">
      <span class="filename">{{ filename }}</span>
      <v-spacer />
      <v-btn
        v-if="modified"
        size="small"
        color="primary"
        :loading="saving"
        @click="save"
      >
        Save
      </v-btn>
      <v-chip v-if="modified" size="x-small" color="warning" class="ml-2">Modified</v-chip>
    </div>
    <Codemirror
      v-model="code"
      :style="{ height: 'calc(100% - 40px)' }"
      :autofocus="false"
      :indent-with-tab="true"
      :tab-size="2"
      :extensions="extensions"
      @change="onCodeChange"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, shallowRef } from 'vue'
import { Codemirror } from 'vue-codemirror'
import { oneDark } from '@codemirror/theme-one-dark'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { html } from '@codemirror/lang-html'
import { css } from '@codemirror/lang-css'
import { python } from '@codemirror/lang-python'
import { java } from '@codemirror/lang-java'
import { markdown } from '@codemirror/lang-markdown'
import { xml } from '@codemirror/lang-xml'
import { sql } from '@codemirror/lang-sql'
import { rust } from '@codemirror/lang-rust'
import { cpp } from '@codemirror/lang-cpp'
import { go } from '@codemirror/lang-go'
import { php } from '@codemirror/lang-php'
import { EditorView } from '@codemirror/view'

const props = defineProps<{
  content: string
  filename: string
}>()

const emit = defineEmits<{
  save: [content: string]
}>()

const code = ref(props.content)
const originalContent = ref(props.content)
const saving = ref(false)

const modified = computed(() => code.value !== originalContent.value)

const extension = computed(() => {
  const name = props.filename.split('/').pop() || ''
  return name.split('.').pop()?.toLowerCase() || ''
})

const languageExtension = computed(() => {
  const ext = extension.value
  const filename = props.filename.split('/').pop()?.toLowerCase() || ''

  const langMap: Record<string, () => ReturnType<typeof javascript>> = {
    js: javascript,
    jsx: () => javascript({ jsx: true }),
    ts: () => javascript({ typescript: true }),
    tsx: () => javascript({ jsx: true, typescript: true }),
    json: json,
    html: html,
    htm: html,
    vue: html,
    css: css,
    scss: css,
    less: css,
    py: python,
    java: java,
    md: markdown,
    xml: xml,
    svg: xml,
    sql: sql,
    rs: rust,
    c: cpp,
    cpp: cpp,
    h: cpp,
    hpp: cpp,
    go: go,
    php: php,
  }

  if (filename === 'dockerfile') return null
  if (filename === 'makefile') return null

  const langFn = langMap[ext]
  return langFn ? langFn() : null
})

const extensions = computed(() => {
  const exts = [
    oneDark,
    EditorView.theme({
      '&': {
        fontSize: '14px',
        fontFamily: "'Fira Code', 'Monaco', 'Consolas', monospace",
      },
      '.cm-content': {
        padding: '10px 0',
      },
      '.cm-gutters': {
        backgroundColor: '#1e1e1e',
        borderRight: '1px solid #333',
      },
      '.cm-activeLineGutter': {
        backgroundColor: '#2a2a2a',
      },
    }),
    EditorView.lineWrapping,
  ]

  if (languageExtension.value) {
    exts.push(languageExtension.value)
  }

  return exts
})

watch(() => props.content, (newContent) => {
  code.value = newContent
  originalContent.value = newContent
})

watch(() => props.filename, () => {
  originalContent.value = props.content
})

function onCodeChange(value: string) {
  code.value = value
}

async function save() {
  saving.value = true
  try {
    emit('save', code.value)
    originalContent.value = code.value
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.code-editor {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #1e1e1e;
}

.editor-toolbar {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: #252526;
  border-bottom: 1px solid #333;
}

.filename {
  font-family: 'Fira Code', monospace;
  font-size: 13px;
  color: #ccc;
}
</style>

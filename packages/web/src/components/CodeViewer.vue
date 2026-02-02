<template>
  <div class="code-viewer">
    <div v-if="loading" class="d-flex justify-center align-center pa-4">
      <v-progress-circular indeterminate size="24" />
    </div>
    <div v-else-if="isMarkdown" class="markdown-content pa-4" v-html="renderedMarkdown"></div>
    <div v-else-if="highlightedCode" class="code-content" v-html="highlightedCode"></div>
    <pre v-else class="code-fallback pa-4">{{ content }}</pre>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { codeToHtml } from 'shiki'
import { marked } from 'marked'

const props = defineProps<{
  content: string
  filename: string
}>()

const highlightedCode = ref('')
const loading = ref(false)

const extension = computed(() => {
  const name = props.filename.split('/').pop() || ''
  return name.split('.').pop()?.toLowerCase() || ''
})

const isMarkdown = computed(() => extension.value === 'md' || extension.value === 'markdown')

const language = computed(() => {
  const ext = extension.value
  const langMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'tsx',
    js: 'javascript',
    jsx: 'jsx',
    vue: 'vue',
    json: 'json',
    md: 'markdown',
    html: 'html',
    css: 'css',
    scss: 'scss',
    less: 'less',
    py: 'python',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    h: 'c',
    hpp: 'cpp',
    go: 'go',
    rs: 'rust',
    rb: 'ruby',
    php: 'php',
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
    yml: 'yaml',
    yaml: 'yaml',
    toml: 'toml',
    xml: 'xml',
    svg: 'xml',
    sql: 'sql',
    graphql: 'graphql',
    dockerfile: 'dockerfile',
    makefile: 'makefile',
    gitignore: 'text',
    env: 'text',
  }

  const filename = props.filename.split('/').pop()?.toLowerCase() || ''
  if (filename === 'dockerfile') return 'dockerfile'
  if (filename === 'makefile') return 'makefile'

  return langMap[ext] || 'text'
})

const renderedMarkdown = computed(() => {
  if (!isMarkdown.value) return ''
  try {
    return marked.parse(props.content, { async: false }) as string
  } catch (err) {
    console.error('Markdown parse error:', err)
    return `<pre>${props.content}</pre>`
  }
})

async function highlight() {
  if (isMarkdown.value || !props.content) {
    highlightedCode.value = ''
    return
  }

  loading.value = true
  try {
    const html = await codeToHtml(props.content, {
      lang: language.value,
      theme: 'github-dark',
    })
    highlightedCode.value = html
  } catch (err) {
    console.error('Highlight error:', err)
    highlightedCode.value = ''
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  highlight()
})

watch(() => props.content, () => {
  highlight()
})

watch(() => props.filename, () => {
  highlight()
})
</script>

<style scoped>
.code-viewer {
  height: 100%;
  overflow: auto;
}

.code-content :deep(pre) {
  margin: 0;
  padding: 16px;
  overflow-x: auto;
  font-family: 'Fira Code', 'Monaco', 'Consolas', monospace;
  font-size: 13px;
  line-height: 1.5;
}

.code-content :deep(code) {
  font-family: inherit;
}

.code-fallback {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
  font-family: 'Fira Code', 'Monaco', 'Consolas', monospace;
  font-size: 13px;
  line-height: 1.5;
  background: #1e1e1e;
  color: #d4d4d4;
}

.markdown-content {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.7;
  color: #e0e0e0;
  max-width: 900px;
}

.markdown-content :deep(h1) {
  font-size: 2em;
  font-weight: 600;
  margin: 0.67em 0 0.5em;
  padding-bottom: 0.3em;
  border-bottom: 1px solid #444;
}

.markdown-content :deep(h2) {
  font-size: 1.5em;
  font-weight: 600;
  margin: 1em 0 0.5em;
  padding-bottom: 0.3em;
  border-bottom: 1px solid #444;
}

.markdown-content :deep(h3) {
  font-size: 1.25em;
  font-weight: 600;
  margin: 1em 0 0.5em;
}

.markdown-content :deep(h4),
.markdown-content :deep(h5),
.markdown-content :deep(h6) {
  font-weight: 600;
  margin: 1em 0 0.5em;
}

.markdown-content :deep(p) {
  margin: 0 0 1em;
}

.markdown-content :deep(code) {
  background: #2d2d2d;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Fira Code', monospace;
  font-size: 0.9em;
}

.markdown-content :deep(pre) {
  background: #1e1e1e;
  padding: 16px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 0 0 1em;
}

.markdown-content :deep(pre code) {
  background: none;
  padding: 0;
  font-size: 13px;
  line-height: 1.5;
}

.markdown-content :deep(ul),
.markdown-content :deep(ol) {
  padding-left: 2em;
  margin: 0 0 1em;
}

.markdown-content :deep(li) {
  margin: 0.25em 0;
}

.markdown-content :deep(li > ul),
.markdown-content :deep(li > ol) {
  margin: 0.25em 0;
}

.markdown-content :deep(blockquote) {
  margin: 0 0 1em;
  padding: 0.5em 1em;
  border-left: 4px solid #444;
  background: rgba(255, 255, 255, 0.05);
  color: #aaa;
}

.markdown-content :deep(blockquote p:last-child) {
  margin-bottom: 0;
}

.markdown-content :deep(a) {
  color: #58a6ff;
  text-decoration: none;
}

.markdown-content :deep(a:hover) {
  text-decoration: underline;
}

.markdown-content :deep(strong) {
  font-weight: 600;
}

.markdown-content :deep(em) {
  font-style: italic;
}

.markdown-content :deep(hr) {
  border: none;
  border-top: 1px solid #444;
  margin: 2em 0;
}

.markdown-content :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 0 0 1em;
}

.markdown-content :deep(th),
.markdown-content :deep(td) {
  padding: 8px 12px;
  border: 1px solid #444;
  text-align: left;
}

.markdown-content :deep(th) {
  background: rgba(255, 255, 255, 0.05);
  font-weight: 600;
}

.markdown-content :deep(tr:nth-child(even)) {
  background: rgba(255, 255, 255, 0.02);
}

.markdown-content :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
}

.markdown-content :deep(input[type="checkbox"]) {
  margin-right: 0.5em;
}
</style>

<template>
  <div ref="terminalContainer" class="terminal-container" />
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'

const props = defineProps<{
  sessionId: string
  active: boolean
}>()

const terminalContainer = ref<HTMLElement>()
let terminal: Terminal | null = null
let fitAddon: FitAddon | null = null
let ws: WebSocket | null = null

onMounted(() => {
  if (!terminalContainer.value) return

  terminal = new Terminal({
    cursorBlink: true,
    fontSize: 14,
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    theme: {
      background: '#1e1e1e',
      foreground: '#d4d4d4',
    },
  })

  fitAddon = new FitAddon()
  terminal.loadAddon(fitAddon)
  terminal.open(terminalContainer.value)
  fitAddon.fit()

  if (props.active) {
    connect()
  }

  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  disconnect()
  terminal?.dispose()
})

watch(() => props.active, (active) => {
  if (active) {
    connect()
  } else {
    disconnect()
  }
})

watch(() => props.sessionId, () => {
  disconnect()
  if (props.active) {
    connect()
  }
})

function connect() {
  if (ws) return

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  ws = new WebSocket(`${protocol}//${window.location.host}/ws?session=${props.sessionId}`)

  ws.onopen = () => {
    terminal?.writeln('Connected to session...')
  }

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data)
    if (message.type === 'output') {
      terminal?.write(message.data)
    } else if (message.type === 'connected') {
      terminal?.clear()
      sendResize()
    } else if (message.type === 'error') {
      terminal?.writeln(`\r\nError: ${message.message}`)
    } else if (message.type === 'exit') {
      terminal?.writeln('\r\nSession ended.')
    }
  }

  ws.onclose = () => {
    terminal?.writeln('\r\nDisconnected.')
    ws = null
  }

  ws.onerror = () => {
    terminal?.writeln('\r\nConnection error.')
  }

  terminal?.onData((data) => {
    ws?.send(JSON.stringify({ type: 'input', data }))
  })
}

function disconnect() {
  ws?.close()
  ws = null
}

function sendResize() {
  if (ws && terminal) {
    ws.send(JSON.stringify({
      type: 'resize',
      cols: terminal.cols,
      rows: terminal.rows,
    }))
  }
}

function handleResize() {
  fitAddon?.fit()
  sendResize()
}
</script>

<style scoped>
.terminal-container {
  height: 100%;
  min-height: 400px;
  background: #1e1e1e;
  padding: 4px;
}
</style>

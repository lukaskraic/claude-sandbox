<template>
  <div class="terminal-wrapper">
    <div v-if="connectionStatus !== 'connected'" class="connection-status" :class="connectionStatus">
      <v-icon v-if="connectionStatus === 'connecting'" class="mdi-spin">mdi-loading</v-icon>
      <v-icon v-else-if="connectionStatus === 'reconnecting'" class="mdi-spin">mdi-refresh</v-icon>
      <v-icon v-else-if="connectionStatus === 'disconnected'">mdi-lan-disconnect</v-icon>
      <span class="ml-2">
        {{ connectionStatus === 'connecting' ? 'Connecting...' :
           connectionStatus === 'reconnecting' ? `Reconnecting (${reconnectAttempts})...` :
           'Disconnected' }}
      </span>
      <v-btn
        v-if="connectionStatus === 'disconnected'"
        size="small"
        variant="tonal"
        color="white"
        class="ml-4"
        @click="manualReconnect"
      >
        Reconnect
      </v-btn>
    </div>
    <div ref="terminalContainer" class="terminal-container" tabindex="0" @contextmenu.prevent />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'
import 'xterm/css/xterm.css'

const props = defineProps<{
  sessionId: string
  active: boolean
}>()

const terminalContainer = ref<HTMLElement>()
const connectionStatus = ref<'disconnected' | 'connecting' | 'connected' | 'reconnecting'>('disconnected')
const reconnectAttempts = ref(0)

let terminal: Terminal | null = null
let fitAddon: FitAddon | null = null
let ws: WebSocket | null = null
let heartbeatInterval: ReturnType<typeof setInterval> | null = null
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null
let resizeTimeout: ReturnType<typeof setTimeout> | null = null
let lastPong = Date.now()
let dataHandler: { dispose: () => void } | null = null
let resizeObserver: ResizeObserver | null = null

const PING_INTERVAL = 20000 // 20 seconds
const PONG_TIMEOUT = 10000 // 10 seconds
const MAX_RECONNECT_ATTEMPTS = 15
const BASE_RECONNECT_DELAY = 1000

const isUploadingImage = ref(false)

onMounted(() => {
  if (!terminalContainer.value) return

  terminal = new Terminal({
    cursorBlink: true,
    cursorStyle: 'block',
    fontSize: 14,
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    scrollback: 10000,
    scrollSensitivity: 1,
    fastScrollSensitivity: 3,
    fastScrollModifier: 'shift',
    smoothScrollDuration: 0,
    theme: {
      background: '#1e1e1e',
      foreground: '#d4d4d4',
      cursor: '#ffffff',
      cursorAccent: '#1e1e1e',
      selectionBackground: '#264f78',
    },
    allowProposedApi: true,
  })

  fitAddon = new FitAddon()
  terminal.loadAddon(fitAddon)
  terminal.loadAddon(new WebLinksAddon())

  // OSC 52 clipboard handler with proper UTF-8 support
  terminal.parser.registerOscHandler(52, (data) => {
    const parts = data.split(';')
    if (parts.length >= 2) {
      const base64 = parts[1]
      if (base64 && base64 !== '?') {
        try {
          // Decode base64 to UTF-8 properly
          const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
          const text = new TextDecoder('utf-8').decode(bytes)
          navigator.clipboard.writeText(text).catch(() => {})
        } catch (e) {
          console.error('Clipboard error:', e)
        }
      }
    }
    return true
  })

  terminal.open(terminalContainer.value)
  fitAddon.fit()
  terminal.focus()

  // Setup clipboard handling
  setupClipboard()

  if (props.active) {
    connect()
  }

  // Use ResizeObserver for more reliable size detection
  resizeObserver = new ResizeObserver(() => {
    handleResize()
  })
  resizeObserver.observe(terminalContainer.value)

  // Manual wheel handler to ensure scrolling works
  terminalContainer.value.addEventListener('wheel', handleWheel, { passive: false })

  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  terminalContainer.value?.removeEventListener('wheel', handleWheel)
  resizeObserver?.disconnect()
  cleanup()
  terminal?.dispose()
})

watch(() => props.active, (active) => {
  if (active) {
    if (connectionStatus.value === 'disconnected') {
      connect()
    }
    // Refocus terminal when tab becomes active
    terminal?.focus()
    // Refit in case size changed while inactive
    setTimeout(() => {
      fitAddon?.fit()
      sendResize()
    }, 100)
  }
  // Don't disconnect when switching tabs - keep WebSocket alive
  // This preserves the shell session
})

watch(() => props.sessionId, () => {
  cleanup()
  if (props.active) {
    connect()
  }
})

async function handlePaste() {
  try {
    // Try to read clipboard items (supports images)
    const clipboardItems = await navigator.clipboard.read()

    for (const item of clipboardItems) {
      // Check for image types first
      const imageType = item.types.find(t => t.startsWith('image/'))
      if (imageType) {
        const blob = await item.getType(imageType)
        const file = new File([blob], `screenshot-${Date.now()}.png`, { type: imageType })
        const imagePath = await uploadImage(file)
        if (imagePath) {
          sendInput(imagePath)
        }
        return
      }

      // Fall back to text
      if (item.types.includes('text/plain')) {
        const blob = await item.getType('text/plain')
        const text = await blob.text()
        sendInput(text)
        return
      }
    }
  } catch {
    // Fallback to readText if read() is not supported or fails
    try {
      const text = await navigator.clipboard.readText()
      sendInput(text)
    } catch {
      // Clipboard access denied
    }
  }
}

async function uploadImage(file: File): Promise<string | null> {
  const formData = new FormData()
  formData.append('image', file)

  try {
    isUploadingImage.value = true
    terminal?.writeln('\r\n\x1B[33mUploading image...\x1B[0m')

    const response = await fetch(`/api/upload/sessions/${props.sessionId}/image`, {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Upload failed')
    }

    const result = await response.json()
    terminal?.writeln(`\x1B[32mImage saved: ${result.path}\x1B[0m\r\n`)
    return result.path
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed'
    terminal?.writeln(`\x1B[31mImage upload failed: ${message}\x1B[0m\r\n`)
    return null
  } finally {
    isUploadingImage.value = false
  }
}

function setupClipboard() {
  if (!terminal || !terminalContainer.value) return

  // Handle paste event - prevent default to avoid double paste
  // Text paste is handled by keydown handler (Cmd+V / Ctrl+V)
  // This handler only processes images
  terminalContainer.value.addEventListener('paste', async (event: ClipboardEvent) => {
    event.preventDefault() // Always prevent default to avoid double paste

    const items = event.clipboardData?.items
    if (!items) return

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) {
          const imagePath = await uploadImage(file)
          if (imagePath) {
            sendInput(imagePath)
          }
        }
        return
      }
    }

    // For text paste, let the keydown handler deal with it
    // (this event fires after keydown, so handlePaste was already called)
  })

  // Auto-copy selection to clipboard on mouse up
  let copyTimeout: ReturnType<typeof setTimeout> | null = null
  terminal.onSelectionChange(() => {
    // Debounce to avoid copying during active selection
    if (copyTimeout) clearTimeout(copyTimeout)
    copyTimeout = setTimeout(() => {
      const selection = terminal!.getSelection()
      if (selection && selection.length > 0) {
        navigator.clipboard.writeText(selection).catch(() => {
          // Clipboard access may fail in some contexts
        })
      }
    }, 100)
  })

  terminal.attachCustomKeyEventHandler((event) => {
    // Ctrl+Shift+C for copy
    if (event.ctrlKey && event.shiftKey && event.key === 'C') {
      const selection = terminal!.getSelection()
      if (selection) {
        navigator.clipboard.writeText(selection)
      }
      return false
    }
    // Ctrl+Shift+V or Ctrl+V for paste (handles both text and images)
    if ((event.ctrlKey && event.shiftKey && event.key === 'V') ||
        (event.ctrlKey && !event.shiftKey && event.key === 'v') ||
        (event.metaKey && event.key === 'v')) {
      handlePaste()
      return false
    }
    return true
  })
}

function connect() {
  if (ws && ws.readyState === WebSocket.OPEN) return

  connectionStatus.value = reconnectAttempts.value > 0 ? 'reconnecting' : 'connecting'

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  ws = new WebSocket(`${protocol}//${window.location.host}/ws?session=${props.sessionId}`)

  ws.onopen = () => {
    connectionStatus.value = 'connected'
    reconnectAttempts.value = 0
    lastPong = Date.now()
    startHeartbeat()

    // Setup input handler
    if (dataHandler) {
      dataHandler.dispose()
    }
    dataHandler = terminal!.onData((data) => {
      sendInput(data)
    })
  }

  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data)

      switch (message.type) {
        case 'output':
          terminal?.write(message.data)
          break
        case 'connected':
          // Don't clear terminal - preserve history on reconnect
          sendResize()
          break
        case 'pong':
          lastPong = Date.now()
          break
        case 'error':
          terminal?.writeln(`\r\n\x1B[31mError: ${message.message}\x1B[0m`)
          break
        case 'exit':
          terminal?.writeln('\r\n\x1B[33mSession ended.\x1B[0m')
          break
      }
    } catch {
      // Plain text data - write directly
      terminal?.write(event.data)
    }
  }

  ws.onclose = (event) => {
    stopHeartbeat()
    ws = null

    if (props.active && !event.wasClean) {
      connectionStatus.value = 'reconnecting'
      scheduleReconnect()
    } else {
      connectionStatus.value = 'disconnected'
      if (event.wasClean) {
        terminal?.writeln('\r\n\x1B[33mConnection closed.\x1B[0m')
      }
    }
  }

  ws.onerror = () => {
    terminal?.writeln('\r\n\x1B[31mConnection error.\x1B[0m')
  }
}

function disconnect() {
  cleanup()
  connectionStatus.value = 'disconnected'
}

function manualReconnect() {
  cleanup()
  reconnectAttempts.value = 0
  connect()
}

function cleanup() {
  stopHeartbeat()

  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout)
    reconnectTimeout = null
  }

  if (dataHandler) {
    dataHandler.dispose()
    dataHandler = null
  }

  if (ws) {
    ws.close()
    ws = null
  }

  reconnectAttempts.value = 0
}

function sendInput(data: string) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'input', data }))
  }
}

function sendResize() {
  if (ws?.readyState === WebSocket.OPEN && terminal) {
    ws.send(JSON.stringify({
      type: 'resize',
      cols: terminal.cols,
      rows: terminal.rows,
    }))
  }
}

function startHeartbeat() {
  stopHeartbeat()
  lastPong = Date.now()

  heartbeatInterval = setInterval(() => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return
    }

    // Check if we missed pong response
    if (Date.now() - lastPong > PING_INTERVAL + PONG_TIMEOUT) {
      console.warn('Heartbeat timeout, reconnecting...')
      ws.close()
      return
    }

    // Send ping
    ws.send(JSON.stringify({ type: 'ping' }))
  }, PING_INTERVAL)
}

function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval)
    heartbeatInterval = null
  }
}

function scheduleReconnect() {
  if (reconnectAttempts.value >= MAX_RECONNECT_ATTEMPTS) {
    terminal?.writeln('\r\n\x1B[31mMax reconnection attempts reached. Click to reconnect.\x1B[0m')
    connectionStatus.value = 'disconnected'
    return
  }

  // Exponential backoff with jitter
  const delay = Math.min(
    BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempts.value) + Math.random() * 1000,
    30000
  )

  reconnectAttempts.value++

  reconnectTimeout = setTimeout(() => {
    if (props.active) {
      connect()
    }
  }, delay)
}

function handleResize() {
  // Debounce resize events
  if (resizeTimeout) {
    clearTimeout(resizeTimeout)
  }

  resizeTimeout = setTimeout(() => {
    fitAddon?.fit()
    sendResize()
  }, 100)
}

// Mouse wheel is now handled by tmux with 'set -g mouse on'
// This handler prevents page scroll when hovering over terminal
function handleWheel(event: WheelEvent) {
  // Just prevent default to stop page scrolling
  // tmux handles the actual terminal scrolling
  event.preventDefault()
}

// Expose sendInput for parent components
defineExpose({
  sendInput,
})

</script>

<style scoped>
.terminal-wrapper {
  height: 100%;
  position: relative;
  display: flex;
  flex-direction: column;
  overscroll-behavior: contain;
}

.connection-status {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  font-size: 12px;
  color: #fff;
}

.connection-status.connecting,
.connection-status.reconnecting {
  background: #1565c0;
}

.connection-status.disconnected {
  background: #c62828;
}

.terminal-container {
  flex: 1;
  min-height: 0;
  background: #1e1e1e;
  padding: 4px;
  overflow: hidden;
  touch-action: none;
}

.terminal-container :deep(.xterm) {
  height: 100%;
  width: 100%;
}

.terminal-container :deep(.xterm-viewport) {
  overflow-y: auto !important;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: #555 #1e1e1e;
}

.terminal-container :deep(.xterm-viewport::-webkit-scrollbar) {
  width: 10px;
}

.terminal-container :deep(.xterm-viewport::-webkit-scrollbar-track) {
  background: #1e1e1e;
}

.terminal-container :deep(.xterm-viewport::-webkit-scrollbar-thumb) {
  background: #555;
  border-radius: 5px;
}

.terminal-container :deep(.xterm-viewport::-webkit-scrollbar-thumb:hover) {
  background: #777;
}

.terminal-container :deep(.xterm-screen) {
  height: 100%;
}
</style>

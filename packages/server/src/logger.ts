type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const levels: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

class Logger {
  private level: LogLevel = 'info'

  setLevel(level: LogLevel) {
    this.level = level
  }

  private log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
    if (levels[level] >= levels[this.level]) {
      const timestamp = new Date().toISOString()
      const metaStr = meta ? ` ${JSON.stringify(meta)}` : ''
      console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`)
    }
  }

  debug(message: string, meta?: Record<string, unknown>) {
    this.log('debug', message, meta)
  }

  info(message: string, meta?: Record<string, unknown>) {
    this.log('info', message, meta)
  }

  warn(message: string, meta?: Record<string, unknown>) {
    this.log('warn', message, meta)
  }

  error(message: string, meta?: Record<string, unknown>) {
    this.log('error', message, meta)
  }
}

export const logger = new Logger()

import Database from 'better-sqlite3'
import { schema } from './schema.js'
import { logger } from '../logger.js'

let db: Database.Database | null = null

export function getDatabase(dbPath: string): Database.Database {
  if (!db) {
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    db.exec(schema)
    logger.info('Database initialized', { path: dbPath })
  }
  return db
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
    logger.info('Database closed')
  }
}

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

    // Migrations for existing databases
    try {
      db.exec('ALTER TABLE sessions ADD COLUMN claude_source_user TEXT')
      logger.info('Migration: added claude_source_user column')
    } catch {
      // Column already exists
    }

    try {
      db.exec('ALTER TABLE sessions ADD COLUMN worktree_base_branch TEXT')
      logger.info('Migration: added worktree_base_branch column')
    } catch {
      // Column already exists
    }

    try {
      db.exec('ALTER TABLE sessions ADD COLUMN service_containers TEXT')
      logger.info('Migration: added service_containers column')
    } catch {
      // Column already exists
    }

    try {
      db.exec('ALTER TABLE sessions ADD COLUMN network_id TEXT')
      logger.info('Migration: added network_id column')
    } catch {
      // Column already exists
    }

    try {
      db.exec('ALTER TABLE sessions ADD COLUMN git_user_name TEXT')
      logger.info('Migration: added git_user_name column')
    } catch {
      // Column already exists
    }

    try {
      db.exec('ALTER TABLE sessions ADD COLUMN git_user_email TEXT')
      logger.info('Migration: added git_user_email column')
    } catch {
      // Column already exists
    }

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

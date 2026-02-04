import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { readdir, readFile, writeFile, rm, stat, mkdir } from 'fs/promises'
import { join, resolve, dirname } from 'path'
import { realpathSync, existsSync } from 'fs'
import { t, protectedProcedure } from '../trpc.js'

/**
 * Validates that the path doesn't contain dangerous characters.
 * Prevents null byte injection and other path manipulation attempts.
 */
function validatePathFormat(path: string): void {
  if (path.includes('\0')) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Invalid path format',
    })
  }
}

/**
 * Validates that the requested path is within the worktree directory.
 * Prevents directory traversal attacks and symlink attacks.
 */
function validatePath(worktreePath: string, requestedPath: string, requireExists = true): string {
  validatePathFormat(requestedPath)

  const fullPath = resolve(join(worktreePath, requestedPath))

  // Resolve symlinks for existing paths to prevent symlink attacks
  let realPath: string
  try {
    if (existsSync(fullPath)) {
      realPath = realpathSync(fullPath)
    } else if (requireExists) {
      // Path doesn't exist and is required to exist
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Path not found',
      })
    } else {
      // For new files (write operation), validate parent directory
      const parentDir = dirname(fullPath)
      if (existsSync(parentDir)) {
        const realParentDir = realpathSync(parentDir)
        if (!realParentDir.startsWith(worktreePath)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Path traversal detected. Access denied.',
          })
        }
      }
      realPath = fullPath
    }
  } catch (error) {
    if (error instanceof TRPCError) {
      throw error
    }
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Invalid path',
    })
  }

  if (!realPath.startsWith(worktreePath)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Path traversal detected. Access denied.',
    })
  }

  return fullPath
}

export const fileRouter = t.router({
  list: protectedProcedure
    .input(z.object({
      sessionId: z.string(),
      path: z.string().default('.'),
    }))
    .query(async ({ ctx, input }) => {
      const session = await ctx.services.sessionService.get(input.sessionId)

      if (!session?.worktree?.path) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Session has no worktree',
        })
      }

      const fullPath = validatePath(session.worktree.path, input.path)

      try {
        const entries = await readdir(fullPath, { withFileTypes: true })

        return entries.map(entry => ({
          name: entry.name,
          type: entry.isDirectory() ? 'directory' as const : 'file' as const,
          path: join(input.path, entry.name),
        }))
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to list directory',
        })
      }
    }),

  read: protectedProcedure
    .input(z.object({
      sessionId: z.string(),
      path: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const session = await ctx.services.sessionService.get(input.sessionId)

      if (!session?.worktree?.path) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Session has no worktree',
        })
      }

      const fullPath = validatePath(session.worktree.path, input.path)

      try {
        const stats = await stat(fullPath)

        if (stats.isDirectory()) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Cannot read a directory',
          })
        }

        const content = await readFile(fullPath, 'utf-8')

        return {
          path: input.path,
          content,
          size: stats.size,
          modifiedAt: stats.mtime,
        }
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to read file',
        })
      }
    }),

  write: protectedProcedure
    .input(z.object({
      sessionId: z.string(),
      path: z.string(),
      content: z.string().max(10_000_000, 'File too large (max 10MB)'),
    }))
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.services.sessionService.get(input.sessionId)

      if (!session?.worktree?.path) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Session has no worktree',
        })
      }

      const fullPath = validatePath(session.worktree.path, input.path, false)

      try {
        // Ensure parent directory exists
        await mkdir(dirname(fullPath), { recursive: true })

        await writeFile(fullPath, input.content, 'utf-8')

        const stats = await stat(fullPath)

        return {
          path: input.path,
          size: stats.size,
          modifiedAt: stats.mtime,
        }
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to write file',
        })
      }
    }),

  delete: protectedProcedure
    .input(z.object({
      sessionId: z.string(),
      path: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.services.sessionService.get(input.sessionId)

      if (!session?.worktree?.path) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Session has no worktree',
        })
      }

      const fullPath = validatePath(session.worktree.path, input.path)

      try {
        const stats = await stat(fullPath)

        await rm(fullPath, {
          recursive: stats.isDirectory(),
          force: true,
        })

        return {
          success: true,
          path: input.path,
        }
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete',
        })
      }
    }),
})

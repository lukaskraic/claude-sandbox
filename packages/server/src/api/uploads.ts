import { Router, type Router as RouterType } from 'express'
import multer from 'multer'
import path from 'path'
import { promises as fs } from 'fs'
import { logger } from '../logger.js'
import type { SessionService } from '../services/SessionService.js'
import type { ContainerService } from '../services/ContainerService.js'

export function createUploadRouter(
  dataDir: string,
  sessionService?: SessionService,
  containerService?: ContainerService
): RouterType {
  const router = Router()

  // Storage configuration - save to project-specific directory
  const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
      const projectId = req.params.projectId
      if (!projectId) {
        return cb(new Error('Project ID required'), '')
      }

      const uploadDir = path.join(dataDir, 'uploads', projectId)
      await fs.mkdir(uploadDir, { recursive: true })
      cb(null, uploadDir)
    },
    filename: (req, file, cb) => {
      // Keep original filename but sanitize it
      const sanitized = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')
      cb(null, sanitized)
    }
  })

  const upload = multer({
    storage,
    limits: {
      fileSize: 2 * 1024 * 1024 * 1024, // 2GB limit
    },
    fileFilter: (req, file, cb) => {
      // Allow SQL files and common dump extensions
      const allowedExtensions = ['.sql', '.dump', '.bak', '.gz', '.tar', '.zip']
      const ext = path.extname(file.originalname).toLowerCase()
      if (allowedExtensions.includes(ext)) {
        cb(null, true)
      } else {
        cb(new Error(`File type not allowed. Allowed: ${allowedExtensions.join(', ')}`))
      }
    }
  })

  // Upload SQL file for a project
  router.post('/projects/:projectId/sql', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' })
      }

      const projectId = req.params.projectId
      const filePath = path.join('uploads', projectId, req.file.filename)

      logger.info('SQL file uploaded', {
        projectId,
        filename: req.file.filename,
        size: req.file.size,
        path: filePath
      })

      res.json({
        success: true,
        filename: req.file.filename,
        path: filePath,
        size: req.file.size
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed'
      logger.error('Upload failed', { error: message })
      res.status(500).json({ error: message })
    }
  })

  // List uploaded files for a project
  router.get('/projects/:projectId/files', async (req, res) => {
    try {
      const projectId = req.params.projectId
      const uploadDir = path.join(dataDir, 'uploads', projectId)

      try {
        const files = await fs.readdir(uploadDir)
        const fileInfos = await Promise.all(
          files.map(async (filename) => {
            const filePath = path.join(uploadDir, filename)
            const stat = await fs.stat(filePath)
            return {
              filename,
              path: path.join('uploads', projectId, filename),
              size: stat.size,
              modified: stat.mtime
            }
          })
        )
        res.json(fileInfos)
      } catch {
        // Directory doesn't exist yet
        res.json([])
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to list files'
      res.status(500).json({ error: message })
    }
  })

  // Delete uploaded file
  router.delete('/projects/:projectId/files/:filename', async (req, res) => {
    try {
      const { projectId, filename } = req.params
      const filePath = path.join(dataDir, 'uploads', projectId, filename)

      await fs.unlink(filePath)
      logger.info('File deleted', { projectId, filename })

      res.json({ success: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete file'
      res.status(500).json({ error: message })
    }
  })

  // Image upload for session terminal (paste screenshot)
  if (sessionService && containerService) {
    const imageStorage = multer.diskStorage({
      destination: async (req, file, cb) => {
        const uploadDir = path.join(dataDir, 'temp-images')
        await fs.mkdir(uploadDir, { recursive: true })
        cb(null, uploadDir)
      },
      filename: (req, file, cb) => {
        const timestamp = Date.now()
        const ext = path.extname(file.originalname) || '.png'
        cb(null, `screenshot-${timestamp}${ext}`)
      }
    })

    const imageUpload = multer({
      storage: imageStorage,
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit for images
      },
      fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
        if (allowedTypes.includes(file.mimetype)) {
          cb(null, true)
        } else {
          cb(new Error(`Image type not allowed. Allowed: ${allowedTypes.join(', ')}`))
        }
      }
    })

    router.post('/sessions/:sessionId/image', imageUpload.single('image'), async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: 'No image uploaded' })
        }

        const { sessionId } = req.params
        const session = await sessionService.get(sessionId)

        if (!session) {
          await fs.unlink(req.file.path)
          return res.status(404).json({ error: 'Session not found' })
        }

        if (!session.container?.id) {
          await fs.unlink(req.file.path)
          return res.status(400).json({ error: 'Session has no running container' })
        }

        const containerPath = `/tmp/${req.file.filename}`

        await containerService.copyToContainer(
          session.container.id,
          req.file.path,
          containerPath
        )

        // Cleanup temp file
        await fs.unlink(req.file.path)

        logger.info('Image uploaded to session container', {
          sessionId,
          filename: req.file.filename,
          containerPath
        })

        res.json({
          success: true,
          path: containerPath,
          filename: req.file.filename
        })
      } catch (error) {
        if (req.file) {
          await fs.unlink(req.file.path).catch(() => {})
        }
        const message = error instanceof Error ? error.message : 'Image upload failed'
        logger.error('Image upload failed', { error: message })
        res.status(500).json({ error: message })
      }
    })
  }

  return router
}

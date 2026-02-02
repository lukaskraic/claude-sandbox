import { z } from 'zod'
import { initTRPC } from '@trpc/server'
import type { Context } from '../context.js'

const t = initTRPC.context<Context>().create()

export const containerRouter = t.router({
  /**
   * List containers for a project
   */
  listByProject: t.procedure
    .input(z.object({ projectId: z.string() }))
    .query(({ ctx, input }) => {
      return ctx.services.containerService.listContainersByProject(input.projectId)
    }),

  /**
   * List images for a project
   */
  listImages: t.procedure
    .input(z.object({ projectName: z.string() }))
    .query(({ ctx, input }) => {
      return ctx.services.containerService.listImagesByProject(input.projectName)
    }),

  /**
   * List networks for a project
   */
  listNetworks: t.procedure
    .input(z.object({ projectId: z.string() }))
    .query(({ ctx, input }) => {
      return ctx.services.containerService.listNetworksByProject(input.projectId)
    }),

  /**
   * List volumes for a project
   */
  listVolumes: t.procedure
    .input(z.object({ projectId: z.string() }))
    .query(({ ctx, input }) => {
      return ctx.services.containerService.listVolumesByProject(input.projectId)
    }),

  /**
   * Get stats for a single container
   */
  getStats: t.procedure
    .input(z.object({ containerId: z.string() }))
    .query(({ ctx, input }) => {
      return ctx.services.containerService.getContainerStats(input.containerId)
    }),

  /**
   * Get resource summary for a project
   */
  getSummary: t.procedure
    .input(z.object({
      projectId: z.string(),
      projectName: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const sessions = await ctx.services.sessionService.listByProject(input.projectId)
      const validSessionIds = sessions.map(s => s.id)
      return ctx.services.containerService.getProjectResourceSummary(
        input.projectId,
        input.projectName,
        validSessionIds
      )
    }),

  /**
   * Find orphaned containers
   */
  findOrphans: t.procedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const sessions = await ctx.services.sessionService.listByProject(input.projectId)
      const validSessionIds = sessions.map(s => s.id)
      return ctx.services.containerService.findOrphanedContainers(input.projectId, validSessionIds)
    }),

  /**
   * Stop a single container
   */
  stop: t.procedure
    .input(z.object({ containerId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.services.containerService.stopContainer(input.containerId)
      return { success: true }
    }),

  /**
   * Start a container
   */
  start: t.procedure
    .input(z.object({ containerId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.services.containerService.startContainer(input.containerId)
      return { success: true }
    }),

  /**
   * Remove a single container
   */
  remove: t.procedure
    .input(z.object({ containerId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.services.containerService.removeContainer(input.containerId)
      return { success: true }
    }),

  /**
   * Stop multiple containers
   */
  batchStop: t.procedure
    .input(z.object({ containerIds: z.array(z.string()) }))
    .mutation(({ ctx, input }) => {
      return ctx.services.containerService.stopContainersBatch(input.containerIds)
    }),

  /**
   * Remove multiple containers
   */
  batchRemove: t.procedure
    .input(z.object({ containerIds: z.array(z.string()) }))
    .mutation(({ ctx, input }) => {
      return ctx.services.containerService.removeContainersBatch(input.containerIds)
    }),

  /**
   * Remove an image
   */
  removeImage: t.procedure
    .input(z.object({ imageId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.services.containerService.removeImageById(input.imageId)
      return { success: true }
    }),

  /**
   * Cleanup orphaned containers for a project
   */
  cleanupOrphans: t.procedure
    .input(z.object({ projectId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const sessions = await ctx.services.sessionService.listByProject(input.projectId)
      const validSessionIds = sessions.map(s => s.id)
      return ctx.services.containerService.cleanupOrphanedContainersByProject(input.projectId, validSessionIds)
    }),
})

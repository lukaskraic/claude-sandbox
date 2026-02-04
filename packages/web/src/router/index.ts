import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/authStore'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/projects',
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { public: true },
    },
    {
      path: '/projects',
      name: 'projects',
      component: () => import('@/views/ProjectsView.vue'),
    },
    {
      path: '/projects/:id',
      name: 'project-detail',
      component: () => import('@/views/ProjectDetailView.vue'),
    },
    {
      path: '/sessions',
      name: 'sessions',
      component: () => import('@/views/SessionsView.vue'),
    },
    {
      path: '/projects/:projectId/sessions',
      name: 'project-sessions',
      component: () => import('@/views/SessionsView.vue'),
    },
    {
      path: '/sessions/:id',
      name: 'session-detail',
      component: () => import('@/views/SessionDetailView.vue'),
    },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  // Check auth status on first load
  await auth.checkAuth()

  // Public routes don't require auth
  if (to.meta.public) {
    // If already authenticated, redirect to projects
    if (auth.isAuthenticated.value && to.path === '/login') {
      return '/projects'
    }
    return true
  }

  // Protected routes - redirect to login if not authenticated
  if (!auth.isAuthenticated.value) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }

  return true
})

export default router

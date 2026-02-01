import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/projects',
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
      path: '/sessions/:id',
      name: 'session-detail',
      component: () => import('@/views/SessionDetailView.vue'),
    },
  ],
})

export default router

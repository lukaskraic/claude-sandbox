<template>
  <v-app>
    <v-app-bar v-if="showAppBar" color="primary" density="compact">
      <v-app-bar-nav-icon @click="drawer = !drawer" />
      <v-app-bar-title>Claude Sandbox</v-app-bar-title>
      <v-spacer />
      <template v-if="auth.user.value">
        <span class="text-body-2 mr-2">{{ auth.user.value }}</span>
        <v-btn icon="mdi-logout" size="small" @click="handleLogout" title="Logout" />
      </template>
    </v-app-bar>

    <v-navigation-drawer v-model="drawer" temporary>
      <v-list nav>
        <v-list-item
          prepend-icon="mdi-folder-multiple"
          title="Projects"
          to="/projects"
          @click="drawer = false"
        />
        <v-list-item
          prepend-icon="mdi-source-branch"
          title="Worktrees"
          to="/worktrees"
          @click="drawer = false"
        />
      </v-list>
    </v-navigation-drawer>

    <v-main>
      <router-view />
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from './stores/authStore'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const drawer = ref(false)

const showAppBar = computed(() => route.path !== '/login')

async function handleLogout() {
  await auth.logout()
  router.push('/login')
}
</script>

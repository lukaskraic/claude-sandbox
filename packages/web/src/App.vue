<template>
  <v-app>
    <v-app-bar color="primary" density="compact">
      <v-app-bar-title>Claude Sandbox</v-app-bar-title>
      <template #append>
        <v-btn icon="mdi-github" href="https://github.com" target="_blank" />
      </template>
    </v-app-bar>

    <v-navigation-drawer permanent>
      <v-list nav>
        <v-list-item
          prepend-icon="mdi-folder-multiple"
          title="Projects"
          to="/projects"
        />
        <v-list-item
          prepend-icon="mdi-console"
          title="Sessions"
          to="/sessions"
        />
      </v-list>
    </v-navigation-drawer>

    <v-main>
      <router-view />
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
</script>

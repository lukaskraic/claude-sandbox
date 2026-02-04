<template>
  <v-container class="fill-height" fluid>
    <v-row align="center" justify="center">
      <v-col cols="12" sm="8" md="4">
        <v-card class="elevation-12">
          <v-toolbar color="primary" dark flat>
            <v-toolbar-title>Claude Sandbox</v-toolbar-title>
          </v-toolbar>
          <v-card-text>
            <v-form ref="form" @submit.prevent="handleLogin">
              <v-text-field
                v-model="username"
                label="Username"
                prepend-icon="mdi-account"
                type="text"
                :rules="[v => !!v || 'Username is required']"
                :disabled="loading"
                autofocus
              />
              <v-text-field
                v-model="password"
                label="Password"
                prepend-icon="mdi-lock"
                type="password"
                :rules="[v => !!v || 'Password is required']"
                :disabled="loading"
                @keyup.enter="handleLogin"
              />
              <v-alert
                v-if="error"
                type="error"
                variant="tonal"
                class="mb-4"
                closable
                @click:close="clearError"
              >
                {{ error }}
              </v-alert>
            </v-form>
          </v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn
              color="primary"
              :loading="loading"
              :disabled="!username || !password"
              @click="handleLogin"
            >
              Login
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/authStore'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const username = ref('')
const password = ref('')

const { loading, error, clearError } = auth

async function handleLogin() {
  if (!username.value || !password.value) return

  const success = await auth.login(username.value, password.value)

  if (success) {
    const redirect = route.query.redirect as string || '/projects'
    router.push(redirect)
  }
}
</script>

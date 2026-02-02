<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <div class="d-flex align-center mb-4">
          <h1 class="text-h4">Projects</h1>
          <v-spacer />
          <v-btn color="primary" prepend-icon="mdi-plus" @click="showCreateDialog = true">
            New Project
          </v-btn>
        </div>
      </v-col>
    </v-row>

    <v-row v-if="projectStore.loading">
      <v-col cols="12" class="text-center">
        <v-progress-circular indeterminate color="primary" />
      </v-col>
    </v-row>

    <v-row v-else-if="projectStore.projects.length === 0">
      <v-col cols="12">
        <v-alert type="info" variant="tonal">
          No projects yet. Create your first project to get started.
        </v-alert>
      </v-col>
    </v-row>

    <v-row v-else>
      <v-col
        v-for="project in projectStore.projects"
        :key="project.id"
        cols="12"
        md="6"
        lg="4"
      >
        <v-card :to="`/projects/${project.id}/sessions`">
          <v-card-title>{{ project.name }}</v-card-title>
          <v-card-subtitle>{{ project.environment.baseImage }}</v-card-subtitle>
          <v-card-text v-if="project.description">
            {{ project.description }}
          </v-card-text>
          <v-card-actions>
            <v-chip size="small" color="primary" variant="outlined">
              {{ project.git.defaultBranch }}
            </v-chip>
            <v-spacer />
            <v-btn
              icon="mdi-cog"
              size="small"
              variant="text"
              :to="`/projects/${project.id}`"
              @click.stop
            />
            <v-btn
              icon="mdi-delete"
              size="small"
              color="error"
              variant="text"
              @click.prevent="deleteProject(project.id)"
            />
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>

    <CreateProjectDialog v-model="showCreateDialog" @created="onProjectCreated" />
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useProjectStore } from '@/stores/projectStore'
import CreateProjectDialog from '@/components/CreateProjectDialog.vue'

const projectStore = useProjectStore()
const showCreateDialog = ref(false)

onMounted(() => {
  projectStore.fetchProjects()
})

function onProjectCreated() {
  showCreateDialog.value = false
}

async function deleteProject(id: string) {
  if (confirm('Are you sure you want to delete this project?')) {
    await projectStore.deleteProject(id)
  }
}
</script>

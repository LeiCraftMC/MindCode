<script setup lang="ts">
import { useClaudeSessionStore } from '~/composables/stores/useClaudeSessionStore';
import type { GetClaudeProjectsResponses } from '~/api-client';

definePageMeta({
    layout: 'dashboard',
});

useSeoMeta({
    title: 'Projects | MindCode',
    description: 'Manage your Claude Code projects'
});

// ── Data ────────────────────────────────────────────────────────

const { data: projects, refresh: refreshProjects } = await useAPILazyAsyncData<GetClaudeProjectsResponses['200']['data']>(
    'projects-list',
    async () => {
        const result = await useAPI((api) => api.getClaudeProjects({
            query: { order: 'newest', limit: 100 }
        }));
        if (result.success) {
            return result.data;
        }
        return [];
    }
);

// ── New project modal ───────────────────────────────────────────

const newProjectOpen = ref(false);
const newProjectPath = ref('');
const newProjectError = ref<string | null>(null);
const isCreating = ref(false);

function openNewProject() {
    newProjectPath.value = '';
    newProjectError.value = null;
    newProjectOpen.value = true;
}

async function createProject() {
    const path = newProjectPath.value.trim();
    if (!path) {
        newProjectError.value = 'Please enter an absolute path';
        return;
    }

    if (!path.startsWith('/')) {
        newProjectError.value = 'Path must be absolute (start with /)';
        return;
    }

    isCreating.value = true;
    newProjectError.value = null;

    try {
        const sessionStore = useClaudeSessionStore();
        sessionStore.addProject(path);

        newProjectOpen.value = false;

        await navigateTo(`/projects/${encodeURIComponent(path)}`);
    } catch (err: any) {
        newProjectError.value = err.message || 'Failed to create project';
    } finally {
        isCreating.value = false;
    }
}

// ── Helpers ─────────────────────────────────────────────────────

function formatLastUsed(ts: number): string {
    const d = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    return d.toLocaleDateString();
}

function projectUrl(project: { absolute_path: string }): string {
    return `/projects/${encodeURIComponent(project.absolute_path)}/sessions/new`;
}
</script>

<template>
    <UDashboardPanel id="projects">
        <template #header>
            <UDashboardNavbar title="Projects" icon="i-lucide-folder">
                <template #right>
                    <UButton
                        icon="i-lucide-plus"
                        color="primary"
                        variant="solid"
                        size="md"
                        @click="openNewProject"
                    >
                        New Project
                    </UButton>
                </template>
            </UDashboardNavbar>
        </template>

        <template #body>
            <div class="flex flex-col gap-4 sm:gap-6 lg:gap-12 w-full lg:max-w-5xl mx-auto p-4 sm:p-6">
                <!-- Loading state -->
                <div
                    v-if="!projects"
                    class="flex items-center justify-center py-20"
                >
                    <UIcon name="i-lucide-loader-2" class="animate-spin text-3xl text-slate-400" />
                </div>

                <!-- Empty state -->
                <div
                    v-else-if="projects.length === 0"
                    class="flex flex-col items-center justify-center text-center py-20"
                >
                    <div class="w-16 h-16 rounded-full bg-slate-800/60 border border-slate-700/50 flex items-center justify-center mb-4">
                        <UIcon name="i-lucide-folder-plus" class="text-3xl text-slate-500" />
                    </div>
                    <h2 class="text-xl font-semibold text-slate-300 mb-2">No projects yet</h2>
                    <p class="text-slate-400 max-w-md mb-6">
                        Create a project to start working with Claude Code. You'll need to specify an absolute path to a directory on your server.
                    </p>
                    <UButton
                        icon="i-lucide-plus"
                        color="primary"
                        variant="solid"
                        size="lg"
                        @click="openNewProject"
                    >
                        Create your first project
                    </UButton>
                </div>

                <!-- Project list -->
                <div v-else class="divide-y divide-slate-800/60 border border-slate-800 rounded-lg overflow-hidden">
                    <NuxtLink
                        v-for="project in projects"
                        :key="project.absolute_path"
                        :to="projectUrl(project)"
                        class="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3.5 bg-slate-900/30 hover:bg-slate-800/40 transition-colors duration-150 group"
                    >
                        <div class="w-9 h-9 rounded-lg bg-primary-500/10 border border-primary-500/20 flex items-center justify-center shrink-0">
                            <UIcon name="i-lucide-folder" class="text-base text-primary-400" />
                        </div>
                        <div class="min-w-0 flex-1">
                            <div class="flex items-center gap-2">
                                <span class="font-medium text-slate-200 truncate group-hover:text-white transition-colors">
                                    {{ project.name }}
                                </span>
                                <span class="text-xs text-slate-600 shrink-0">
                                    {{ formatLastUsed(project.last_used) }}
                                </span>
                            </div>
                            <p class="text-xs text-slate-500 mt-0.5 truncate font-mono">
                                {{ project.absolute_path }}
                            </p>
                        </div>
                        <UIcon
                            name="i-lucide-chevron-right"
                            class="text-slate-600 group-hover:text-slate-400 transition-colors shrink-0"
                        />
                    </NuxtLink>
                </div>
            </div>
        </template>
    </UDashboardPanel>

    <!-- New Project Modal -->
    <DashboardModal
        v-model:open="newProjectOpen"
        title="New Project"
        description="Enter the absolute path to a directory on your server to create a new Claude Code project."
        icon="i-lucide-folder-plus"
        icon-color="sky"
        :loading="isCreating"
        @close="newProjectOpen = false"
    >
        <form
            class="space-y-4"
            @submit.prevent="createProject"
        >
            <UFormField
                name="projectPath"
                label="Project Path"
                description="Must be an absolute path to a directory on the server."
                required
                class="flex flex-col gap-2"
            >
                <UInput
                    v-model="newProjectPath"
                    placeholder="/home/user/my-project"
                    size="lg"
                    :disabled="isCreating"
                    class="w-full font-mono"
                    autofocus
                />
            </UFormField>

            <p
                v-if="newProjectError"
                class="text-sm text-red-400 flex items-center gap-1.5"
            >
                <UIcon name="i-lucide-alert-circle" class="w-4 h-4 shrink-0" />
                {{ newProjectError }}
            </p>

            <div class="flex justify-end gap-2 pt-2">
                <UButton
                    color="neutral"
                    variant="ghost"
                    :disabled="isCreating"
                    @click="newProjectOpen = false"
                >
                    Cancel
                </UButton>
                <UButton
                    type="submit"
                    color="primary"
                    variant="solid"
                    :loading="isCreating"
                >
                    Create Project
                </UButton>
            </div>
        </form>
    </DashboardModal>
</template>

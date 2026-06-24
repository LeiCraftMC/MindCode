<script setup lang="ts">
import type { ClaudeSession } from '~/composables/stores/useClaudeSessionStore';

export interface ProjectGroup {
    path: string;
    name: string;
    sessions: ClaudeSession[];
}

const props = defineProps<{
    projects: ProjectGroup[];
    activeSessionId: string | null;
    activeProjectPath: string | null;
    open: boolean;
}>();

const emit = defineEmits<{
    selectSession: [id: string];
    deleteSession: [id: string];
    newSession: [projectPath: string];
    selectProject: [path: string];
    addProject: [path: string];
    close: [];
}>();

const expandedProjects = ref<Set<string>>(new Set());
const addProjectModalOpen = ref(false);
const newProjectPath = ref('');
const addProjectError = ref('');

// Auto-expand the active project
watch(() => props.activeProjectPath, (path) => {
    if (path) expandedProjects.value.add(path);
}, { immediate: true });

function toggleProject(path: string) {
    emit('selectProject', path);
    if (expandedProjects.value.has(path)) {
        expandedProjects.value.delete(path);
    } else {
        expandedProjects.value.add(path);
    }
}

function formatDate(ts: number): string {
    const d = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return 'now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function displayTitle(session: ClaudeSession): string {
    return session.customTitle || session.summary || session.firstPrompt || `Session ${session.sessionId.substring(0, 8)}`;
}

function projectName(path: string): string {
    return path.split('/').pop() || path.split('\\').pop() || path;
}

function projectLetter(path: string): string {
    const name = projectName(path);
    return (name[0] || '?').toUpperCase();
}

function openAddProject() {
    newProjectPath.value = '';
    addProjectError.value = '';
    addProjectModalOpen.value = true;
}

function confirmAddProject() {
    const path = newProjectPath.value.trim();
    if (!path) {
        addProjectError.value = 'Please enter a project path';
        return;
    }
    emit('addProject', path);
    addProjectModalOpen.value = false;
}
</script>

<template>
    <!-- Mobile overlay -->
    <Teleport to="body">
        <div
            v-if="open"
            class="fixed inset-0 bg-black/50 z-40 lg:hidden"
            @click="emit('close')"
        />
    </Teleport>

    <aside
        :class="[
            'h-full flex flex-col bg-slate-950 border-r border-slate-800 transition-all duration-200 z-50',
            open ? 'w-72 translate-x-0' : 'w-0 -translate-x-full overflow-hidden lg:w-0',
            'lg:relative lg:translate-x-0 lg:w-72'
        ]"
    >
        <!-- Sidebar header -->
        <div class="p-3 border-b border-slate-800 flex items-center justify-between">
            <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Projects</span>
            <UButton
                icon="i-lucide-x"
                color="neutral"
                variant="ghost"
                size="xs"
                class="lg:hidden"
                @click="emit('close')"
            />
        </div>

        <div class="flex-1 overflow-y-auto p-2 space-y-2">
            <div v-if="projects.length === 0" class="text-center text-slate-600 text-sm py-8">
                No sessions yet
            </div>

            <template v-for="project in projects" :key="project.path">
                <!-- Project card -->
                <div
                    :class="[
                        'rounded-xl border transition-colors overflow-hidden',
                        activeProjectPath === project.path
                            ? 'bg-slate-900/80 border-primary-500/20'
                            : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'
                    ]"
                >
                    <!-- Project header -->
                    <button
                        class="w-full flex items-center gap-3 p-3 text-left"
                        @click="toggleProject(project.path)"
                    >
                        <div
                            :class="[
                                'w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0',
                                activeProjectPath === project.path ? 'bg-primary-500/20 text-primary-400' : 'bg-slate-800 text-slate-400'
                            ]"
                        >
                            {{ projectLetter(project.path) }}
                        </div>

                        <div class="flex-1 min-w-0">
                            <div class="text-sm font-medium text-slate-200 truncate">
                                {{ projectName(project.path) }}
                            </div>
                            <div class="text-[10px] text-slate-600 truncate">
                                {{ project.path }}
                            </div>
                        </div>

                        <UIcon
                            :name="expandedProjects.has(project.path) ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
                            class="w-4 h-4 text-slate-500 flex-shrink-0"
                        />
                    </button>

                    <!-- New session button -->
                    <button
                        class="w-full flex items-center justify-center gap-2 py-1.5 text-xs text-slate-500 hover:text-primary-400 hover:bg-slate-800/60 transition-colors border-t border-slate-800"
                        @click="emit('newSession', project.path)"
                    >
                        <UIcon name="i-lucide-plus" class="w-3 h-3" />
                        Neue Sitzung
                    </button>

                    <!-- Sessions list -->
                    <div v-if="expandedProjects.has(project.path)" class="border-t border-slate-800">
                        <button
                            v-for="session in project.sessions"
                            :key="session.sessionId"
                            :class="[
                                'w-full text-left px-3 py-2.5 text-sm transition-colors flex items-center gap-2 group border-b border-slate-800/50 last:border-b-0',
                                activeSessionId === session.sessionId
                                    ? 'bg-primary-500/10 text-primary-300'
                                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/30'
                            ]"
                            @click="emit('selectSession', session.sessionId)"
                        >
                            <UIcon name="i-lucide-message-circle" class="w-3.5 h-3.5 flex-shrink-0" />
                            <div class="flex-1 min-w-0">
                                <div class="truncate">{{ displayTitle(session) }}</div>
                                <div class="text-[10px] text-slate-600 flex items-center gap-2">
                                    <span v-if="session.gitBranch" class="flex items-center gap-1">
                                        <UIcon name="i-lucide-git-branch" class="w-3 h-3" />
                                        {{ session.gitBranch }}
                                    </span>
                                    <span>{{ formatDate(session.lastModified) }}</span>
                                </div>
                            </div>

                            <UButton
                                icon="i-lucide-x"
                                color="neutral"
                                variant="ghost"
                                size="2xs"
                                class="opacity-0 group-hover:opacity-100 flex-shrink-0"
                                @click.stop="emit('deleteSession', session.sessionId)"
                            />
                        </button>
                    </div>
                </div>
            </template>
        </div>

        <!-- Add project button -->
        <div class="p-3 border-t border-slate-800">
            <UButton
                label="Add project"
                icon="i-lucide-plus"
                color="primary"
                variant="soft"
                size="sm"
                block
                @click="openAddProject"
            />
        </div>
    </aside>

    <!-- Add project modal -->
    <Teleport to="body">
        <div
            v-if="addProjectModalOpen"
            class="fixed inset-0 bg-black/50 z-60 flex items-center justify-center p-4"
            @click="addProjectModalOpen = false"
        >
            <div
                class="w-full max-w-md bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl p-5"
                @click.stop
            >
                <h3 class="text-base font-semibold text-slate-200 mb-1">Add project</h3>
                <p class="text-xs text-slate-500 mb-4">
                    Enter the absolute path to a project directory you want to use with Claude Code.
                </p>

                <UInput
                    v-model="newProjectPath"
                    placeholder="L:/Coding/MyProject"
                    color="neutral"
                    size="md"
                    class="w-full"
                    @keydown.enter="confirmAddProject"
                />

                <p v-if="addProjectError" class="text-xs text-red-400 mt-2">{{ addProjectError }}</p>

                <div class="flex justify-end gap-2 mt-4">
                    <UButton
                        label="Cancel"
                        color="neutral"
                        variant="ghost"
                        size="sm"
                        @click="addProjectModalOpen = false"
                    />
                    <UButton
                        label="Add"
                        color="primary"
                        size="sm"
                        @click="confirmAddProject"
                    />
                </div>
            </div>
        </div>
    </Teleport>
</template>

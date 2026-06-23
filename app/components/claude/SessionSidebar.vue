<script setup lang="ts">
defineProps<{
    sessions: ReadonlyArray<{
        sessionId: string;
        summary: string;
        lastModified: number;
        customTitle?: string;
        firstPrompt?: string;
        createdAt?: number;
    }>;
    activeId?: string | null;
}>();

const emit = defineEmits<{
    select: [id: string];
    delete: [id: string];
    new: [];
}>();

function formatDate(ts: number): string {
    const d = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 86400000) return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    if (diff < 604800000) return d.toLocaleDateString(undefined, { weekday: 'short' });
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function displayTitle(session: { summary: string; customTitle?: string; firstPrompt?: string; sessionId: string }): string {
    return session.customTitle || session.summary || session.firstPrompt || `Session ${session.sessionId.substring(0, 8)}`;
}
</script>

<template>
    <div class="w-64 border-r border-slate-800 flex flex-col h-full">
        <div class="p-3 border-b border-slate-800">
            <UButton
                label="New Session"
                icon="i-lucide-plus"
                color="primary"
                variant="solid"
                size="sm"
                class="w-full justify-center"
                @click="emit('new')"
            />
        </div>

        <div class="flex-1 overflow-y-auto p-2 space-y-1">
            <div class="text-xs text-slate-500 uppercase tracking-wider px-2 py-1 font-medium">
                Sessions
            </div>

            <button
                v-for="session in sessions"
                :key="session.sessionId"
                :class="[
                    'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
                    activeId === session.sessionId
                        ? 'bg-primary-500/20 text-primary-300 border border-primary-500/30'
                        : 'text-slate-300 hover:bg-slate-800/60 border border-transparent'
                ]"
                @click="emit('select', session.sessionId)"
            >
                <div class="flex items-center justify-between gap-2">
                    <span class="truncate flex-1">{{ displayTitle(session) }}</span>
                </div>
                <div class="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                    <span>{{ formatDate(session.lastModified) }}</span>
                </div>
            </button>

            <div v-if="!sessions.length" class="text-center text-slate-600 text-sm py-8">
                No sessions yet
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
defineProps<{
    title: string;
    sessionId: string | null;
    connected: boolean;
    sidebarOpen: boolean;
}>();

const emit = defineEmits<{
    toggleSidebar: [];
    newChat: [];
    toggleConfig: [];
}>();
</script>

<template>
    <div class="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm">
        <!-- Left: Hamburger (mobile) + Session title -->
        <div class="flex items-center gap-2 sm:gap-3 min-w-0">
            <UButton
                icon="i-lucide-panel-left"
                color="neutral"
                variant="ghost"
                size="sm"
                class="lg:hidden"
                @click="emit('toggleSidebar')"
            />
            <span class="text-sm sm:text-base font-medium text-slate-200 truncate max-w-[150px] sm:max-w-[300px] lg:max-w-[400px]">
                {{ title || 'Untitled' }}
            </span>
        </div>

        <!-- Center: Brand with sparkle -->
        <div class="flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base text-slate-300 font-medium">
            <UIcon name="i-lucide-sparkles" class="w-4 h-4 text-amber-400" />
            <span class="hidden sm:inline">Claude Code</span>
        </div>

        <!-- Right: Actions -->
        <div class="flex items-center gap-1">
            <UBadge
                v-if="connected"
                size="sm"
                color="success"
                variant="soft"
                class="hidden sm:flex"
            >
                <UIcon name="i-lucide-wifi" class="mr-1" />
                Connected
            </UBadge>
            <UBadge
                v-else
                size="sm"
                color="error"
                variant="soft"
                class="hidden sm:flex"
            >
                <UIcon name="i-lucide-wifi-off" class="mr-1" />
                Disconnected
            </UBadge>

            <UButton
                icon="i-lucide-clock"
                color="neutral"
                variant="ghost"
                size="sm"
                :ui="{ rounded: 'rounded-full' }"
                title="History"
            />
            <UButton
                icon="i-lucide-plus"
                color="neutral"
                variant="ghost"
                size="sm"
                :ui="{ rounded: 'rounded-full' }"
                title="New Chat"
                @click="emit('newChat')"
            />
            <UButton
                icon="i-lucide-settings-2"
                color="neutral"
                variant="ghost"
                size="sm"
                :ui="{ rounded: 'rounded-full' }"
                title="Configuration"
                @click="emit('toggleConfig')"
            />
        </div>
    </div>
</template>

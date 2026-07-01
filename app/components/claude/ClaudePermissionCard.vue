<script setup lang="ts">
import type { PermissionRequestMessage } from '#shared/types/claude-ws';

const props = defineProps<PermissionRequestMessage>();

const emit = defineEmits<{
    allow: [requestId: string, updatedPermissions?: PermissionRequestMessage['permissionSuggestions']];
    deny: [requestId: string, message?: string];
}>();

const alwaysAllow = ref(false);

const summary = computed(() => {
    const i = props.input || {};
    if (props.toolName === 'Bash') return i.description || i.command || '';
    if (props.toolName === 'Read' || props.toolName === 'Write' || props.toolName === 'Edit') {
        return i.file_path || i.path || '';
    }
    return i.description || i.prompt || i.url || i.subject || '';
});

const titleText = computed(() => props.title || props.displayName || `${props.toolName} request`);

function onAllow() {
    emit('allow', props.requestId, alwaysAllow.value ? props.permissionSuggestions : undefined);
}

function onDeny() {
    emit('deny', props.requestId);
}
</script>

<template>
    <div class="rounded-xl border border-primary-500/30 bg-primary-500/10 p-4 my-2">
        <div class="flex items-start gap-3">
            <UIcon name="i-lucide-shield-alert" class="w-5 h-5 text-primary-400 mt-0.5 flex-shrink-0" />
            <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-primary-200">
                    {{ titleText }}
                </div>
                <div v-if="description" class="text-xs text-slate-400 mt-1">
                    {{ description }}
                </div>
                <div v-if="summary" class="text-xs font-mono text-slate-500 mt-2 truncate" :title="summary">
                    {{ summary }}
                </div>
                <div v-if="blockedPath" class="text-xs text-slate-500 mt-1">
                    Blocked path: {{ blockedPath }}
                </div>

                <div v-if="permissionSuggestions?.length" class="mt-3 flex items-center gap-2">
                    <UCheckbox v-model="alwaysAllow" size="sm" label="Remember this choice for this session" />
                </div>

                <div class="mt-4 flex items-center gap-2">
                    <UButton color="primary" size="sm" @click="onAllow">
                        Allow
                    </UButton>
                    <UButton color="neutral" variant="soft" size="sm" @click="onDeny">
                        Deny
                    </UButton>
                </div>
            </div>
        </div>
    </div>
</template>

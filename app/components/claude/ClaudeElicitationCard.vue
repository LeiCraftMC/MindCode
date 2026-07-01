<script setup lang="ts">
import type { ElicitationRequestMessage } from '#shared/types/claude-ws';

const props = defineProps<ElicitationRequestMessage>();

const emit = defineEmits<{
    accept: [requestId: string, content?: Record<string, any>];
    decline: [requestId: string];
}>();

const formValues = ref<Record<string, any>>({});

const schemaProperties = computed(() => {
    if (!props.requestedSchema || typeof props.requestedSchema !== 'object') return {};
    return (props.requestedSchema as any).properties || {};
});

function submit() {
    if (props.mode === 'url') {
        emit('accept', props.requestId);
    } else {
        emit('accept', props.requestId, formValues.value);
    }
}

function openUrl() {
    if (props.url) window.open(props.url, '_blank', 'noopener,noreferrer');
}
</script>

<template>
    <div class="rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/10 p-4 my-2">
        <div class="flex items-start gap-3">
            <UIcon name="i-lucide-plug" class="w-5 h-5 text-fuchsia-400 mt-0.5 flex-shrink-0" />
            <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-fuchsia-100">
                    {{ title || displayName || `${serverName} needs input` }}
                </div>
                <div v-if="description" class="text-xs text-slate-400 mt-1">{{ description }}</div>
                <div class="text-xs text-slate-300 mt-2">{{ message }}</div>

                <div v-if="mode === 'url' && url" class="mt-3 flex items-center gap-2">
                    <UButton color="primary" size="sm" @click="openUrl">
                        Open authorization page
                    </UButton>
                    <UButton color="neutral" variant="soft" size="sm" @click="submit">
                        Done
                    </UButton>
                </div>

                <div v-else class="mt-3 space-y-2">
                    <div
                        v-for="(schema, key) in schemaProperties"
                        :key="key"
                    >
                        <label class="block text-xs text-slate-400 mb-1">{{ (schema as any).title || key }}</label>
                        <UInput
                            v-model="formValues[key]"
                            size="sm"
                            color="neutral"
                            :type="(schema as any).type === 'number' ? 'number' : 'text'"
                            class="text-xs"
                            :ui="{ base: 'bg-slate-900/60 border-slate-700/50' }"
                        />
                    </div>

                    <div class="flex items-center gap-2 pt-2">
                        <UButton color="primary" size="sm" @click="submit">
                            Submit
                        </UButton>
                        <UButton color="neutral" variant="soft" size="sm" @click="$emit('decline', requestId)">
                            Decline
                        </UButton>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

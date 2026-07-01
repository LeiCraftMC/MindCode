<script setup lang="ts">
import type { DialogRequestMessage } from '#shared/types/claude-ws';

const props = defineProps<DialogRequestMessage>();

const emit = defineEmits<{
    completed: [requestId: string, result?: any];
    cancelled: [requestId: string];
}>();

const resultText = ref('');

function prettyPayload() {
    try {
        return JSON.stringify(props.payload, null, 2);
    } catch {
        return String(props.payload);
    }
}

function onCompleted() {
    emit('completed', props.requestId, resultText.value.trim() || undefined);
}

function onCancelled() {
    emit('cancelled', props.requestId);
}
</script>

<template>
    <div class="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 my-2">
        <div class="flex items-start gap-3">
            <UIcon name="i-lucide-bell" class="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
            <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-amber-100">
                    Claude is asking: {{ dialogKind }}
                </div>

                <pre class="mt-2 text-xs font-mono text-slate-400 bg-slate-900/60 border border-slate-700/50 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap max-h-48">{{ prettyPayload() }}</pre>

                <div class="mt-3">
                    <UTextarea
                        v-model="resultText"
                        placeholder="Your response (if requested)..."
                        :rows="2"
                        variant="none"
                        color="neutral"
                        class="text-xs"
                        :ui="{ base: 'px-3 py-2 bg-slate-900/60 border border-slate-700/50 rounded-lg text-slate-200 placeholder-slate-500 resize-none outline-none focus:ring-1 focus:ring-amber-500/30' }"
                    />
                </div>

                <div class="mt-3 flex items-center gap-2">
                    <UButton color="primary" size="sm" @click="onCompleted">
                        Submit
                    </UButton>
                    <UButton color="neutral" variant="soft" size="sm" @click="onCancelled">
                        Cancel
                    </UButton>
                </div>
            </div>
        </div>
    </div>
</template>

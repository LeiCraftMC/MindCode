<script setup lang="ts">
import { marked } from 'marked';
import ClaudeFileEdit from './ClaudeFileEdit.vue';

const props = defineProps<{
    role: string;
    content: string;
    id: string | number;
    toolCalls?: Array<{ name: string; input: Record<string, any>; tool_use_id: string }>;
}>();

const isUser = computed(() => props.role === 'user');
const isTool = computed(() => props.role === 'tool');
const isAssistant = computed(() => props.role === 'assistant');

const renderedContent = computed(() => {
    if (props.role === 'tool') return props.content;
    try {
        return marked(props.content || '');
    } catch {
        return props.content;
    }
});

// Code block copy
function copyCode(code: string) {
    navigator.clipboard.writeText(code);
}

// Find file edits in tool calls
const fileEdits = computed(() => {
    if (!props.toolCalls?.length) return [];
    return props.toolCalls.filter(tc =>
        tc.name === 'Edit' || tc.name === 'Write' || tc.name === 'Read' || tc.name === 'Bash'
    );
});
</script>

<template>
    <div :class="[
        'flex gap-3 w-full',
        isUser ? 'justify-end' : 'justify-start'
    ]">
        <!-- Assistant avatar -->
        <div v-if="isAssistant" class="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center flex-shrink-0 mt-1">
            <UIcon name="i-lucide-bot" class="text-white w-4 h-4" />
        </div>
        <!-- Tool avatar -->
        <div v-if="isTool" class="w-8 h-8 rounded-full bg-amber-500/30 flex items-center justify-center flex-shrink-0 mt-1">
            <UIcon name="i-lucide-wrench" class="text-amber-400 w-4 h-4" />
        </div>

        <div :class="[
            'rounded-xl px-4 py-3 min-w-0',
            isUser ? 'max-w-[85%] sm:max-w-[70%] bg-primary-500/20 border border-primary-500/30' : '',
            isAssistant ? 'max-w-[90%] sm:max-w-[85%] bg-slate-800/60 border border-slate-700/50' : '',
            isTool ? 'max-w-[85%] bg-amber-500/10 border border-amber-500/30 text-amber-300' : ''
        ]">
            <!-- Tool message -->
            <div v-if="isTool" class="flex items-center gap-2 text-sm">
                <UIcon name="i-lucide-wrench" class="w-4 h-4 flex-shrink-0" />
                <span>{{ content }}</span>
            </div>

            <!-- User message -->
            <div v-else-if="isUser" class="text-sm text-slate-200 whitespace-pre-wrap break-words">
                {{ content }}
            </div>

            <!-- Assistant message (rendered markdown) -->
            <div v-else class="prose prose-invert prose-sm max-w-none break-words" v-html="renderedContent" />

            <!-- File edits from tool calls -->
            <div v-if="fileEdits.length > 0" class="mt-2 space-y-1">
                <ClaudeFileEdit
                    v-for="edit in fileEdits"
                    :key="edit.tool_use_id"
                    :file="edit.input?.file_path || edit.input?.command || 'unknown'"
                    :tool-name="edit.name"
                    :input="edit.input"
                />
            </div>
        </div>

        <!-- User avatar -->
        <div v-if="isUser" class="w-8 h-8 rounded-full bg-sky-500 flex items-center justify-center flex-shrink-0 mt-1">
            <UIcon name="i-lucide-user" class="text-white w-4 h-4" />
        </div>
    </div>
</template>

<style scoped>
.prose :deep(pre) {
    background: rgb(15 23 42);
    border: 1px solid rgb(51 65 85);
    border-radius: 0.5rem;
    overflow-x: auto;
    padding: 0.75rem;
    margin: 0.5rem 0;
    position: relative;
}

.prose :deep(code) {
    font-size: 0.8em;
    background: rgb(30 41 59);
    padding: 0.125rem 0.25rem;
    border-radius: 0.25rem;
}

.prose :deep(pre code) {
    background: none;
    padding: 0;
    border-radius: 0;
}

.prose :deep(p) {
    margin: 0.25rem 0;
}

.prose :deep(ul), .prose :deep(ol) {
    margin: 0.25rem 0;
    padding-left: 1.25rem;
}

.prose :deep(a) {
    color: rgb(96 165 250);
    text-decoration: underline;
}
</style>

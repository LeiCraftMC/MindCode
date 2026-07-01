<script setup lang="ts">
const props = defineProps<{
    toolName: string;
    input?: Record<string, any>;
    result?: string;
    isError?: boolean;
}>();

const expanded = ref(false);

// A short, human-readable label for the tool-call header, derived from whichever
// input field best identifies the call (works for any tool, not just file edits).
const label = computed(() => {
    const i = props.input || {};
    return i.file_path || i.path || i.command || i.pattern || i.query
        || i.subject || i.url || i.prompt || i.description || props.toolName;
});

const icon = computed(() => {
    switch (props.toolName) {
        case 'Edit': return 'i-lucide-file-pen';
        case 'Write': return 'i-lucide-file-plus';
        case 'Read': return 'i-lucide-file-text';
        case 'Bash': return 'i-lucide-terminal';
        case 'Grep':
        case 'Glob': return 'i-lucide-search';
        case 'Task': return 'i-lucide-bot';
        case 'TodoWrite': return 'i-lucide-list-checks';
        default:
            return props.toolName.startsWith('mcp__') ? 'i-lucide-plug' : 'i-lucide-wrench';
    }
});

const iconClass = computed(() => {
    switch (props.toolName) {
        case 'Edit': return 'text-primary-400';
        case 'Write': return 'text-success';
        case 'Bash': return 'text-slate-400';
        default: return 'text-slate-400';
    }
});


const prettyInput = computed(() => {
    try {
        return JSON.stringify(props.input ?? {}, null, 2);
    } catch {
        return String(props.input);
    }
});

const hasExpandable = computed(() => !!props.input || !!props.result);
</script>

<template>
    <div class="border border-slate-700/50 rounded-lg overflow-hidden bg-slate-900/60">
        <!-- Header -->
        <button
            class="w-full flex items-center gap-2 px-3 py-2 text-xs font-mono hover:bg-slate-800/40 transition-colors"
            :disabled="!hasExpandable"
            @click="expanded = !expanded"
        >
            <UIcon
                :name="expanded ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
                class="w-3.5 h-3.5 text-slate-500 flex-shrink-0"
                :class="{ 'opacity-0': !hasExpandable }"
            />
            <UIcon :name="icon" :class="['w-4 h-4 flex-shrink-0', iconClass]" />
            <span class="text-slate-300 truncate flex-1 text-left">{{ label }}</span>
            <UIcon
                v-if="isError"
                name="i-lucide-circle-alert"
                class="w-3.5 h-3.5 text-error flex-shrink-0"
            />
            <span class="text-slate-600 flex-shrink-0">{{ toolName }}</span>
        </button>

        <!-- Expanded content -->
        <div v-if="expanded && hasExpandable" class="border-t border-slate-800 p-3 space-y-2">
            <!-- Command (Bash) -->
            <template v-if="toolName === 'Bash'">
                <div class="text-xs text-slate-500 mb-1">Command:</div>
                <pre class="text-xs text-success bg-black/40 p-2 rounded font-mono overflow-x-auto whitespace-pre-wrap">{{ input?.command }}</pre>
            </template>

            <!-- File content (Write) -->
            <template v-else-if="toolName === 'Write'">
                <div class="text-xs text-slate-500 mb-1">Content:</div>
                <pre class="text-xs text-slate-200 bg-black/40 p-2 rounded font-mono overflow-x-auto whitespace-pre-wrap max-h-60 overflow-y-auto">{{ input?.content }}</pre>
            </template>

            <!-- File edit (Edit) -->
            <template v-else-if="toolName === 'Edit'">
                <div v-if="input?.old_string" class="space-y-1">
                    <div class="text-xs text-red-400 font-medium">Removed:</div>
                    <pre class="text-xs text-red-300 bg-red-950/40 p-2 rounded font-mono overflow-x-auto whitespace-pre-wrap line-through">{{ input.old_string }}</pre>
                </div>
                <div v-if="input?.new_string" class="space-y-1">
                    <div class="text-xs text-green-400 font-medium">Added:</div>
                    <pre class="text-xs text-green-300 bg-green-950/40 p-2 rounded font-mono overflow-x-auto whitespace-pre-wrap">{{ input.new_string }}</pre>
                </div>
            </template>

            <!-- Read -->
            <template v-else-if="toolName === 'Read'">
                <div class="text-xs text-slate-500 mb-1">File read:</div>
                <pre class="text-xs text-slate-300 bg-black/40 p-2 rounded font-mono overflow-x-auto whitespace-pre-wrap">{{ input?.file_path || label }}</pre>
            </template>

            <!-- Generic tool input -->
            <template v-else-if="input">
                <div class="text-xs text-slate-500 mb-1">Input:</div>
                <pre class="text-xs text-slate-300 bg-black/40 p-2 rounded font-mono overflow-x-auto whitespace-pre-wrap max-h-60 overflow-y-auto">{{ prettyInput }}</pre>
            </template>

            <!-- Tool result (any tool) -->
            <template v-if="result">
                <div class="text-xs mb-1" :class="isError ? 'text-error' : 'text-slate-500'">
                    {{ isError ? 'Error:' : 'Result:' }}
                </div>
                <pre
                    class="text-xs bg-black/40 p-2 rounded font-mono overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto"
                    :class="isError ? 'text-red-300' : 'text-slate-400'"
                >{{ result }}</pre>
            </template>
        </div>
    </div>
</template>

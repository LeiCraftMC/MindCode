<script setup lang="ts">
const props = defineProps<{
    toolName: string;
    input?: Record<string, any>;
    result?: string;
    isError?: boolean;
}>();

const expanded = ref(false);

// Short label identifying what the tool call is acting on.
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

// Color-coded bubble style: success-ish for writes/edits, neutral for reads, amber for bash.
const chipColor = computed(() => {
    if (props.isError) return 'error';
    switch (props.toolName) {
        case 'Edit': return 'success';
        case 'Write': return 'success';
        case 'Read': return 'neutral';
        case 'Bash': return 'warning';
        default: return 'neutral';
    }
});

const hasExpandable = computed(() => !!props.input || !!props.result);

const prettyInput = computed(() => {
    try {
        return JSON.stringify(props.input ?? {}, null, 2);
    } catch {
        return String(props.input);
    }
});
</script>

<template>
    <div>
        <!-- Compact status chip -->
        <button
            class="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs border transition-colors"
            :class="[
                chipColor === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-300 hover:bg-green-500/15' :
                chipColor === 'warning' ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/15' :
                chipColor === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-300 hover:bg-red-500/15' :
                                         'bg-slate-800/60 border-slate-700/50 text-slate-300 hover:bg-slate-800'
            ]"
            :disabled="!hasExpandable"
            @click="expanded = !expanded"
        >
            <UIcon
                :name="expanded ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
                class="w-3 h-3 flex-shrink-0 opacity-80"
                :class="{ 'opacity-0': !hasExpandable }"
            />
            <UIcon :name="icon" class="w-3.5 h-3.5 flex-shrink-0" />
            <span class="font-mono truncate max-w-[260px] sm:max-w-[360px] text-left">{{ label }}</span>
            <UIcon
                v-if="isError"
                name="i-lucide-circle-alert"
                class="w-3.5 h-3.5 flex-shrink-0"
            />
            <span class="text-[10px] opacity-70 flex-shrink-0">{{ toolName }}</span>
        </button>

        <!-- Expanded detail panel -->
        <div
            v-if="expanded && hasExpandable"
            class="mt-2 border border-slate-700/50 rounded-lg bg-slate-900/60 overflow-hidden"
        >
            <div class="p-3 space-y-2 text-xs">
                <!-- Bash command -->
                <template v-if="toolName === 'Bash'">
                    <div class="text-slate-500">Command:</div>
                    <pre class="font-mono text-success bg-black/40 p-2 rounded overflow-x-auto whitespace-pre-wrap">{{ input?.command }}</pre>
                </template>

                <!-- Write file content -->
                <template v-else-if="toolName === 'Write'">
                    <div class="text-slate-500">Content:</div>
                    <pre class="font-mono text-slate-200 bg-black/40 p-2 rounded overflow-x-auto whitespace-pre-wrap max-h-60">{{ input?.content }}</pre>
                </template>

                <!-- Edit diff -->
                <template v-else-if="toolName === 'Edit'">
                    <div v-if="input?.old_string" class="space-y-1">
                        <div class="text-red-400 font-medium">Removed:</div>
                        <pre class="font-mono text-red-300 bg-red-950/40 p-2 rounded overflow-x-auto whitespace-pre-wrap line-through">{{ input.old_string }}</pre>
                    </div>
                    <div v-if="input?.new_string" class="space-y-1">
                        <div class="text-green-400 font-medium">Added:</div>
                        <pre class="font-mono text-green-300 bg-green-950/40 p-2 rounded overflow-x-auto whitespace-pre-wrap">{{ input.new_string }}</pre>
                    </div>
                </template>

                <!-- Read -->
                <template v-else-if="toolName === 'Read'">
                    <div class="text-slate-500">File read:</div>
                    <pre class="font-mono text-slate-300 bg-black/40 p-2 rounded overflow-x-auto whitespace-pre-wrap">{{ input?.file_path || label }}</pre>
                </template>

                <!-- Generic input -->
                <template v-else-if="input">
                    <div class="text-slate-500">Input:</div>
                    <pre class="font-mono text-slate-300 bg-black/40 p-2 rounded overflow-x-auto whitespace-pre-wrap max-h-60">{{ prettyInput }}</pre>
                </template>

                <!-- Result -->
                <template v-if="result">
                    <div :class="isError ? 'text-error' : 'text-slate-500'">
                        {{ isError ? 'Error:' : 'Result:' }}
                    </div>
                    <pre
                        class="font-mono bg-black/40 p-2 rounded overflow-x-auto whitespace-pre-wrap max-h-48"
                        :class="isError ? 'text-red-300' : 'text-slate-400'"
                    >{{ result }}</pre>
                </template>
            </div>
        </div>
    </div>
</template>

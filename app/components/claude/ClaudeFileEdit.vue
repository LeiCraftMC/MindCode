<script setup lang="ts">
const props = defineProps<{
    toolName: string;
    input?: Record<string, any>;
    result?: string;
    isError?: boolean;
}>();

const expanded = ref(false);

const description = computed(() => {
    const i = props.input || {};
    switch (props.toolName) {
        case 'Edit': return 'Edit';
        case 'Write': return 'Write';
        case 'Read': return 'Read';
        case 'Bash': return 'Bash';
        case 'Grep': return 'Grep';
        case 'Glob': return 'Glob';
        case 'Task': return 'Task';
        case 'TodoWrite': return 'Update todos';
        default:
            if (props.toolName.startsWith('mcp__')) return 'MCP';
            return props.toolName;
    }
});

// Target/path/detail shown next to the action label in a muted color.
const detail = computed(() => {
    const i = props.input || {};
    if (props.toolName === 'Bash') return i.description || i.command || '';
    if (props.toolName === 'Grep' || props.toolName === 'Glob') return i.pattern || i.query || '';
    if (props.toolName === 'Task') return i.description || i.prompt || '';
    if (props.toolName === 'TodoWrite') return '';
    return i.file_path || i.path || i.command || i.pattern || i.query || i.subject || i.url || i.prompt || i.description || '';
});

const resultSummary = computed(() => {
    if (props.toolName === 'Read') return '';
    if (!props.result) return '';
    if (props.isError) return 'Error';
    const lines = props.result.split('\n').length;
    return `${lines} line${lines === 1 ? '' : 's'}`;
});

// Claude Code-style status dot: green on success, red on error, grey while running/pending.
const statusColor = computed(() => {
    if (props.isError) return 'bg-red-500';
    if (props.result === undefined) return 'bg-slate-400';
    return 'bg-green-500';
});

const statusLabel = computed(() => {
    if (props.isError) return 'Failed';
    if (props.result === undefined) return 'Running';
    return 'Done';
});

// Read tool calls are shown as a simple status line with no details or output.
const hasExpandable = computed(() => props.toolName !== 'Read' && (!!props.input || !!props.result));

const prettyInput = computed(() => {
    try {
        return JSON.stringify(props.input ?? {}, null, 2);
    } catch {
        return String(props.input);
    }
});
</script>

<template>
    <div class="flex gap-2">
        <!-- Status dot + vertical connector -->
        <div class="flex flex-col items-center flex-shrink-0">
            <div
                class="w-2.5 h-2.5 rounded-full mt-1.5"
                :class="statusColor"
                :title="statusLabel"
            />
            <div class="w-px flex-1 bg-slate-700/50 mt-1 min-h-[12px]" />
        </div>

        <!-- Card -->
        <div class="flex-1 min-w-0 pb-2">
            <button
                class="w-full flex items-center gap-2 text-left text-sm text-slate-200 hover:text-slate-100 transition-colors group"
                :disabled="!hasExpandable"
                @click="expanded = !expanded"
            >
                <span class="font-medium">{{ description }}</span>
                <span
                    v-if="detail"
                    class="text-slate-500 truncate"
                    :title="detail"
                >{{ detail }}</span>

                <span
                    v-if="resultSummary"
                    class="ml-auto text-xs text-slate-500 flex-shrink-0"
                >
                    {{ resultSummary }}
                </span>

                <UIcon
                    :name="expanded ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
                    class="w-3.5 h-3.5 text-slate-500 flex-shrink-0"
                    :class="{ 'opacity-0': !hasExpandable }"
                />
            </button>

            <!-- Expanded details -->
            <div
                v-if="expanded && hasExpandable"
                class="mt-2 space-y-3"
            >
                <!-- Input -->
                <div v-if="input">
                    <div class="text-xs font-medium text-slate-400 mb-1">Input</div>

                    <!-- Bash command -->
                    <template v-if="toolName === 'Bash'">
                        <pre class="text-xs font-mono text-slate-300 bg-slate-900/80 border border-slate-700/50 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">{{ input?.command }}</pre>
                    </template>

                    <!-- Write file content -->
                    <template v-else-if="toolName === 'Write'">
                        <pre class="text-xs font-mono text-slate-300 bg-slate-900/80 border border-slate-700/50 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap max-h-72">{{ input?.content }}</pre>
                    </template>

                    <!-- Edit diff -->
                    <template v-else-if="toolName === 'Edit'">
                        <div v-if="input?.old_string" class="mb-2">
                            <div class="text-[10px] uppercase tracking-wide text-red-400 font-semibold mb-1">Removed</div>
                            <pre class="text-xs font-mono text-red-200 bg-red-950/40 border border-red-900/30 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">{{ input.old_string }}</pre>
                        </div>
                        <div v-if="input?.new_string">
                            <div class="text-[10px] uppercase tracking-wide text-green-400 font-semibold mb-1">Added</div>
                            <pre class="text-xs font-mono text-green-200 bg-green-950/40 border border-green-900/30 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">{{ input.new_string }}</pre>
                        </div>
                    </template>

                    <!-- Generic input -->
                    <template v-else>
                        <pre class="text-xs font-mono text-slate-300 bg-slate-900/80 border border-slate-700/50 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap max-h-72">{{ prettyInput }}</pre>
                    </template>
                </div>

                <!-- Output -->
                <div v-if="result">
                    <div
                        class="text-xs font-medium mb-1"
                        :class="isError ? 'text-red-400' : 'text-slate-400'"
                    >
                        Output
                    </div>
                    <pre
                        class="text-xs font-mono border rounded-lg p-3 overflow-x-auto whitespace-pre-wrap max-h-72"
                        :class="isError
                            ? 'text-red-200 bg-red-950/40 border-red-900/30'
                            : 'text-slate-300 bg-slate-900/80 border-slate-700/50'"
                    >{{ result }}</pre>
                </div>
            </div>
        </div>
    </div>
</template>

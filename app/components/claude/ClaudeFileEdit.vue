<script setup lang="ts">
defineProps<{
    file: string;
    toolName: string;
    input?: Record<string, any>;
}>();

const expanded = ref(false);
</script>

<template>
    <div class="border border-slate-700/50 rounded-lg overflow-hidden bg-slate-900/60 my-2">
        <!-- Header -->
        <button
            class="w-full flex items-center gap-2 px-3 py-2 text-xs font-mono hover:bg-slate-800/40 transition-colors"
            @click="expanded = !expanded"
        >
            <UIcon
                :name="expanded ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
                class="w-3.5 h-3.5 text-slate-500 flex-shrink-0"
            />
            <UIcon
                :name="toolName === 'Edit' ? 'i-lucide-file-edit' : toolName === 'Write' ? 'i-lucide-file-plus' : 'i-lucide-terminal'"
                :class="[
                    'w-4 h-4 flex-shrink-0',
                    toolName === 'Edit' ? 'text-amber-400' : toolName === 'Write' ? 'text-green-400' : 'text-slate-400'
                ]"
            />
            <span class="text-slate-300 truncate flex-1 text-left">{{ file }}</span>
            <span class="text-slate-600 flex-shrink-0">{{ toolName }}</span>
        </button>

        <!-- Expanded content -->
        <div v-if="expanded && input" class="border-t border-slate-800 p-3 space-y-2">
            <!-- Command output (Bash) -->
            <template v-if="toolName === 'Bash'">
                <div class="text-xs text-slate-500 mb-1">Command:</div>
                <pre class="text-xs text-green-300 bg-black/40 p-2 rounded font-mono overflow-x-auto whitespace-pre-wrap">{{ input.command }}</pre>
            </template>

            <!-- File content (Write) -->
            <template v-if="toolName === 'Write'">
                <div class="text-xs text-slate-500 mb-1">Content:</div>
                <pre class="text-xs text-slate-200 bg-black/40 p-2 rounded font-mono overflow-x-auto whitespace-pre-wrap max-h-60 overflow-y-auto">{{ input.content }}</pre>
            </template>

            <!-- File edit (Edit) -->
            <template v-if="toolName === 'Edit'">
                <div v-if="input.old_string" class="space-y-1">
                    <div class="text-xs text-red-400 font-medium">Removed:</div>
                    <pre class="text-xs text-red-300 bg-red-950/40 p-2 rounded font-mono overflow-x-auto whitespace-pre-wrap line-through">{{ input.old_string }}</pre>
                </div>
                <div v-if="input.new_string" class="space-y-1">
                    <div class="text-xs text-green-400 font-medium">Added:</div>
                    <pre class="text-xs text-green-300 bg-green-950/40 p-2 rounded font-mono overflow-x-auto whitespace-pre-wrap">{{ input.new_string }}</pre>
                </div>
            </template>

            <!-- Read file -->
            <template v-if="toolName === 'Read'">
                <div class="text-xs text-slate-500 mb-1">File read:</div>
                <pre class="text-xs text-slate-300 bg-black/40 p-2 rounded font-mono overflow-x-auto whitespace-pre-wrap max-h-40 overflow-y-auto">{{ input.file_path || file }}</pre>
            </template>
        </div>
    </div>
</template>

<script setup lang="ts">
defineProps<{
    lines: string[];
}>();

const terminalRef = ref<HTMLElement | null>(null);

watchEffect(() => {
    if (terminalRef.value) {
        nextTick(() => {
            terminalRef.value!.scrollTop = terminalRef.value!.scrollHeight;
        });
    }
});
</script>

<template>
    <div
        ref="terminalRef"
        class="flex-1 overflow-y-auto bg-black/80 p-4 font-mono text-xs leading-relaxed"
    >
        <div v-for="(line, i) in lines" :key="i" class="text-green-400">
            <span class="text-slate-500 mr-2 select-none">[{{ i + 1 }}]</span>
            <span class="whitespace-pre-wrap">{{ typeof line === 'string' ? line : JSON.stringify(line) }}</span>
        </div>
        <div v-if="!lines.length" class="text-slate-600 italic">
            Waiting for output...
        </div>
    </div>
</template>

<script setup lang="ts">
import { onKeyStroke } from '@vueuse/core';

const props = defineProps<{
    modelValue: boolean;
    changes?: Array<{
        file: string;
        toolName: string;
        added?: number;
        removed?: number;
    }>;
}>();

const emit = defineEmits<{
    'update:modelValue': [value: boolean];
}>();

const filterOptions = ['Changes of last turn', 'All changes', 'Git changes'];
const selectedFilter = ref(filterOptions[0]);

// Close the mobile sheet on Escape.
onKeyStroke('Escape', () => {
    if (props.modelValue) emit('update:modelValue', false);
});
</script>

<template>
    <!-- Desktop: right panel -->
    <aside class="hidden xl:flex flex-col w-80 border-l border-slate-800 bg-slate-950 h-full">
        <div class="p-3 border-b border-slate-800 flex items-center justify-between">
            <span class="text-sm font-semibold text-slate-300">Review</span>
            <div class="flex items-center gap-1">
                <UButton icon="i-lucide-plus" color="neutral" variant="ghost" size="xs" />
            </div>
        </div>

        <div class="p-3 border-b border-slate-800">
            <USelect
                v-model="selectedFilter"
                :items="filterOptions"
                color="neutral"
                size="xs"
                class="w-full"
            />
        </div>

        <div class="flex-1 overflow-y-auto p-3">
            <div v-if="!changes?.length" class="text-sm text-slate-600 text-center py-8">
                No changes
            </div>

            <div v-else class="space-y-2">
                <div
                    v-for="(change, i) in changes"
                    :key="i"
                    class="p-2 rounded-lg bg-slate-900/60 border border-slate-800 text-sm"
                >
                    <div class="flex items-center gap-2 mb-1">
                        <UIcon
                            :name="change.toolName === 'Edit' ? 'i-lucide-file-edit' : 'i-lucide-file-plus'"
                            class="w-4 h-4 text-slate-500"
                        />
                        <span class="truncate flex-1 text-slate-300">{{ change.file }}</span>
                    </div>
                    <div class="flex items-center gap-2 text-[10px]">
                        <span v-if="change.added" class="text-green-400">+{{ change.added }}</span>
                        <span v-if="change.removed" class="text-red-400">-{{ change.removed }}</span>
                    </div>
                </div>
            </div>
        </div>
    </aside>

    <!-- Mobile: bottom sheet -->
    <Teleport to="body">
        <div
            v-if="modelValue"
            class="fixed inset-0 bg-black/50 z-50 xl:hidden"
            @click="emit('update:modelValue', false)"
        />

        <div
            role="dialog"
            aria-modal="true"
            aria-label="Review changes"
            :aria-hidden="!modelValue"
            :class="[
                'fixed z-50 left-0 right-0 bottom-0 bg-slate-950 border-t border-slate-800 rounded-t-2xl overflow-hidden xl:hidden transition-transform duration-300',
                modelValue ? 'translate-y-0' : 'translate-y-full'
            ]"
        >
            <div class="p-4 border-b border-slate-800 flex items-center justify-between">
                <div class="w-8 h-1 rounded-full bg-slate-600 mx-auto absolute left-1/2 -translate-x-1/2 top-2" />
                <span class="text-sm font-semibold text-slate-300">Review</span>
                <UButton icon="i-lucide-x" color="neutral" variant="ghost" size="xs" @click="emit('update:modelValue', false)" />
            </div>

            <div class="p-3 border-b border-slate-800">
                <USelect
                    v-model="selectedFilter"
                    :items="filterOptions"
                    color="neutral"
                    size="xs"
                    class="w-full"
                />
            </div>

            <div class="p-3 max-h-[60vh] overflow-y-auto">
                <div v-if="!changes?.length" class="text-sm text-slate-600 text-center py-8">
                    No changes
                </div>
                <div v-else class="space-y-2">
                    <div
                        v-for="(change, i) in changes"
                        :key="i"
                        class="p-2 rounded-lg bg-slate-900/60 border border-slate-800 text-sm"
                    >
                        <div class="flex items-center gap-2 mb-1">
                            <UIcon
                                :name="change.toolName === 'Edit' ? 'i-lucide-file-edit' : 'i-lucide-file-plus'"
                                class="w-4 h-4 text-slate-500"
                            />
                            <span class="truncate flex-1 text-slate-300">{{ change.file }}</span>
                        </div>
                        <div class="flex items-center gap-2 text-[10px]">
                            <span v-if="change.added" class="text-green-400">+{{ change.added }}</span>
                            <span v-if="change.removed" class="text-red-400">-{{ change.removed }}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </Teleport>
</template>

<script setup lang="ts">
import { onKeyStroke } from '@vueuse/core';

export interface ClaudeConfig {
    model: string;
    effort: string;
    thinking: boolean;
    autoFlag: boolean;
    editAuto: boolean;
}

const props = defineProps<{
    modelValue: boolean;
    config: ClaudeConfig;
    availableModels?: string[];
    usage?: { costUsd: number; turns: number };
}>();

const emit = defineEmits<{
    'update:modelValue': [value: boolean];
    'update:config': [config: Partial<ClaudeConfig>];
}>();

const effortLevels = ['low', 'medium', 'high', 'xhigh', 'max'];

const MODELS: Array<{ id: string; label: string; hint: string }> = [
    { id: 'haiku', label: 'Haiku', hint: 'Fastest' },
    { id: 'sonnet', label: 'Sonnet', hint: 'Balanced' },
    { id: 'opus', label: 'Opus', hint: 'Most capable' },
];

function formatCost(usd: number): string {
    if (!usd) return '$0.00';
    return usd < 0.01 ? `$${usd.toFixed(4)}` : `$${usd.toFixed(2)}`;
}

function update(field: keyof ClaudeConfig, value: any) {
    emit('update:config', { [field]: value });
}

// Close on Escape for keyboard / screen-reader users.
onKeyStroke('Escape', () => {
    if (props.modelValue) emit('update:modelValue', false);
});
</script>

<template>
    <Teleport to="body">
        <!-- Background overlay -->
        <div
            v-if="modelValue"
            class="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4"
            @click="emit('update:modelValue', false)"
        >
            <!-- Centered menu card -->
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Session configuration"
                class="w-full max-w-md bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden"
                @click.stop
            >
                <!-- Context Section -->
                <div class="p-4 sm:p-5">
                    <h3 class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Context</h3>
                    <div class="space-y-1">
                        <button class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-primary-500/15 hover:text-primary-300 transition-colors text-left">
                            <UIcon name="i-lucide-paperclip" class="w-4 h-4" />
                            Attach file...
                        </button>
                        <button class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm bg-primary-500/15 text-primary-300 transition-colors text-left">
                            <UIcon name="i-lucide-file-search" class="w-4 h-4" />
                            Mention file from this project...
                        </button>
                        <button class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-slate-800/60 transition-colors text-left">
                            <UIcon name="i-lucide-trash-2" class="w-4 h-4" />
                            Clear conversation
                        </button>
                        <button class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-slate-800/60 transition-colors text-left">
                            <UIcon name="i-lucide-undo-2" class="w-4 h-4" />
                            Rewind
                        </button>
                    </div>
                </div>

                <!-- Divider -->
                <div class="border-t border-slate-800" />

                <!-- Model Section -->
                <div class="p-4 sm:p-5">
                    <h3 class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Model</h3>
                    <div class="space-y-4">
                        <!-- Model selector -->
                        <div class="grid grid-cols-3 gap-2">
                            <button
                                v-for="m in MODELS"
                                :key="m.id"
                                :title="m.hint"
                                :class="[
                                    'flex flex-col items-center gap-0.5 px-2 py-2 rounded-lg border text-sm transition-colors',
                                    (config.model || 'sonnet') === m.id
                                        ? 'bg-primary-500/15 border-primary-500/40 text-primary-300'
                                        : 'border-slate-700/50 text-slate-300 hover:bg-slate-800/60'
                                ]"
                                @click="update('model', m.id)"
                            >
                                <span class="font-medium">{{ m.label }}</span>
                                <span class="text-[10px] text-slate-500">{{ m.hint }}</span>
                            </button>
                        </div>

                        <!-- Effort slider -->
                        <div class="px-1">
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-sm text-slate-300">Effort ({{ config.effort }})</span>
                            </div>
                            <div class="flex items-center gap-3">
                                <input
                                    type="range"
                                    :min="0"
                                    :max="effortLevels.length - 1"
                                    :value="effortLevels.indexOf(config.effort)"
                                    class="flex-1 accent-primary-500 h-1.5"
                                    @input="(e: any) => update('effort', effortLevels[parseInt(e.target.value)])"
                                />
                            </div>
                        </div>

                        <!-- Thinking toggle -->
                        <div class="flex items-center justify-between px-1">
                            <span class="text-sm text-slate-300">Thinking</span>
                            <UToggle
                                :model-value="config.thinking"
                                @update:model-value="(v: boolean) => update('thinking', v)"
                            />
                        </div>

                        <!-- Auto-flag toggle -->
                        <div class="flex items-center justify-between px-1">
                            <span class="text-sm text-slate-300">Switch models when a message is flagged</span>
                            <UToggle
                                :model-value="config.autoFlag"
                                @update:model-value="(v: boolean) => update('autoFlag', v)"
                            />
                        </div>

                        <!-- Session usage -->
                        <div class="flex items-center justify-between px-3 py-2 bg-slate-800/40 rounded-lg text-sm">
                            <span class="flex items-center gap-2 text-slate-400">
                                <UIcon name="i-lucide-credit-card" class="w-4 h-4" />
                                Session usage
                            </span>
                            <span class="text-slate-300 font-mono text-xs">
                                {{ formatCost(usage?.costUsd || 0) }} · {{ usage?.turns || 0 }} turn{{ (usage?.turns || 0) === 1 ? '' : 's' }}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </Teleport>
</template>

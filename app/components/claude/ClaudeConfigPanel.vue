<script setup lang="ts">
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
}>();

const emit = defineEmits<{
    'update:modelValue': [value: boolean];
    'update:config': [config: Partial<ClaudeConfig>];
}>();

const effortLevels = ['low', 'medium', 'high', 'xhigh', 'max'];

function update(field: keyof ClaudeConfig, value: any) {
    emit('update:config', { [field]: value });
}
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
                        <!-- Model selector button -->
                        <button class="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800/60 transition-colors">
                            <span class="flex items-center gap-2">
                                <UIcon name="i-lucide-layers" class="w-4 h-4" />
                                Switch model...
                            </span>
                            <span class="text-slate-500">{{ config.model || 'LeiAI Pro Max - Code' }}</span>
                        </button>

                        <!-- Active model display -->
                        <div class="flex items-center justify-between px-3 py-2 bg-slate-800/40 rounded-lg">
                            <span class="text-sm text-slate-300">{{ config.model || 'LeiAI Pro - Code' }}</span>
                            <UBadge size="xs" color="primary" variant="soft">Active</UBadge>
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

                        <!-- Account link -->
                        <button class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-slate-800/60 transition-colors text-left">
                            <UIcon name="i-lucide-credit-card" class="w-4 h-4" />
                            Account & usage...
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </Teleport>
</template>

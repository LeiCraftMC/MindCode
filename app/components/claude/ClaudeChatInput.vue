<script setup lang="ts">
import type { SlashCommand } from '~/composables/useClaudeWebSocket';

const model = defineModel<string>({ required: true });

const props = defineProps<{
    disabled?: boolean;
    placeholder?: string;
    slashCommands?: readonly SlashCommand[];
}>();

const emit = defineEmits<{
    submit: [];
    mentionFile: [];
}>();

const textareaRef = ref<HTMLTextAreaElement | null>(null);
const slashMenu = reactive({ show: false, filter: '', selectedIndex: 0 });
const inputContainerRef = ref<HTMLDivElement | null>(null);

// Filtered slash commands based on input
const filteredCommands = computed(() => {
    if (!props.slashCommands?.length) return [];
    const filter = slashMenu.filter.toLowerCase();
    return props.slashCommands.filter(cmd =>
        cmd.name.toLowerCase().includes(filter) ||
        cmd.description.toLowerCase().includes(filter)
    );
});

// Watch for slash character
watch(model, (val) => {
    if (val.startsWith('/')) {
        const afterSlash = val.slice(1).split(' ')[0];
        slashMenu.filter = afterSlash;
        slashMenu.show = true;
        slashMenu.selectedIndex = 0;
    } else {
        slashMenu.show = false;
    }
});

function selectCommand(cmd: SlashCommand) {
    model.value = `/${cmd.name} `;
    slashMenu.show = false;
    textareaRef.value?.focus();
}

function onKeydown(e: KeyboardEvent) {
    if (slashMenu.show && filteredCommands.value.length > 0) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            slashMenu.selectedIndex = Math.min(slashMenu.selectedIndex + 1, filteredCommands.value.length - 1);
            return;
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            slashMenu.selectedIndex = Math.max(slashMenu.selectedIndex - 1, 0);
            return;
        }
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            selectCommand(filteredCommands.value[slashMenu.selectedIndex]);
            return;
        }
        if (e.key === 'Escape') {
            slashMenu.show = false;
            return;
        }
    }

    // Submit on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onSubmit();
    }
}

function onSubmit() {
    if (model.value.trim() && !props.disabled) {
        slashMenu.show = false;
        emit('submit');
    }
}

function onMentionClick() {
    if (!model.value.trim()) {
        model.value = '/';
    } else {
        model.value += ' @';
    }
    textareaRef.value?.focus();
}

// Auto-resize textarea
function autoResize() {
    if (textareaRef.value) {
        textareaRef.value.style.height = 'auto';
        textareaRef.value.style.height = Math.min(textareaRef.value.scrollHeight, 200) + 'px';
    }
}

watch(model, () => {
    nextTick(autoResize);
});
</script>

<template>
    <div ref="inputContainerRef" class="border-t border-slate-800 bg-slate-900/80 p-3 sm:p-4 relative">
        <!-- Slash command menu (positioned above input) -->
        <teleport to="body">
            <div
                v-if="slashMenu.show && filteredCommands.length > 0"
                class="fixed z-100 px-4"
                :style="{ left: '50%', bottom: '120px', transform: 'translateX(-50%)' }"
            >
                <div class="w-full max-w-md bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                    <button
                        v-for="(cmd, i) in filteredCommands"
                        :key="cmd.name"
                        :class="[
                            'w-full text-left px-4 py-2.5 text-sm flex items-center gap-3 transition-colors border-b border-slate-700/50 last:border-b-0',
                            i === slashMenu.selectedIndex ? 'bg-primary-500/20 text-primary-300' : 'text-slate-300 hover:bg-slate-700/60'
                        ]"
                        @click="selectCommand(cmd)"
                        @mouseenter="slashMenu.selectedIndex = i"
                    >
                        <span class="font-mono text-primary-400">/{{ cmd.name }}</span>
                        <span class="text-xs text-slate-500 truncate flex-1">{{ cmd.description }}</span>
                        <span v-if="cmd.argumentHint" class="text-[10px] text-slate-600 font-mono">{{ cmd.argumentHint }}</span>
                    </button>
                </div>
            </div>
        </teleport>

        <!-- Input area -->
        <div class="max-w-4xl mx-auto">
            <div
                class="flex items-end gap-2 bg-slate-800/60 border border-slate-700/50 rounded-2xl px-3 py-2 focus-within:border-primary-500/50 focus-within:ring-1 focus-within:ring-primary-500/30 transition-all"
            >
                <!-- Left accessory: mention file -->
                <div class="flex items-center gap-1 pb-1.5">
                    <UButton
                        icon="i-lucide-at-sign"
                        color="neutral"
                        variant="ghost"
                        size="sm"
                        :ui="{ rounded: 'rounded-full' }"
                        title="Mention file"
                        @click="onMentionClick"
                    />
                </div>

                <!-- Textarea -->
                <textarea
                    ref="textareaRef"
                    v-model="model"
                    :disabled="disabled"
                    :placeholder="placeholder || 'Fragen Sie alles...'"
                    rows="1"
                    class="flex-1 bg-transparent px-2 py-2 text-sm text-slate-200 placeholder-slate-500 resize-none outline-none min-h-10 disabled:opacity-50 disabled:cursor-not-allowed"
                    @keydown="onKeydown"
                    @input="autoResize"
                />

                <!-- Right accessory: submit -->
                <div class="flex items-center pb-1.5">
                    <UButton
                        icon="i-lucide-arrow-up"
                        :disabled="disabled || !model.trim()"
                        color="primary"
                        size="md"
                        :ui="{ rounded: 'rounded-full' }"
                        @click="onSubmit"
                    />
                </div>
            </div>
        </div>
    </div>
</template>

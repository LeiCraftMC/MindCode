<script setup lang="ts">
import type { QuestionRequestMessage } from '#shared/types/claude-ws';

const props = defineProps<QuestionRequestMessage>();

const emit = defineEmits<{
    answer: [requestId: string, answers: Record<string, string>, response?: string];
}>();

// Map question text -> selected option label(s)
const selections = ref<Record<string, string | string[]>>({});
const responseText = ref('');
const expandedPreview = ref<string | null>(null);

function isMultiSelect(question: (typeof props.questions)[number]) {
    return question.multiSelect;
}

function toggleOption(questionText: string, label: string) {
    const current = selections.value[questionText];
    if (isMultiSelect(props.questions.find(q => q.question === questionText)!)) {
        const list = Array.isArray(current) ? [...current] : current ? [current as string] : [];
        const idx = list.indexOf(label);
        if (idx >= 0) list.splice(idx, 1);
        else list.push(label);
        selections.value[questionText] = list;
    } else {
        selections.value[questionText] = label;
    }
}

function isSelected(questionText: string, label: string) {
    const current = selections.value[questionText];
    if (Array.isArray(current)) return current.includes(label);
    return current === label;
}

const canSubmit = computed(() => {
    return props.questions.every(q => {
        const s = selections.value[q.question];
        if (Array.isArray(s)) return s.length > 0;
        return !!s;
    });
});

function formatAnswers(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const q of props.questions) {
        const s = selections.value[q.question];
        out[q.question] = Array.isArray(s) ? s.join(', ') : (s as string) || '';
    }
    return out;
}

function submit() {
    emit('answer', props.requestId, formatAnswers(), responseText.value.trim() || undefined);
}
</script>

<template>
    <div class="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4 my-2">
        <div class="flex items-start gap-3">
            <UIcon name="i-lucide-message-circle-question" class="w-5 h-5 text-indigo-400 mt-0.5 flex-shrink-0" />
            <div class="flex-1 min-w-0 space-y-4">
                <div
                    v-for="question in questions"
                    :key="question.question"
                    class="space-y-2"
                >
                    <div class="text-sm font-medium text-indigo-100">
                        {{ question.question }}
                    </div>
                    <div class="space-y-1.5">
                        <button
                            v-for="option in question.options"
                            :key="option.label"
                            type="button"
                            class="w-full text-left px-3 py-2 rounded-lg border text-xs transition-colors flex items-start gap-2"
                            :class="[
                                isSelected(question.question, option.label)
                                    ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-100'
                                    : 'bg-slate-900/40 border-slate-700/50 text-slate-300 hover:bg-slate-800/60'
                            ]"
                            @click="toggleOption(question.question, option.label)"
                            @mouseenter="expandedPreview = option.preview || null"
                            @mouseleave="expandedPreview = null"
                        >
                            <UIcon
                                :name="isMultiSelect(question) ? 'i-lucide-square-check' : 'i-lucide-circle-dot'"
                                class="w-4 h-4 flex-shrink-0 mt-0.5"
                                :class="isSelected(question.question, option.label) ? 'text-indigo-400' : 'text-slate-500'"
                            />
                            <div class="flex-1 min-w-0">
                                <div class="font-medium">{{ option.label }}</div>
                                <div class="text-[11px] text-slate-500 mt-0.5">{{ option.description }}</div>
                            </div>
                        </button>
                    </div>
                    <div
                        v-if="expandedPreview"
                        class="text-xs text-slate-400 bg-slate-900/60 border border-slate-700/50 rounded-lg p-2"
                    >
                        {{ expandedPreview }}
                    </div>
                </div>

                <div>
                    <UTextarea
                        v-model="responseText"
                        placeholder="Optional additional comment..."
                        :rows="2"
                        variant="none"
                        color="neutral"
                        class="text-xs"
                        :ui="{ base: 'px-3 py-2 bg-slate-900/60 border border-slate-700/50 rounded-lg text-slate-200 placeholder-slate-500 resize-none outline-none focus:ring-1 focus:ring-indigo-500/30' }"
                    />
                </div>

                <div class="flex items-center gap-2">
                    <UButton
                        color="primary"
                        size="sm"
                        :disabled="!canSubmit"
                        @click="submit"
                    >
                        Answer
                    </UButton>
                </div>
            </div>
        </div>
    </div>
</template>

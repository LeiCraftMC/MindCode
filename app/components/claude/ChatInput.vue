<script setup lang="ts">
const model = defineModel<string>({ required: true });

const props = defineProps<{
    disabled?: boolean;
    placeholder?: string;
}>();

const emit = defineEmits<{
    submit: [];
}>();

function onSubmit() {
    if (model.value.trim() && !props.disabled) {
        emit('submit');
    }
}
</script>

<template>
    <div class="border-t border-slate-800 p-4">
        <div class="flex gap-2 items-end">
            <UInput
                v-model="model"
                :disabled="disabled"
                :placeholder="placeholder || 'Ask Claude to do something...'"
                class="flex-1"
                size="lg"
                variant="outline"
                @keydown.enter.prevent="onSubmit"
            />
            <UButton
                icon="i-lucide-send"
                :disabled="disabled || !model.trim()"
                color="primary"
                size="lg"
                @click="onSubmit"
            />
        </div>
    </div>
</template>

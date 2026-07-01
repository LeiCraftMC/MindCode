<script setup lang="ts">
interface Props {
    content: string;
}

defineProps<Props>();
</script>

<template>
    <div class="comark-content text-sm sm:text-base text-slate-200 leading-relaxed break-words">
        <Comark :markdown="content" />
    </div>
</template>

<style scoped>
.comark-content :deep(p) {
    margin: 0;
}
.comark-content :deep(p:first-child) {
    margin-top: 0;
}
.comark-content :deep(p:last-child) {
    margin-bottom: 0;
}
</style>
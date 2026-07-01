<script setup lang="ts">
interface Props {
    content: string;
}

defineProps<Props>();
</script>

<template>
    <Comark :markdown="content"  />
</template>

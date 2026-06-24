<script setup lang="ts">

definePageMeta({
    layout: 'dashboard',
});

const absolute_path = decodeURIComponent(useRoute().params.absolute_path as string);

await navigateTo(`/projects/${encodeURIComponent(absolute_path)}/sessions/new`, { replace: true });

</script>

<template></template>
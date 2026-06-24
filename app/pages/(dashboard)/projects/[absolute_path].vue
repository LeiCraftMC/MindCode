<script setup lang="ts">
import { useSelectedProjectStore } from '~/composables/stores/useSelectedProjectStore';
import type { ProjectWithSessions } from '~/utils/types';

definePageMeta({
    layout: 'dashboard',
});

const absolute_path = decodeURIComponent(useRoute().params.absolute_path as string);

let error = null;

const selectedProjectStore = await useSelectedProjectStore();

await selectedProjectStore.set(absolute_path);

const project = await selectedProjectStore.use();

if (!project) {
    error = createError({
        statusCode: 404,
        statusMessage: 'Project Not Found',
        message: `The project with path ${absolute_path} could not be found. It may have been deleted.`
    });
} else {
    
    useSubrouterInjectedData<ProjectWithSessions>('project').provide({
        data: project as Ref<ProjectWithSessions>,
        refresh: selectedProjectStore.refresh,
        loading: selectedProjectStore.isLoading,
    });

}
</script>

<template>
    <NuxtPage v-if="!error" />

    <UDashboardPanel v-else-if="error">

        <template #body>
            <div class="flex flex-col gap-4 sm:gap-6 lg:gap-12 w-full">
                <UError :error="error" />
            </div>
        </template>

    </UDashboardPanel>

</template>
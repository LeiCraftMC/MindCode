<script setup lang="ts">
import type { GetAdminOsReleasesResponses } from '~/api-client'
import type { TableColumn } from '@nuxt/ui'
import DashboardPageHeader from '~/components/dashboard/DashboardPageHeader.vue';
import DashboardPageBody from '~/components/dashboard/DashboardPageBody.vue';

const toast = useToast()

type OSRelease = GetAdminOsReleasesResponses["200"]["data"][number];

definePageMeta({
    layout: 'dashboard'
});

useSeoMeta({
    title: 'OS Releases | LeiOS Hub',
    description: 'Manage OS Releases on LeiOS Hub'
});

const { data: osReleases, loading, refresh } = await useAPIAsyncData<OSRelease[]>(
    '/admin/os-releases',
    async () => {
        const res = await useAPI((api) => api.getAdminOsReleases({}))
        if (!res.success) {
            toast.add({ title: 'Failed to load OS Releases', description: res.message, color: 'error' })
            return []
        }
        return res.data;

        // for (let i = 0; i < 200; i++) {
        //     res.data.push({
        //         id: i,
        //         version: `2025.${String(Math.floor(i / 28) + 1).padStart(2, '0')}.${String((i % 28) + 1).padStart(2, '0')}`,
        //         created_at: Date.now() - i * 1000 * 60 * 60 * 24,
        //         published_at: Date.now() - i * 1000 * 60 * 60 * 24,
        //         publishing_status: (['pending', 'running', 'paused', 'completed', 'failed'] satisfies OSRelease['publishing_status'][])[Math.floor(Math.random() * 1000) % 5] as OSRelease['publishing_status'],
        //     });
        // }
        // return res.data;
    }
);

const osReleasesTableColumns: TableColumn<OSRelease>[] = [
    { accessorKey: 'version' , header: 'Version' },
    { accessorKey: 'created_at', header: 'Created At' },
    { accessorKey: 'publishing_status', header: 'Publishing Status' },
    { accessorKey: 'published_at', header: 'Published At' },
]

function getPublishingStatusColor(status: OSRelease['publishing_status']) {
    switch (status) {
        case 'pending':
            return 'warning'
        case 'paused':
            return 'warning'
        case 'completed':
            return 'success'
        case 'failed':
            return 'error'
        case 'running':
            return 'info'
    }
}

// Filter options for publishing status
const publishingStatusOptions = [
    { label: 'Pending', value: 'pending' },
    { label: 'Running', value: 'running' },
    { label: 'Paused', value: 'paused' },
    { label: 'Completed', value: 'completed' },
    { label: 'Failed', value: 'failed' },
]

</script>

<template>
    <UDashboardPanel>
        <template #header>
            <!-- <UDashboardNavbar title="OS Releases" icon="i-lucide-rocket">
                <template #trailing>
                    <span class="text-slate-400 hidden sm:inline"> | Manage all OS releases</span>
                </template>
            </UDashboardNavbar> -->
            <DashboardPageHeader
                title="OS Releases"
                icon="i-lucide-rocket"
                description="Manage all OS releases"
            />
        </template>

        <template #body>
            <DashboardPageBody>
                <DashboardDataTable
                    :data="osReleases"
                    :columns="osReleasesTableColumns"
                    :loading="loading"
                    :filters="[
                        { 
                            column: 'version', 
                            type: 'text',
                            placeholder: 'Search version...', 
                            icon: 'i-lucide-search' 
                        },
                        { 
                            column: 'publishing_status', 
                            type: 'multi-select',
                            placeholder: 'All statuses',
                            icon: 'i-lucide-filter',
                            options: publishingStatusOptions
                        }
                    ]"
                    empty-title="No releases"
                    empty-description="Create the first release to get started."
                    empty-icon="i-lucide-rocket"
                    @refresh="refresh()"
                >
                    <template #header-right>
                        <UButton
                            label="New Release"
                            icon="i-lucide-plus"
                            color="primary"
                            to="/dashboard/admin/os-releases/new"
                        />
                    </template>

                    <template #version-cell="{ row }">
                        <NuxtLink
                            :to="`/dashboard/admin/os-releases/${row.original.version}`"
                            class="font-medium text-primary-400 hover:underline"
                        >
                            {{ row.original.version }}
                        </NuxtLink>
                    </template>

                    <template #created_at-cell="{ row }">
                        <span class="text-sm">
                            {{ new Date(row.original.created_at).toLocaleString() }}
                        </span>
                    </template>

                    <template #publishing_status-cell="{ row }">
                        <UBadge
                            :color="getPublishingStatusColor(row.original.publishing_status) || 'neutral'"
                            variant="subtle"
                            class="capitalize"
                        >
                            {{ row.original.publishing_status || "Unknown" }}
                        </UBadge>
                    </template>
                    
                    <template #published_at-cell="{ row }">
                        <span class="text-sm">{{
                                (row.original.published_at && row.original.publishing_status === 'completed')
                                    ? new Date(row.original.published_at).toLocaleString()
                                    : "N / A"
                        }}</span>
                    </template>

                    <template #empty-actions>
                        <UButton
                            label="Create Release"
                            color="primary"
                            to="/dashboard/admin/os-releases/new"
                        />
                    </template>
                </DashboardDataTable>
            </DashboardPageBody>
        </template>
    </UDashboardPanel>
</template>

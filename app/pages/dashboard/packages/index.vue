<script setup lang="ts">
import type { TableColumn } from '#ui/types'
import type { GetPackagesResponses } from '@/api-client/types.gen'
import type { Publisher } from '~/utils/types'
import { useAPI } from '@/composables/useAPI'
import DashboardPageBody from '~/components/dashboard/DashboardPageBody.vue'

type DevPackage = GetPackagesResponses[200]['data'][number]

definePageMeta({
    layout: 'dashboard'
})

useSeoMeta({
    title: 'Packages | LeiOS Hub',
    description: 'Manage your packages'
})

const toast = useToast()

const packageTableColumns: TableColumn<DevPackage>[] = [
    { accessorKey: 'fullname', header: 'Name' },
    { accessorKey: 'description', header: 'Description' },
    { accessorKey: 'homepage_url', header: 'Homepage' },
    { accessorKey: 'publisher_id', header: 'Publisher', enableSorting: true },
    { id: 'stable', header: 'Stable' },
    { id: 'testing', header: 'Testing' },
    { id: 'actions', header: '', enableSorting: false, enableHiding: false }
]

const packages = await useAPIAsyncData(
    `/dev/packages`,
    async () => {
        const res = await useAPI((api) => api.getPackages({ query: { onlyMembershipByMe: true } }));
        if (!res.success) {
            toast.add({ title: 'Failed to load packages', description: res.message, color: 'error' })
            return [];
        }
        return res.data;
    }
)

const { data: publishers } = await useAPILazyAsyncData<Publisher[]>(
    'package-publishers-filter',
    async () => {
        const res = await useAPI((api) => api.getPublishers({ query: { onlyMembershipByMe: true } }));
        if (!res.success) return [];
        return res.data;
    }
);

const publisherFilterOptions = computed(() =>
    (publishers.value || []).map(p => ({
        label: p.display_name,
        value: p.id,
    }))
);

const publisherNameById = computed(() => {
    const map: Record<number, string> = {};
    for (const p of (publishers.value || [])) {
        map[p.id] = p.display_name;
    }
    return map;
});


</script>

<template>
    <UDashboardPanel>
        <template #header>
            <DashboardPageHeader
                title="Packages"
                icon="i-lucide-package"
                description="Manage your packages"
            />
        </template>

        <template #body>
            <DashboardPageBody>
                <DashboardDataTable
                    :data="packages.data"
                    :columns="packageTableColumns"
                    :loading="packages.loading"
                    :filters="[
                        {
                            column: 'fullname',
                            type: 'text',
                            placeholder: 'Search packages...',
                            icon: 'i-lucide-search',
                        },
                        {
                            column: 'publisher_id',
                            type: 'select',
                            placeholder: 'All Publishers',
                            icon: 'i-lucide-building',
                            options: publisherFilterOptions,
                        },
                    ]"
                    empty-title="No packages"
                    empty-description="Create the first package to get started."
                    empty-icon="i-lucide-package"
                    @refresh="packages.refresh()"
                >
                    <template #header-right>
                        <UButton
                            label="New Package"
                            icon="i-lucide-plus"
                            color="primary"
                            to="/dashboard/packages/new"
                        />
                    </template>

                    <template #fullname-cell="{ row }">
                        <NuxtLink
                            :to="`/dashboard/packages/${row.original.fullname}`"
                            class="font-medium text-sky-400 hover:underline"
                        >
                            {{ row.original.fullname }}
                        </NuxtLink>
                    </template>

                    <template #description-cell="{ row }">
                        <span class="text-slate-400 line-clamp-1 max-w-xs">
                            {{ row.original.description || '—' }}
                        </span>
                    </template>

                    <template #homepage_url-cell="{ row }">
                        <UButton
                            v-if="row.original.homepage_url"
                            :to="row.original.homepage_url"
                            target="_blank"
                            icon="i-lucide-external-link"
                            variant="ghost"
                            color="neutral"
                            size="xs"
                        />
                        <span v-else class="text-slate-500">—</span>
                    </template>

                    <template #publisher_id-cell="{ row }">
                        <span class="text-slate-400 text-sm">
                            {{ publisherNameById[row.original.publisher_id] || `#${row.original.publisher_id}` }}
                        </span>
                    </template>

                    <template #stable-cell="{ row }">
                        <div class="flex gap-1">
                            <UBadge v-if="row.original.latest_stable_release.amd64" color="success" variant="soft" size="sm">
                                amd64
                            </UBadge>
                            <UBadge v-if="row.original.latest_stable_release.arm64" color="success" variant="soft" size="sm">
                                arm64
                            </UBadge>
                            <span v-if="!row.original.latest_stable_release.amd64 && !row.original.latest_stable_release.arm64" class="text-slate-500">—</span>
                        </div>
                    </template>

                    <template #testing-cell="{ row }">
                        <div class="flex gap-1">
                            <UBadge v-if="row.original.latest_testing_release.amd64" color="warning" variant="soft" size="sm">
                                amd64
                            </UBadge>
                            <UBadge v-if="row.original.latest_testing_release.arm64" color="warning" variant="soft" size="sm">
                                arm64
                            </UBadge>
                            <span v-if="!row.original.latest_testing_release.amd64 && !row.original.latest_testing_release.arm64" class="text-slate-500">—</span>
                        </div>
                    </template>

                    <template #actions-cell="{ row }">
                        <div class="flex gap-1">
                            <UButton
                                icon="i-lucide-upload"
                                variant="ghost"
                                color="neutral"
                                size="xs"
                                :to="`/dashboard/packages/${row.original.fullname}?action=upload`"
                            />
                            <UButton
                                icon="i-lucide-settings"
                                variant="ghost"
                                color="neutral"
                                size="xs"
                                :to="`/dashboard/packages/${row.original.fullname}`"
                            />
                        </div>
                    </template>
                    <template #empty-actions>
                        <UButton
                            label="Create Package"
                            color="primary"
                            to="/dashboard/packages/new"
                        />
                    </template>
                </DashboardDataTable>

            </DashboardPageBody>
        </template>
    </UDashboardPanel>

</template>

<script setup lang="ts">
import type { TableColumn } from '#ui/types'
import type { Publisher } from '~/utils/types'

definePageMeta({
    layout: 'dashboard',
});

useSeoMeta({
    title: 'Publishers | LeiOS Hub',
    description: 'Manage your publishers'
});

const toast = useToast();

const publisherTableColumns: TableColumn<Publisher>[] = [
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'display_name', header: 'Display Name' },
    { accessorKey: 'description', header: 'Description' },
    { accessorKey: 'created_at', header: 'Created At' },
    { id: 'actions', header: '', enableSorting: false, enableHiding: false }
];

const publishers = await useAPILazyAsyncData<Publisher[]>(
    '/dashboard/publishers',
    async () => {
        const res = await useAPI((api) => api.getPublishers({ query: { onlyMembershipByMe: true } }));
        if (!res.success) {
            toast.add({ title: 'Failed to load publishers', description: res.message, color: 'error' });
            return [];
        }
        return res.data;
    }
);
</script>

<template>
    <UDashboardPanel>
        <template #header>
            <DashboardPageHeader
                title="Publishers"
                icon="i-lucide-building"
                description="Manage the publishers you are a member of."
            />
        </template>

        <template #body>
            <DashboardPageBody>
                <DashboardDataTable
                    :data="publishers.data"
                    :columns="publisherTableColumns"
                    :loading="publishers.loading"
                    :filters="[
                        {
                            column: 'name',
                            type: 'text',
                            placeholder: 'Search publishers...',
                            icon: 'i-lucide-search',
                        },
                    ]"
                    empty-title="No publishers"
                    empty-description="Create your first publisher to get started."
                    empty-icon="i-lucide-building"
                    @refresh="publishers.refresh()"
                >
                    <template #header-right>
                        <UButton
                            label="New Publisher"
                            icon="i-lucide-plus"
                            color="primary"
                            to="/dashboard/publishers/new"
                        />
                    </template>

                    <template #name-cell="{ row }">
                        <NuxtLink
                            :to="`/dashboard/publishers/${row.original.name}`"
                            class="font-medium text-sky-400 hover:underline"
                        >
                            {{ row.original.name }}
                        </NuxtLink>
                    </template>

                    <template #display_name-cell="{ row }">
                        <span class="text-slate-100">
                            {{ row.original.display_name || '—' }}
                        </span>
                    </template>

                    <template #description-cell="{ row }">
                        <span class="text-slate-400 line-clamp-1 max-w-xs">
                            {{ row.original.description || '—' }}
                        </span>
                    </template>

                    <template #created_at-cell="{ row }">
                        <span class="text-sm text-slate-400">
                            {{ new Date(row.original.created_at).toLocaleDateString() }}
                        </span>
                    </template>

                    <template #actions-cell="{ row }">
                        <UButton
                            icon="i-lucide-settings"
                            variant="ghost"
                            color="neutral"
                            size="xs"
                            :to="`/dashboard/publishers/${row.original.name}`"
                        />
                    </template>

                    <template #empty-actions>
                        <UButton
                            label="Create Publisher"
                            color="primary"
                            to="/dashboard/publishers/new"
                        />
                    </template>
                </DashboardDataTable>
            </DashboardPageBody>
        </template>
    </UDashboardPanel>
</template>

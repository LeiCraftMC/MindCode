<script setup lang="ts">
import type { TableColumn } from '#ui/types'
import type { GetAdminTasksResponses } from '@/api-client/types.gen'

type DevTask = GetAdminTasksResponses[200]['data'][number]

definePageMeta({
    layout: 'dashboard'
})

useSeoMeta({
    title: 'Tasks | LeiOS Hub',
    description: 'View scheduled tasks'
})

const toast = useToast()

const taskColumns: TableColumn<DevTask>[] = [
    { accessorKey: 'id', header: 'ID' },
    { accessorKey: 'status', header: 'Status' },
    { id: 'created', header: 'Created' },
    { id: 'finished', header: 'Finished' },
    { accessorKey: 'message', header: 'Message' }
]

const { data: tasks, loading, refresh } = await useAPIAsyncData<DevTask[]>(
    'admin-tasks-list',
    async () => {
        const res = await useAPI((api) => api.getAdminTasks({}))
        if (!res.success) {
            toast.add({ title: 'Failed to load tasks', description: res.message, color: 'error' })
            return []
        }
        return res.data;
    }
)

function formatDate(timestamp: number | null) {
    if (!timestamp) return '—';
    return new Date(timestamp).toLocaleString();
}

function getStatusColor(status: DevTask['status']) {
    switch (status) {
        case 'completed': return 'success' as const
        case 'running': return 'info' as const
        case 'failed': return 'error' as const
        case 'paused': return 'warning' as const
        default: return 'neutral' as const
    }
}

function getStatusIcon(status: DevTask['status']) {
    switch (status) {
        case 'completed': return 'i-lucide-check-circle'
        case 'running': return 'i-lucide-loader'
        case 'failed': return 'i-lucide-x-circle'
        case 'paused': return 'i-lucide-pause-circle'
        default: return 'i-lucide-clock'
    }
}

const taskStatusOptions = [
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
            <DashboardPageHeader
                title="Tasks"
                icon="i-lucide-list-checks"
                description="View scheduled tasks"
            />
        </template>

        <template #body>
            <DashboardPageBody>

                <DashboardDataTable
                    :data="tasks"
                    :columns="taskColumns"
                    :loading="loading"
                    :filters="[
                        /*{
                            column: 'message',
                            type: 'text',
                            placeholder: 'Search messages...',
                            icon: 'i-lucide-search',
                        },*/
                        {
                            column: 'status',
                            type: 'multi-select',
                            placeholder: 'All Statuses',
                            icon: 'i-lucide-filter',
                            options: taskStatusOptions,
                        },
                    ]"
                    empty-title="No tasks"
                    empty-description="Tasks will appear here when you upload releases or perform other operations."
                    empty-icon="i-lucide-clipboard-list"
                    @refresh="refresh()"
                >
                    <template #id-cell="{ row }">
                        <span class="font-mono text-sm">#{{ row.original.id }}</span>
                    </template>

                    <template #status-cell="{ row }">
                        <UBadge :color="getStatusColor(row.original.status)" variant="soft">
                            <UIcon
                                :name="getStatusIcon(row.original.status)"
                                :class="{ 'animate-spin': row.original.status === 'running' }"
                                class="mr-1"
                            />
                            {{ row.original.status }}
                        </UBadge>
                    </template>

                    <template #created-cell="{ row }">
                        <span class="text-sm text-slate-400">
                            {{ formatDate(row.original.created_at) }}
                        </span>
                    </template>

                    <template #finished-cell="{ row }">
                        <span class="text-sm text-slate-400">
                            {{ formatDate(row.original.finished_at) }}
                        </span>
                    </template>

                    <template #message-cell="{ row }">
                        <span class="text-slate-400 line-clamp-1 max-w-xs">
                            {{ row.original.message || '—' }}
                        </span>
                    </template>

                </DashboardDataTable>
            </DashboardPageBody>
        </template>
    </UDashboardPanel>
</template>

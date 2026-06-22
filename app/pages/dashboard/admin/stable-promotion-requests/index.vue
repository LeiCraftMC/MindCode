<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui';
import type { GetAdminStablePromotionRequestsResponses } from '@/api-client/types.gen';

type AdminStableRequest = GetAdminStablePromotionRequestsResponses[200]['data'][number];

definePageMeta({
    layout: 'dashboard'
});

useSeoMeta({
    title: 'Stable Promotion Requests | LeiOS Hub',
    description: 'Review and manage stable promotion requests'
});

const toast = useToast();

// Fetch stable promotion requests
const stablePromotionRequests = await useAPIAsyncData(
    'admin-stable-promotion-requests',
    async () => {
        const res = await useAPI((api) => api.getAdminStablePromotionRequests({}));
        
        if (!res.success) {
            toast.add({
                title: 'Error',
                description: `Failed to load stable promotion requests: ${res.message}`,
                color: 'error'
            });
            return [];
        }

        return res.data;
    }
);

const requestColumns: TableColumn<AdminStableRequest>[] = [
    { accessorKey: 'id', header: 'ID' },
    { id: 'package', header: 'Package' },
    { id: 'release', header: 'Release' },
    { id: 'status', header: 'Status' },
    { accessorKey: 'created_at', header: 'Created At' },
    { accessorKey: 'admin_note', header: 'Admin Note' },
    { id: 'actions', header: '', enableSorting: false, enableHiding: false }
];

const decisionModal = ref(false);
const selectedRequest = ref<AdminStableRequest | null>(null);
const decisionForm = reactive({
    status: 'approved' as 'approved' | 'denied',
    admin_note: ''
});
const submittingDecision = ref(false);

function openDecision(request: AdminStableRequest, initialStatus: 'approved' | 'denied' = 'approved') {
    selectedRequest.value = request;
    decisionForm.status = initialStatus;
    decisionForm.admin_note = '';
    decisionModal.value = true;
}

async function submitDecision() {
    if (!selectedRequest.value) return;

    submittingDecision.value = true;

    try {
        const res = await useAPI((api) => api.postAdminStablePromotionRequestsByStablePromotionRequestIdDecide({
            path: { stablePromotionRequestID: (selectedRequest.value as AdminStableRequest).id },
            body: {
                status: decisionForm.status,
                admin_note: decisionForm.admin_note
            }
        }));

        if (res.success) {
            toast.add({
                title: decisionForm.status === 'approved' ? 'Request approved' : 'Request denied',
                description: `Stable promotion request #${selectedRequest.value.id} has been ${decisionForm.status}.`,
                icon: 'i-lucide-check',
                color: 'success'
            });
            decisionModal.value = false;
            await stablePromotionRequests.refresh();
        } else {
            throw new Error(res.message || 'Failed to submit decision');
        }
    } catch (error: any) {
        toast.add({
            title: 'Error',
            description: error.message || 'An unexpected error occurred.',
            icon: 'i-lucide-x-circle',
            color: 'error'
        });
    } finally {
        submittingDecision.value = false;
    }
}

function getStatusColor(status: AdminStableRequest['status']) {
    switch (status) {
        case 'approved': return 'success';
        case 'denied': return 'error';
        case 'pending': return 'warning';
        default: return 'neutral';
    }
}
</script>

<template>
    <UDashboardPanel>
        <template #header>
            <DashboardPageHeader
                title="Stable Promotion Requests"
                icon="i-lucide-git-pull-request"
                description="Review and manage stable promotion requests from developers"
            />
        </template>

        <template #body>
            <DashboardPageBody>

                <DashboardDataTable
                    :data="stablePromotionRequests.data"
                    :columns="requestColumns"
                    :loading="stablePromotionRequests.loading"
                    :filters="[
                        {
                            column: 'package_name',
                            type: 'text',
                            placeholder: 'Search package...',
                            icon: 'i-lucide-search'
                        },
                        {
                            column: 'status',
                            type: 'select',
                            placeholder: 'Filter by status...',
                            icon: 'i-lucide-filter',
                            options: [
                                { label: 'Pending', value: 'pending', color: 'warning' },
                                { label: 'Approved', value: 'approved', color: 'success' },
                                { label: 'Denied', value: 'denied', color: 'error' }
                            ]
                        },
                        // {
                        //     column: 'created_at',
                        //     type: 'date',
                        //     placeholder: 'Filter by date'
                        // }
                    ]"
                    empty-title="No stable promotion requests"
                    empty-description="No requests have been submitted yet."
                    empty-icon="i-lucide-inbox"
                    @refresh="stablePromotionRequests.refresh()"
                >

                    <template #id-cell="{ row }">
                        <NuxtLink
                            :to="`/dashboard/admin/stable-promotion-requests/${row.original.id}`"
                            class="font-mono text-sm text-primary-400 hover:underline"
                        >
                            #{{ row.original.id }}
                        </NuxtLink>
                    </template>

                    <template #package-cell="{ row }">
                        <NuxtLink
                            :to="`/dashboard/admin/packages`"
                            class="font-medium text-sky-400 hover:underline"
                        >
                            {{ row.original.package_name }}
                        </NuxtLink>
                    </template>

                    <template #release-cell="{ row }">
                        <span class="font-mono text-sm text-slate-300">
                            {{ row.original.package_release_version }}
                        </span>
                    </template>

                    <template #status-cell="{ row }">
                        <UBadge :color="getStatusColor(row.original.status)" variant="soft">
                            {{ row.original.status }}
                        </UBadge>
                    </template>

                    <template #created_at-cell="{ row }">
                        <span class="text-sm">
                            {{ new Date(row.original.created_at).toLocaleString() }}
                        </span>
                    </template>

                    <template #admin_note-cell="{ row }">
                        <span v-if="row.original.admin_note" class="text-sm text-slate-400 line-clamp-1">
                            {{ row.original.admin_note }}
                        </span>
                        <span v-else class="text-sm text-slate-500">—</span>
                    </template>

                    <template #actions-cell="{ row }">
                        <div class="flex gap-1 justify-end">
                            <UButton
                                v-if="row.original.status === 'pending'"
                                icon="i-lucide-check"
                                color="success"
                                variant="soft"
                                size="xs"
                                @click="openDecision(row.original, 'approved')"
                            />
                            <UButton
                                v-if="row.original.status === 'pending'"
                                icon="i-lucide-x"
                                color="error"
                                variant="soft"
                                size="xs"
                                @click="openDecision(row.original, 'denied')"
                            />
                            <UButton
                                :to="`/dashboard/admin/stable-promotion-requests/${row.original.id}`"
                                icon="i-lucide-eye"
                                color="neutral"
                                variant="ghost"
                                size="xs"
                            />
                        </div>
                    </template>

                </DashboardDataTable>

            </DashboardPageBody>
        </template>
    </UDashboardPanel>

    <!-- Decision Modal -->
    <DashboardModal
        v-model:open="decisionModal"
        :title="`Review Request #${selectedRequest?.id}`"
        icon="i-lucide-git-pull-request"
        icon-color="sky"
        :loading="submittingDecision"
    >
        <div class="space-y-4">
            <div v-if="selectedRequest" class="rounded-lg bg-slate-800/50 p-4 space-y-2">
                <div class="flex justify-between items-center">
                    <span class="text-sm text-slate-400">Package</span>
                    <span class="text-sm font-medium text-slate-200">{{ selectedRequest.package_name }}</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-sm text-slate-400">Release Version</span>
                    <span class="text-sm font-mono text-slate-200">{{ selectedRequest.package_release_version }}</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-sm text-slate-400">Created</span>
                    <span class="text-sm text-slate-200">{{ new Date(selectedRequest.created_at).toLocaleString() }}</span>
                </div>
            </div>

            <div class="flex gap-2">
                <UButton
                    label="Approve"
                    icon="i-lucide-check"
                    :color="decisionForm.status === 'approved' ? 'success' : 'neutral'"
                    :variant="decisionForm.status === 'approved' ? 'solid' : 'outline'"
                    @click="decisionForm.status = 'approved'"
                    :disabled="submittingDecision"
                />
                <UButton
                    label="Deny"
                    icon="i-lucide-x"
                    :color="decisionForm.status === 'denied' ? 'error' : 'neutral'"
                    :variant="decisionForm.status === 'denied' ? 'solid' : 'outline'"
                    @click="decisionForm.status = 'denied'"
                    :disabled="submittingDecision"
                />
            </div>

            <UFormField 
                label="Admin Note" 
                :required="decisionForm.status === 'denied'"
                help="Add a note explaining your decision. Required for denials."
            >
                <UTextarea
                    v-model="decisionForm.admin_note"
                    placeholder="Add a note for this decision..."
                    :disabled="submittingDecision"
                    :rows="4"
                    class="w-full"
                />
            </UFormField>

            <div v-if="decisionForm.status === 'denied' && !decisionForm.admin_note" class="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
                <div class="flex gap-2">
                    <UIcon name="i-lucide-alert-triangle" class="text-amber-400 mt-0.5 shrink-0" />
                    <div class="text-sm text-amber-300/90">
                        <p class="font-medium">Admin note required</p>
                        <p class="text-xs text-amber-400/70">
                            You must provide a reason when denying a request.
                        </p>
                    </div>
                </div>
            </div>
        </div>

        <template #footer>
            <div class="flex gap-2">
                <UButton
                    label="Cancel"
                    color="neutral"
                    variant="ghost"
                    @click="decisionModal = false"
                    :disabled="submittingDecision"
                />
                <UButton
                    :label="decisionForm.status === 'approved' ? 'Approve Request' : 'Deny Request'"
                    :icon="decisionForm.status === 'approved' ? 'i-lucide-check' : 'i-lucide-x'"
                    :color="decisionForm.status === 'approved' ? 'success' : 'error'"
                    @click="submitDecision"
                    :loading="submittingDecision"
                    :disabled="decisionForm.status === 'denied' && !decisionForm.admin_note"
                />
            </div>
        </template>
    </DashboardModal>
</template>

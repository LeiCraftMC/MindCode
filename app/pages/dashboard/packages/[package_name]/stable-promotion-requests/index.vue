<script lang="ts" setup>
import type { TableColumn } from '@nuxt/ui';
import type { 
    GetPackagesByFullPackageNameResponses, 
    GetPackagesByFullPackageNameStablePromotionRequestsResponses,
    GetPackagesByFullPackageNameReleasesResponses 
} from '~/api-client';

const toast = useToast();

type DevPackage = GetPackagesByFullPackageNameResponses[200]['data'];
type StablePromotionRequest = GetPackagesByFullPackageNameStablePromotionRequestsResponses[200]['data'][number];
type Release = GetPackagesByFullPackageNameReleasesResponses[200]['data'][number];

const pkgData = useSubrouterInjectedData<DevPackage>("package").inject().data;

// Fetch stable promotion requests
const stablePromotionRequests = await useAPIAsyncData<StablePromotionRequest[]>(
    `/dev/packages/${pkgData.value.name}/stable-promotion-requests`,
    async () => {
        const res = await useAPI((api) => api.getPackagesByFullPackageNameStablePromotionRequests({
            path: {
                fullPackageName: pkgData.value.fullname
            }
        }));

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

// Fetch releases for the new request modal
const availableReleases = await useAPIAsyncData(
    `forStablePromotionRequests:/dev/packages/${pkgData.value.name}/releases`,
    async () => {
        const res = await useAPI((api) => api.getPackagesByFullPackageNameReleases({
            path: {
                fullPackageName: pkgData.value.fullname
            }
        }));

        if (!res.success) {
            toast.add({
                title: 'Error',
                description: `Failed to load releases for stable promotion requests: ${res.message}`,
                color: 'error'
            });
            return [];
        }

        return res.data;
    }
);

const stablePromotionRequestsTableColumns: TableColumn<StablePromotionRequest>[] = [
    { accessorKey: 'id', header: 'ID' },
    { id: 'package_release_version', header: 'Release' },
    { id: 'status', header: 'Status' },
    { accessorKey: 'created_at', header: 'Created At' },
    { accessorKey: 'admin_note', header: 'Admin Note' },
    { id: 'actions', header: '', enableSorting: false, enableHiding: false }
];

// Modal states
const newRequestModal = ref(false);
const selectedRelease = ref<{
    label: string;
    value: number;
} | undefined>(undefined);
const submittingRequest = ref(false);

function openNewRequestModal() {
    selectedRelease.value = undefined;
    newRequestModal.value = true;
}

async function submitNewRequest() {
    if (!selectedRelease.value) {
        toast.add({
            title: 'Error',
            description: 'Please select a release',
            color: 'error'
        });
        return;
    }

    submittingRequest.value = true;

    try {
        const res = await useAPI((api) => api.postPackagesByFullPackageNameStablePromotionRequests({
            path: {
                fullPackageName: pkgData.value.fullname
            },
            body: {
                package_release_id: selectedRelease.value?.value as number
            }
        }));

        if (res.success) {
            toast.add({
                title: 'Success',
                description: 'Stable promotion request submitted successfully',
                color: 'success'
            });
            newRequestModal.value = false;
            await stablePromotionRequests.refresh();
        } else {
            toast.add({
                title: 'Error',
                description: res.message,
                color: 'error'
            });
        }
    } catch {
        toast.add({
            title: 'Error',
            description: 'An unexpected error occurred.',
            color: 'error'
        });
    } finally {
        submittingRequest.value = false;
    }
}

function getStatusColor(status: StablePromotionRequest['status']) {
    switch (status) {
        case 'approved': return 'success';
        case 'denied': return 'error';
        case 'pending': return 'warning';
        default: return 'neutral';
    }
}

// Computed properties for filtering
const pendingRequests = computed(() => 
    stablePromotionRequests.data.value?.filter((r) => r.status === 'pending') || []
);

const processedRequests = computed(() => 
    stablePromotionRequests.data.value?.filter((r) => r.status !== 'pending') || []
);

// Release options for select
const releaseOptions = computed(() => {
    if (!availableReleases.data.value) return [];

    // return availableReleases.data.value.map(release => ({
    //     label: release.versionWithLeiosPatch,
    //     value: release.id
    // }));
    return availableReleases.data.value.map((release: Release) => ({
        label: release.version_with_leios_patch,
        value: release.id
    }));
});

</script>

<template>
    <DashboardPageBody>

        <DashboardDataTable
            :data="stablePromotionRequests.data"
            :columns="stablePromotionRequestsTableColumns"
            :loading="stablePromotionRequests.loading"
            :filters="[
                {
                    column: 'status',
                    type: 'select',
                    placeholder: 'Filter by status...',
                    options: [
                        { label: 'Pending', value: 'pending', color: 'warning' },
                        { label: 'Approved', value: 'approved', color: 'success' },
                        { label: 'Denied', value: 'denied', color: 'error' }
                    ]
                },
                {
                    column: 'created_at',
                    type: 'date',
                    placeholder: 'Filter by date'
                }
            ]"
            empty-title="No stable promotion requests"
            empty-description="Submit your first stable promotion request to get started."
            empty-icon="i-lucide-git-pull-request"
            @refresh="stablePromotionRequests.refresh()"
        >

            <template #header-right>
                <UButton
                    label="New Request"
                    icon="i-lucide-plus"
                    color="primary"
                    @click="openNewRequestModal"
                />
            </template>

            <template #id-cell="{ row }">
                <NuxtLink
                    :to="`/dashboard/packages/${pkgData.fullname}/stable-promotion-requests/${row.original.id}`"
                    class="font-mono text-sm text-primary-400 hover:underline"
                >
                    #{{ row.original.id }}
                </NuxtLink>
            </template>

            <template #package_release_version-cell="{ row }">
                <NuxtLink
                    :to="`/dashboard/packages/${pkgData.fullname}/releases/${row.original.package_release_version}`"
                    class="font-medium text-primary-400 hover:underline"
                >
                    {{ row.original.package_release_version || 'Unknown Release' }}
                </NuxtLink>
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
                <span v-if="row.original.admin_note" class="text-sm text-slate-400">
                    {{ row.original.admin_note }}
                </span>
                <span v-else class="text-sm text-slate-500">—</span>
            </template>

            <template #actions-cell="{ row }">
                <div class="flex gap-1 justify-end">
                    <UButton
                        :to="`/dashboard/packages/${pkgData.fullname}/stable-promotion-requests/${row.original.id}`"
                        icon="i-lucide-eye"
                        color="neutral"
                        variant="ghost"
                        size="xs"
                    />
                </div>
            </template>

            <template #empty-actions>
                <UButton
                    label="New Request"
                    icon="i-lucide-plus"
                    color="primary"
                    @click="openNewRequestModal"
                />
            </template>

        </DashboardDataTable>

    </DashboardPageBody>

    <!-- New Request Modal -->
    <DashboardModal
        v-model:open="newRequestModal"
        title="New Stable Promotion Request"
        icon="i-lucide-git-pull-request"
        icon-color="sky"
        :loading="submittingRequest"
    >
        <div class="space-y-4">
            <UFormField 
                label="Select Release" 
                required
                help="Choose a release to promote to stable"
            >
                <USelectMenu
                    v-model="selectedRelease"
                    :items="releaseOptions"
                    placeholder="Select a release..."
                    :disabled="submittingRequest"
                    class="w-full"
                />
            </UFormField>

            <div class="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
                <div class="flex gap-2">
                    <UIcon name="i-lucide-info" class="text-amber-400 mt-0.5 shrink-0" />
                    <div class="text-sm text-amber-300/90">
                        <p class="font-medium mb-1">Review Process</p>
                        <p class="text-xs text-amber-400/70">
                            Your request will be reviewed by administrators before the release is promoted to stable.
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
                    @click="newRequestModal = false"
                    :disabled="submittingRequest"
                />
                <UButton
                    label="Submit Request"
                    icon="i-lucide-send"
                    color="primary"
                    @click="submitNewRequest"
                    :loading="submittingRequest"
                />
            </div>
        </template>
    </DashboardModal>
</template>

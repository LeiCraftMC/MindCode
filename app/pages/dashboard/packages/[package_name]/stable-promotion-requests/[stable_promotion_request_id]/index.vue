<script setup lang="ts">
import type { DevPackage, DevPackageStablePromotionRequest } from '~/utils/types';

const route = useRoute();
const toast = useToast();

const pkg_data = useSubrouterInjectedData<DevPackage>("package").inject().data;
const stable_promotion_request = useSubrouterInjectedData<DevPackageStablePromotionRequest>("stable_promotion_request").inject();
const request_data = stable_promotion_request.data;
const request_loading = stable_promotion_request.loading;

const headerTexts = computed(() => {
    return {
        title: `Stable Promotion Request #${request_data.value.id}`,
        description: `View details of the stable promotion request for package ${pkg_data.value.name}.`,
    };
});

function getStatusColor(status: DevPackageStablePromotionRequest['status']) {
    switch (status) {
        case 'approved': return 'success';
        case 'denied': return 'error';
        case 'pending': return 'warning';
        default: return 'neutral';
    }
}

function getStatusIcon(status: DevPackageStablePromotionRequest['status']) {
    switch (status) {
        case 'approved': return 'i-lucide-check-circle';
        case 'denied': return 'i-lucide-x-circle';
        case 'pending': return 'i-lucide-clock';
        default: return 'i-lucide-help-circle';
    }
}

const deleteConfirmOpen = ref(false);

async function onDeleteRequest() {

    try {
        const result = await useAPI((api) =>
            api.deletePackagesByFullPackageNameStablePromotionRequestsByStablePromotionRequestId({
                path: {
                    fullPackageName: pkg_data.value.fullname,
                    stablePromotionRequestID: request_data.value.id,
                },
            })
        );

        if (result.success) {
            toast.add({
                title: "Request deleted",
                description: `The stable promotion request has been successfully deleted.`,
                icon: "i-lucide-check",
                color: "success",
            });

            // Redirect to the requests list
            await navigateTo(
                `/dashboard/packages/${pkg_data.value.fullname}/stable-promotion-requests`
            );
        } else {
            throw new Error(
                result.message || "Failed to delete stable promotion request"
            );
        }
    } catch (error: any) {
        toast.add({
            title: "Error",
            description: error.message || "An unexpected error occurred.",
            icon: "i-lucide-x-circle",
            color: "error",
        });
    } finally {
        deleteConfirmOpen.value = false;
    }
}

</script>

<template>
    <div class="space-y-6 w-full lg:w-3xl mx-auto">
        <!-- Header -->
        <div>
            <h2 class="text-xl font-semibold text-white">
                {{ headerTexts.title }}
            </h2>
            <p class="text-sm text-slate-400 mt-1">
                {{ headerTexts.description }}
            </p>
        </div>

        <!-- Request Details Card -->
        <div class="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm overflow-hidden">
            <div class="px-6 py-4 border-b border-slate-800">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-lg bg-sky-500/10 flex items-center justify-center">
                        <UIcon class="w-5 h-5 text-sky-400" name="i-lucide-git-pull-request" />
                    </div>
                    <div>
                        <h3 class="font-medium text-white">
                            Request Information
                        </h3>
                        <p class="text-sm text-slate-400">
                            Details about this stable promotion request.
                        </p>
                    </div>
                </div>
            </div>

            <div class="p-6 space-y-4">
                <!-- Status -->
                <div class="flex items-center justify-between py-3 border-b border-slate-800">
                    <div>
                        <label class="text-sm font-medium text-slate-300">Status</label>
                    </div>
                    <div class="flex items-center gap-2">
                        <UIcon :name="getStatusIcon(request_data.status)" :class="{
                            'text-amber-400': request_data.status === 'pending',
                            'text-green-400': request_data.status === 'approved',
                            'text-red-400': request_data.status === 'denied'
                        }" />
                        <UBadge :color="getStatusColor(request_data.status)" variant="soft" size="md">
                            {{ request_data.status }}
                        </UBadge>
                    </div>
                </div>

                <!-- Request ID -->
                <div class="flex items-center justify-between py-3 border-b border-slate-800">
                    <div>
                        <label class="text-sm font-medium text-slate-300">Request ID</label>
                    </div>
                    <div class="text-right">
                        <span class="font-mono text-sm text-slate-400">#{{ request_data.id }}</span>
                    </div>
                </div>

                <!-- Package Release ID -->
                <div class="flex items-center justify-between py-3 border-b border-slate-800">
                    <div>
                        <label class="text-sm font-medium text-slate-300">Package Release</label>
                    </div>
                    <div class="text-right">
                        <span class="font-mono text-sm text-slate-400">{{ request_data.package_release_version }}</span>
                    </div>
                </div>

                <!-- Created At -->
                <div class="flex items-center justify-between py-3 border-b border-slate-800">
                    <div>
                        <label class="text-sm font-medium text-slate-300">Created At</label>
                    </div>
                    <div class="text-right">
                        <span class="text-sm text-slate-400">
                            {{ new Date(request_data.created_at).toLocaleString() }}
                        </span>
                    </div>
                </div>

                <!-- Admin Note -->
                <div class="flex flex-col gap-2 py-3">
                    <label class="text-sm font-medium text-slate-300">Admin Note</label>
                    <div v-if="request_data.admin_note" class="rounded-lg bg-slate-800/50 p-4">
                        <p class="text-sm text-slate-300 whitespace-pre-wrap">{{ request_data.admin_note }}</p>
                    </div>
                    <div v-else class="rounded-lg bg-slate-800/50 p-4">
                        <p class="text-sm text-slate-500 italic">No admin note available</p>
                    </div>
                </div>
            </div>
        </div>

        <!-- Info Card for Pending Status -->
        <div v-if="request_data.status === 'pending'" class="rounded-lg bg-amber-500/10 border border-amber-500/20 p-4">
            <div class="flex gap-3">
                <UIcon name="i-lucide-info" class="text-amber-400 mt-0.5 shrink-0" />
                <div class="text-sm text-amber-300/90">
                    <p class="font-medium mb-1">Pending Review</p>
                    <p class="text-xs text-amber-400/70">
                        This request is waiting for administrator review. You will be notified once a decision has been made.
                    </p>
                </div>
            </div>
        </div>

        <!-- Success Card for Approved -->
        <div v-if="request_data.status === 'approved'" class="rounded-lg bg-green-500/10 border border-green-500/20 p-4">
            <div class="flex gap-3">
                <UIcon name="i-lucide-check-circle" class="text-green-400 mt-0.5 shrink-0" />
                <div class="text-sm text-green-300/90">
                    <p class="font-medium mb-1">Request Approved</p>
                    <p class="text-xs text-green-400/70">
                        This stable promotion request has been approved. The release has been promoted to stable.
                    </p>
                </div>
            </div>
        </div>

        <!-- Error Card for Denied -->
        <div v-if="request_data.status === 'denied'" class="rounded-lg bg-red-500/10 border border-red-500/20 p-4">
            <div class="flex gap-3">
                <UIcon name="i-lucide-x-circle" class="text-red-400 mt-0.5 shrink-0" />
                <div class="text-sm text-red-300/90">
                    <p class="font-medium mb-1">Request Denied</p>
                    <p class="text-xs text-red-400/70">
                        This stable promotion request has been denied. Please check the admin note for more information.
                    </p>
                </div>
            </div>
        </div>

        <!-- Actions -->
        <div class="flex gap-3">
            <UButton
                label="Back to Requests"
                icon="i-lucide-arrow-left"
                color="neutral"
                variant="soft"
                :to="`/dashboard/packages/${pkg_data.name}/stable-promotion-requests`"
            />
            
            <div class="flex-1"></div>

            <UButton
                v-if="request_data.status === 'pending'"
                label="Delete Request"
                icon="i-lucide-trash-2"
                color="error"
                variant="soft"
                @click="deleteConfirmOpen = true"
            />
        </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <DashboardDeleteModal
        v-model:open="deleteConfirmOpen"
        title="Delete Stable Promotion Request"
        :warning-text="`Are you sure you want to delete this stable promotion request? This action cannot be undone.`"
        :on-delete="onDeleteRequest"
        :prevent-auto-close="true"
    />
</template>

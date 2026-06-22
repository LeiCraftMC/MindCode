<script setup lang="ts">
import type { GetAdminStablePromotionRequestsByStablePromotionRequestIdResponses } from '~/api-client';

const route = useRoute();
const toast = useToast();

const requestId = parseInt(route.params.stable_promotion_request_id as string);
if (isNaN(requestId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid stable promotion request ID' });
}

type AdminStableRequest = GetAdminStablePromotionRequestsByStablePromotionRequestIdResponses[200]['data'];

const { data: result, refresh } = await useAPIAsyncData(
    `/admin/stable-promotion-requests/${requestId}`,
    async () => {
        const res = await useAPI((api) => api.getAdminStablePromotionRequestsByStablePromotionRequestId({
            path: {
                stablePromotionRequestID: requestId
            }
        }));
        return res;
    }
);

const error = computed(() => {
    if (!result.value?.success || !result.value?.data) {
        return createError({
            statusCode: result.value?.code || 500,
            statusMessage: result.value?.message || 'Failed to load stable promotion request'
        });
    }
    return null;
});

const requestData = computed(() => result.value?.data as AdminStableRequest);

definePageMeta({
    layout: 'dashboard'
});

useSeoMeta({
    title: `Request #${requestId} | Stable Promotion Requests | LeiOS Hub`,
    description: 'Review stable promotion request details'
});

function getStatusColor(status: AdminStableRequest['status']) {
    switch (status) {
        case 'approved': return 'success';
        case 'denied': return 'error';
        case 'pending': return 'warning';
        default: return 'neutral';
    }
}

function getStatusIcon(status: AdminStableRequest['status']) {
    switch (status) {
        case 'approved': return 'i-lucide-check-circle';
        case 'denied': return 'i-lucide-x-circle';
        case 'pending': return 'i-lucide-clock';
        default: return 'i-lucide-help-circle';
    }
}

const decisionModal = ref(false);
const decisionForm = reactive({
    status: 'approved' as 'approved' | 'denied',
    admin_note: ''
});
const submittingDecision = ref(false);

function openDecision(initialStatus: 'approved' | 'denied' = 'approved') {
    decisionForm.status = initialStatus;
    decisionForm.admin_note = requestData.value.admin_note || '';
    decisionModal.value = true;
}

async function submitDecision() {
    if (!requestData.value) return;

    submittingDecision.value = true;

    try {
        const res = await useAPI((api) => api.postAdminStablePromotionRequestsByStablePromotionRequestIdDecide({
            path: { stablePromotionRequestID: requestData.value.id },
            body: {
                status: decisionForm.status,
                admin_note: decisionForm.admin_note
            }
        }));

        if (res.success) {
            toast.add({
                title: decisionForm.status === 'approved' ? 'Request approved' : 'Request denied',
                description: `Stable promotion request #${requestData.value.id} has been ${decisionForm.status}.`,
                icon: 'i-lucide-check',
                color: 'success'
            });
            decisionModal.value = false;
            await refresh();
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

</script>

<template>
    <UDashboardPanel v-if="!error">
        <template #header>
            <DashboardPageHeader
                :title="`Stable Promotion Request #${requestData.id}`"
                icon="i-lucide-git-pull-request"
                :description="`Review request for ${requestData.package_name} v${requestData.package_release_version}`"
            />
        </template>

        <template #body>
            <DashboardPageBody>
                <div class="space-y-6 w-full lg:w-3xl mx-auto">
                    
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
                                    <UIcon :name="getStatusIcon(requestData.status)" :class="{
                                        'text-amber-400': requestData.status === 'pending',
                                        'text-green-400': requestData.status === 'approved',
                                        'text-red-400': requestData.status === 'denied'
                                    }" />
                                    <UBadge :color="getStatusColor(requestData.status)" variant="soft" size="md">
                                        {{ requestData.status }}
                                    </UBadge>
                                </div>
                            </div>

                            <!-- Request ID -->
                            <div class="flex items-center justify-between py-3 border-b border-slate-800">
                                <div>
                                    <label class="text-sm font-medium text-slate-300">Request ID</label>
                                </div>
                                <div class="text-right">
                                    <span class="font-mono text-sm text-slate-400">#{{ requestData.id }}</span>
                                </div>
                            </div>

                            <!-- Package -->
                            <div class="flex items-center justify-between py-3 border-b border-slate-800">
                                <div>
                                    <label class="text-sm font-medium text-slate-300">Package</label>
                                </div>
                                <div class="text-right">
                                    <NuxtLink
                                        to="/dashboard/admin/packages"
                                        class="font-medium text-sky-400 hover:underline"
                                    >
                                        {{ requestData.package_name }}
                                    </NuxtLink>
                                </div>
                            </div>

                            <!-- Release Version -->
                            <div class="flex items-center justify-between py-3 border-b border-slate-800">
                                <div>
                                    <label class="text-sm font-medium text-slate-300">Release Version</label>
                                </div>
                                <div class="text-right">
                                    <span class="font-mono text-sm text-slate-400">{{ requestData.package_release_version }}</span>
                                </div>
                            </div>

                            <!-- Package ID -->
                            <div class="flex items-center justify-between py-3 border-b border-slate-800">
                                <div>
                                    <label class="text-sm font-medium text-slate-300">Package ID</label>
                                </div>
                                <div class="text-right">
                                    <span class="font-mono text-sm text-slate-400">{{ requestData.package_id }}</span>
                                </div>
                            </div>

                            <!-- Package Release ID -->
                            <div class="flex items-center justify-between py-3 border-b border-slate-800">
                                <div>
                                    <label class="text-sm font-medium text-slate-300">Release ID</label>
                                </div>
                                <div class="text-right">
                                    <span class="font-mono text-sm text-slate-400">{{ requestData.package_release_id }}</span>
                                </div>
                            </div>

                            <!-- Created At -->
                            <div class="flex items-center justify-between py-3 border-b border-slate-800">
                                <div>
                                    <label class="text-sm font-medium text-slate-300">Created At</label>
                                </div>
                                <div class="text-right">
                                    <span class="text-sm text-slate-400">
                                        {{ new Date(requestData.created_at).toLocaleString() }}
                                    </span>
                                </div>
                            </div>

                            <!-- Admin Note -->
                            <div class="flex flex-col gap-2 py-3">
                                <label class="text-sm font-medium text-slate-300">Admin Note</label>
                                <div v-if="requestData.admin_note" class="rounded-lg bg-slate-800/50 p-4">
                                    <p class="text-sm text-slate-300 whitespace-pre-wrap">{{ requestData.admin_note }}</p>
                                </div>
                                <div v-else class="rounded-lg bg-slate-800/50 p-4">
                                    <p class="text-sm text-slate-500 italic">No admin note available</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Info Card for Pending Status -->
                    <div v-if="requestData.status === 'pending'" class="rounded-lg bg-amber-500/10 border border-amber-500/20 p-4">
                        <div class="flex gap-3">
                            <UIcon name="i-lucide-alert-triangle" class="text-amber-400 mt-0.5 shrink-0" />
                            <div class="text-sm text-amber-300/90">
                                <p class="font-medium mb-1">Pending Review</p>
                                <p class="text-xs text-amber-400/70">
                                    This request is awaiting your decision. Please review and approve or deny this stable promotion request.
                                </p>
                            </div>
                        </div>
                    </div>

                    <!-- Success Card for Approved -->
                    <div v-if="requestData.status === 'approved'" class="rounded-lg bg-green-500/10 border border-green-500/20 p-4">
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
                    <div v-if="requestData.status === 'denied'" class="rounded-lg bg-red-500/10 border border-red-500/20 p-4">
                        <div class="flex gap-3">
                            <UIcon name="i-lucide-x-circle" class="text-red-400 mt-0.5 shrink-0" />
                            <div class="text-sm text-red-300/90">
                                <p class="font-medium mb-1">Request Denied</p>
                                <p class="text-xs text-red-400/70">
                                    This stable promotion request has been denied. The admin note contains the reason.
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
                            to="/dashboard/admin/stable-promotion-requests"
                        />
                        
                        <div class="flex-1"></div>

                        <UButton
                            v-if="requestData.status === 'pending'"
                            label="Deny"
                            icon="i-lucide-x"
                            color="error"
                            variant="soft"
                            @click="openDecision('denied')"
                        />
                        <UButton
                            v-if="requestData.status === 'pending'"
                            label="Approve"
                            icon="i-lucide-check"
                            color="success"
                            @click="openDecision('approved')"
                        />
                    </div>
                </div>
            </DashboardPageBody>
        </template>
    </UDashboardPanel>

    <UError v-else :error="error" />

    <!-- Decision Modal -->
    <DashboardModal
        v-model:open="decisionModal"
        :title="`Review Request #${requestData.id}`"
        icon="i-lucide-git-pull-request"
        icon-color="sky"
        :loading="submittingDecision"
    >
        <div class="space-y-4">
            <div class="rounded-lg bg-slate-800/50 p-4 space-y-2">
                <div class="flex justify-between items-center">
                    <span class="text-sm text-slate-400">Package</span>
                    <span class="text-sm font-medium text-slate-200">{{ requestData.package_name }}</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-sm text-slate-400">Release Version</span>
                    <span class="text-sm font-mono text-slate-200">{{ requestData.package_release_version }}</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-sm text-slate-400">Created</span>
                    <span class="text-sm text-slate-200">{{ new Date(requestData.created_at).toLocaleString() }}</span>
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

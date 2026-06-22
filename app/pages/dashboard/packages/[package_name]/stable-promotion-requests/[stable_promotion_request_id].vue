<script setup lang="ts">
import type { DevPackage, DevPackageStablePromotionRequest, NewDevPackageStablePromotionRequest } from '~/utils/types';

const route = useRoute();

const stable_promotion_request_id = route.params.stable_promotion_request_id as string;

const pkgData = useSubrouterInjectedData<DevPackage>("package").inject().data as Ref<DevPackage>;

let error = null;

const { data: result, refresh, loading } = await useAPIAsyncData(
    `/dev/packages/${pkgData.value.name}/stable-promotion-requests/${stable_promotion_request_id}`,
    async () => {
        const res = await useAPI((api) => api.getPackagesByFullPackageNameStablePromotionRequestsByStablePromotionRequestId({
            path: {
                fullPackageName: pkgData.value.fullname,
                stablePromotionRequestID: parseInt(stable_promotion_request_id)
            }
        }));
        return res;
    }
)

if (!result.value?.success || !result.value?.data) {
    error = createError({
        statusCode: result.value?.code || 500,
        statusMessage: result.value?.message || 'Failed to load stable promotion request'
    });
}

const data = computed(() => result.value?.data as DevPackageStablePromotionRequest);

useSubrouterInjectedData<DevPackageStablePromotionRequest, NewDevPackageStablePromotionRequest>("stable_promotion_request", true).provide({
    data: data,
    refresh,
    loading,
    isNew: false
});


</script>

<template>
    <NuxtPage v-if="!error" />
    <UError v-else :error="error" />
</template>

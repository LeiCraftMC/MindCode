<script setup lang="ts">
import type { DevPackage, DevPackageRelease, NewDevPackageRelease } from '~/utils/types';

const route = useRoute();

const version_with_leios_patch = route.params.version_with_leios_patch as string;

const pkgData = useSubrouterInjectedData<DevPackage>("package").inject().data as Ref<DevPackage>;

let error = null;

if (version_with_leios_patch === "new") {

    const data = ref<NewDevPackageRelease>({
        version_with_leios_patch: "",
        changelog: "",
    });

    useSubrouterInjectedData<DevPackageRelease, NewDevPackageRelease>("package_release", true).provide({
        data: data,
        isNew: true,
    });

} else {
    const { data: result, refresh, loading } = await useAPIAsyncData(
        `/dev/packages/${pkgData.value.name}/releases/${version_with_leios_patch}`,
        async () => {
            const res = await useAPI((api) => api.getPackagesByFullPackageNameReleasesByVersionWithLeiosPatch({
                path: {
                    fullPackageName: pkgData.value.fullname,
                    version_with_leios_patch
                }
            }));
            return res;
        }
    )

    if (!result.value?.success || !result.value?.data) {
        error = createError({
            statusCode: result.value?.code || 500,
            statusMessage: result.value?.message || 'Failed to load package release data'
        });
    }

    const data = computed(() => result.value?.data as DevPackageRelease);

    useSubrouterInjectedData<DevPackageRelease, NewDevPackageRelease>("package_release", true).provide({
        data: data,
        refresh,
        loading,
        isNew: false
    });
}

</script>

<template>
    <NuxtPage v-if="!error" />
    <UError v-else :error="error" />
</template>

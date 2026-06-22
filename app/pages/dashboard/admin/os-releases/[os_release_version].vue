<script lang="ts" setup>
import type { BreadcrumbItem, NavigationMenuItem } from '@nuxt/ui';
import type { GetAdminOsReleasesResponses, PostAdminOsReleasesData } from '~/api-client';
import type { UseSubrouterPathDynamics } from '~/composables/useSubrouterPathDynamics';

const route = useRoute();

const os_release_version = route.params.os_release_version as string;

type OSRelease = GetAdminOsReleasesResponses["200"]["data"][number];
type NewOSRelease = NonNullable<PostAdminOsReleasesData["body"]>;

definePageMeta({
    layout: 'dashboard'
});

// useSeoMeta({
//     title: `${title} | LeiOS Hub`,
//     description: `Manage OS Release ${os_release_version} on LeiOS Hub`
// });

let error = null;

if (os_release_version === "new") {

    useSubrouterInjectedData<number, NewOSRelease>('os_release', true).provide({
        data: ref({
            changelog: '',
        }),
        refresh: async () => void 0,
        loading: ref(false),
        isNew: true
    });

} else {
    const { data: result, refresh, loading } = await useAPIAsyncData(
        `admin-os-release:${os_release_version}`,
        async () => {
            const res = await useAPI((api) => api.getAdminOsReleasesByVersion({
                path: {
                    version: os_release_version
                }
            }));
            return res;
            // return {
            //     success: true,
            //     data: {
            //         id: 1,
            //         version: os_release_version,
            //         created_at: Date.now() - 1000 * 60 * 60 * 24 * 7,
            //         published_at: Date.now() - 1000 * 60 * 60 * 24 * 3,
            //         publishing_status: 'completed' as OSRelease['publishing_status'],
            //     } satisfies OSRelease
            // };
        }
    )

    if (!result.value?.success || !result.value?.data) {
        error = createError({
            statusCode: result.value?.code || 500,
            statusMessage: result.value?.message || 'Failed to load OS Release data'
        });
    }

    const data = computed(() => result.value?.data as OSRelease);

    useSubrouterInjectedData<OSRelease, NewOSRelease>('os_release', true).provide({
        data,
        refresh,
        loading,
        isNew: false
    });

}

function getRoutesConfig(): UseSubrouterPathDynamics.RoutesConfig {

    return os_release_version === "new" ? {
        [`/dashboard/admin/os-releases/new`]: {
            isNavLink: true,
            label: 'General',
            icon: 'i-lucide-info',
            exact: true,
            getDynamicValues() {
                return {
                    seoSettings: {
                        title: `New Release`,
                        description: `Create a new OS Release on LeiOS Hub`
                    },
                    breadcrumbItems: [
                        { label: 'New Release' }
                    ]
                };
            }
        }
    } : {
        [`/dashboard/admin/os-releases/${os_release_version}`]: {
            isNavLink: true,
            label: 'General',
            icon: 'i-lucide-info',
            exact: true,
            getDynamicValues() {
                return {
                    seoSettings: {
                        title: `Release ${os_release_version}`,
                        description: `Manage OS Release ${os_release_version} on LeiOS Hub`
                    },
                    breadcrumbItems: [
                        { label: os_release_version }
                    ]
                };
            }
        },
        [`/dashboard/admin/os-releases/${os_release_version}/logs`]: {
            isNavLink: true,
            label: 'Logs',
            icon: 'i-lucide-file-text',
            to: `/dashboard/admin/os-releases/${os_release_version}/logs`,
            getDynamicValues() {
                return {
                    seoSettings: {
                        title: `Logs | Release ${os_release_version}`,
                        description: `View logs for OS Release ${os_release_version} on LeiOS Hub`
                    },
                    breadcrumbItems: [
                        { label: os_release_version, to: `/dashboard/admin/os-releases/${os_release_version}` },
                        { label: 'Logs' }
                    ]
                };
            }
        }
    };
}

const subrouterPathDynamics = useSubrouterPathDynamics({
    baseTitle: `OS Releases | LeiOS Hub`,
    basebreadcrumbItems: [
        { label: 'OS Releases', to: '/dashboard/admin/os-releases' }
    ],
    routes: getRoutesConfig()
});

const routePathDynamicValues = await useAwaitedComputed(async () => {
    const values = await subrouterPathDynamics.getPathDynamicValues(route.path);
    useSeoMeta(values.seoSettings);
    return values;
});

</script>

<template>
    <UDashboardPanel>
        <template #header>
            <DashboardPageHeader
                icon="i-lucide-rocket"
                :breadcrumb-items="routePathDynamicValues.breadcrumbItems"
            />

            <UDashboardToolbar>
				<!-- NOTE: The `-mx-1` class is used to align with the `DashboardSidebarCollapse` button here. -->
				<UNavigationMenu :items="subrouterPathDynamics.links" highlight class="-mx-1 flex-1" />
			</UDashboardToolbar>

        </template>

        <template #body>
			<div class="flex flex-col gap-4 sm:gap-6 lg:gap-12 w-full">
				<NuxtPage v-if="!error" />
                <UError v-else-if="error" :error="error" />
			</div>
		</template>

    </UDashboardPanel>
</template>
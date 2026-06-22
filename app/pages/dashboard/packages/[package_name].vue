<script lang="ts" setup>
import type { GetPackagesByFullPackageNameResponses, PostPackagesData } from '~/api-client';
import type { UseSubrouterPathDynamics } from '~/composables/useSubrouterPathDynamics';

const toast = useToast();
const route = useRoute();

const package_name = route.params.package_name as string;

type DevPackage = GetPackagesByFullPackageNameResponses["200"]["data"];
type NewDevPackage = NonNullable<PostPackagesData["body"]>;

definePageMeta({
    layout: 'dashboard'
});

let error = null;

if (package_name === "new") {

    const data = ref<NewDevPackage>({
        publisher_id: 0,
        name: "",
        display_name: "",
        description: "",
        homepage_url: "",
        requires_patching: false
    });

    useSubrouterInjectedData<DevPackage, NewDevPackage>("package", true).provide({
        data: data,
        isNew: true,
    });

} else {
    const { data: result, refresh, loading } = await useAPIAsyncData(
        `/dev/packages/${package_name}`,
        async () => {
            const res = await useAPI((api) => api.getPackagesByFullPackageName({
                path: {
                    fullPackageName: package_name
                }
            }));
            return res;
        }
    )

    if (!result.value?.success || !result.value?.data) {
        error = createError({
            statusCode: result.value?.code || 500,
            statusMessage: result.value?.message || 'Failed to load package data'
        });
    }

    const data = computed(() => result.value?.data as DevPackage);

    useSubrouterInjectedData<DevPackage, NewDevPackage>("package", true).provide({
        data: data,
        refresh,
        loading,
        isNew: false
    });
}


// const pathDynamicValues = computed(() => {
//     const breadcrumbItems: BreadcrumbItem[] = [
//         { label: 'Packages', to: '/dashboard/packages' },
//     ];

//     let seoSettings: Parameters<typeof useSeoMeta>[0] = {};

//     const normalizedPath = route.path.replace(/\/$/, '');

//     if (normalizedPath.endsWith('/releases')) {

//         seoSettings = {
//             title: `Releases | ${package_name} | Packages | LeiOS Hub`,
//             description: `Manage releases for the package ${package_name} on LeiOS Hub`
//         };

//         breadcrumbItems.push(
//             { label: package_name, to: `/dashboard/packages/${package_name}` },
//             { label: 'Releases' }
//         );

//     } else if (normalizedPath.endsWith('/stable-promotion-requests')) {

//         seoSettings = {
//             title: `Stable Promotion Requests | ${package_name} | Packages | LeiOS Hub`,
//             description: `Manage stable promotion requests for the package ${package_name} on LeiOS Hub`
//         };

//         breadcrumbItems.push(
//             { label: package_name, to: `/dashboard/packages/${package_name}` },
//             { label: 'Stable Promotion Requests' }
//         );

//     } else {

//         seoSettings = {
//             title: `${package_name} | Packages | LeiOS Hub`,
//             description: `Manage the package ${package_name} on LeiOS Hub`
//         };

//         breadcrumbItems.push({ label: package_name });
//     }

//     useSeoMeta(seoSettings);

//     return { breadcrumbItems };
// });

// const links = [[
//     {
//         label: 'General',
//         icon: 'i-lucide-info',
//         to: `/dashboard/packages/${package_name}`,
//         exact: true
//     },
//     {
//         label: 'Releases',
//         icon: 'i-lucide-file-text',
//         to: `/dashboard/packages/${package_name}/releases`,
//     },
//     {
//         label: 'Stable Promotion Requests',
//         icon: 'i-lucide-git-pull-request',
//         to: `/dashboard/packages/${package_name}/stable-promotion-requests`,
//     }
// ]] satisfies NavigationMenuItem[][];

function getRoutesConfig(): Ref<UseSubrouterPathDynamics.RoutesConfig> {
    return computed(() => {
        if (package_name === "new") {
            return {
                [`/dashboard/packages/new`]: {
                    isNavLink: true,
                    label: 'General',
                    icon: 'i-lucide-info',
                    exact: true,
                    getDynamicValues() {
                        return {
                            breadcrumbItems: [
                                { label: 'New Package' }
                            ],
                            seoSettings: {
                                title: `New Package | Packages | LeiOS Hub`,
                                description: `Create a new package on LeiOS Hub`
                            }
                        };
                    }
                }
            }
        } else {
            return {

                [`/dashboard/packages/${package_name}`]: {
                    isNavLink: true,
                    label: 'General',
                    icon: 'i-lucide-info',
                    exact: true,
                    getDynamicValues() {
                        return {
                            breadcrumbItems: [
                                { label: package_name }
                            ],
                            seoSettings: {
                                description: `Manage the package ${package_name} on LeiOS Hub`
                            }
                        };
                    }
                },

                [`/dashboard/packages/${package_name}/releases`]: {
                    isNavLink: true,
                    label: 'Releases',
                    icon: 'i-lucide-file-text',
                    active: useRoute().path.startsWith(`/dashboard/packages/${package_name}/releases`),
                    getDynamicValues() {
                        return {
                            breadcrumbItems: [
                                { label: package_name, to: `/dashboard/packages/${package_name}` },
                                { label: 'Releases' }
                            ],
                            seoSettings: {
                                title: `Releases`,
                                description: `Manage releases for the package ${package_name} on LeiOS Hub`
                            }
                        };
                    }
                },

                [`/dashboard/packages/${package_name}/releases/[version_with_leios_patch]`]: {
                    isNavLink: false,
                    getDynamicValues(params) {
                        if (params.version_with_leios_patch === "new") {
                            return {
                                breadcrumbItems: [
                                    { label: package_name, to: `/dashboard/packages/${package_name}` },
                                    { label: 'Releases', to: `/dashboard/packages/${package_name}/releases` },
                                    { label: 'New Release' }
                                ],
                                seoSettings: {
                                    title: `New Release | Releases`,
                                    description: `Create a new release for the package ${package_name} on LeiOS Hub`
                                }
                            };
                        }
                        return {
                            breadcrumbItems: [
                                { label: package_name, to: `/dashboard/packages/${package_name}` },
                                { label: 'Releases', to: `/dashboard/packages/${package_name}/releases` },
                                { label: params.version_with_leios_patch }
                            ],
                            seoSettings: {
                                title: `Release ${params.version_with_leios_patch} | Releases`,
                                description: `Manage the release ${params.version_with_leios_patch} for the package ${package_name} on LeiOS Hub`
                            }
                        };
                    }
                },

                [`/dashboard/packages/${package_name}/roles`]: {
                    isNavLink: true,
                    label: 'Roles',
                    icon: 'i-lucide-shield',
                    to: `/dashboard/packages/${package_name}/roles`,
                    active: useRoute().path.startsWith(`/dashboard/packages/${package_name}/roles`),
                    getDynamicValues() {
                        return {
                            breadcrumbItems: [
                                { label: package_name, to: `/dashboard/packages/${package_name}` },
                                { label: 'Roles' }
                            ],
                            seoSettings: {
                                title: 'Roles',
                                description: `Manage role assignments for the package ${package_name} on LeiOS Hub`
                            }
                        };
                    }
                },


                [`/dashboard/packages/${package_name}/stable-promotion-requests`]: {
                    isNavLink: true,
                    label: 'Stable Promotion Requests',
                    icon: 'i-lucide-git-pull-request',
                    to: `/dashboard/packages/${package_name}/stable-promotion-requests`,
                    active: useRoute().path.startsWith(`/dashboard/packages/${package_name}/stable-promotion-requests`),
                    getDynamicValues() {
                        return {
                            breadcrumbItems: [
                                { label: package_name, to: `/dashboard/packages/${package_name}` },
                                { label: 'Stable Promotion Requests' }
                            ],
                            seoSettings: {
                                title: `Stable Promotion Requests`,
                                description: `Manage stable promotion requests for the package ${package_name} on LeiOS Hub`
                            }
                        };
                    }
                },

                [`/dashboard/packages/${package_name}/stable-promotion-requests/[stable_promotion_request_id]`]: {
                    isNavLink: false,
                    getDynamicValues(params) {
                        return {
                            breadcrumbItems: [
                                { label: package_name, to: `/dashboard/packages/${package_name}` },
                                { label: 'Stable Promotion Requests', to: `/dashboard/packages/${package_name}/stable-promotion-requests` },
                                { label: `#${params.stable_promotion_request_id}` }
                            ],
                            seoSettings: {
                                title: `Stable Promotion Request #${params.stable_promotion_request_id}`,
                                description: `Manage stable promotion request #${params.stable_promotion_request_id} for the package ${package_name} on LeiOS Hub`
                            }
                        };
                    }
                },
            }
        }
    });
}

const subrouterPathDynamics = useSubrouterPathDynamics({
    baseTitle: `${package_name} | Packages | LeiOS Hub`,
    basebreadcrumbItems: [
        { label: 'Packages', to: '/dashboard/packages' },
    ],
    routes: getRoutesConfig()
});
const navigationMenuItems = subrouterPathDynamics.links;

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
                icon="i-lucide-package"
                :breadcrumb-items="routePathDynamicValues.breadcrumbItems"
            />

            <UDashboardToolbar>
				<!-- NOTE: The `-mx-1` class is used to align with the `DashboardSidebarCollapse` button here. -->
				<UNavigationMenu :items="navigationMenuItems" highlight class="-mx-1 flex-1" />
			</UDashboardToolbar>

        </template>

        <template #body>
			<div class="flex flex-col gap-4 sm:gap-6 lg:gap-12 w-full">
				<NuxtPage v-if="!error" />
                <UError v-else :error="error" />
			</div>
		</template>

    </UDashboardPanel>
</template>

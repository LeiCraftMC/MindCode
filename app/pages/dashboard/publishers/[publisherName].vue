<script lang="ts" setup>
import type { Publisher, NewPublisher } from '~/utils/types';

const toast = useToast();
const route = useRoute();

const publisherName = route.params.publisherName as string;

type FullPublisher = Publisher;
type NewPub = NewPublisher;

definePageMeta({
    layout: 'dashboard'
});

let error = null;

if (publisherName === "new") {
    const data = ref<NewPub>({
        name: "",
        display_name: "",
        description: "",
        homepage_url: "",
    });

    useSubrouterInjectedData<FullPublisher, NewPub>("publisher", true).provide({
        data: data as Ref<NewPub>,
        isNew: true,
    });
} else {
    const { data: result, refresh, loading } = await useAPIAsyncData(
        `/dashboard/publishers/${publisherName}`,
        async () => {
            const res = await useAPI((api) => api.getPublishersByPublisherName({
                path: { publisherName }
            }));
            return res;
        }
    );

    if (!result.value?.success || !result.value?.data) {
        error = createError({
            statusCode: result.value?.code || 500,
            statusMessage: result.value?.message || 'Failed to load publisher data'
        });
    }

    const data = computed(() => result.value?.data as FullPublisher);

    useSubrouterInjectedData<FullPublisher, NewPub>("publisher", true).provide({
        data: data,
        refresh,
        loading,
        isNew: false
    });
}

function getRoutesConfig() {
    return computed(() => {
        if (publisherName === "new") {
            return {
                [`/dashboard/publishers/new`]: {
                    isNavLink: true,
                    label: 'General',
                    icon: 'i-lucide-info',
                    exact: true,
                    getDynamicValues() {
                        return {
                            breadcrumbItems: [
                                { label: 'New Publisher' }
                            ],
                            seoSettings: {
                                title: 'New Publisher | Publishers | LeiOS Hub',
                                description: 'Create a new publisher on LeiOS Hub'
                            }
                        };
                    }
                }
            }
        } else {
            return {
                [`/dashboard/publishers/${publisherName}`]: {
                    isNavLink: true,
                    label: 'General',
                    icon: 'i-lucide-info',
                    exact: true,
                    getDynamicValues() {
                        return {
                            breadcrumbItems: [
                                { label: publisherName }
                            ],
                            seoSettings: {
                                description: `Manage the publisher ${publisherName} on LeiOS Hub`
                            }
                        };
                    }
                },

                [`/dashboard/publishers/${publisherName}/members`]: {
                    isNavLink: true,
                    label: 'Members',
                    icon: 'i-lucide-users',
                    active: useRoute().path.startsWith(`/dashboard/publishers/${publisherName}/members`),
                    getDynamicValues() {
                        return {
                            breadcrumbItems: [
                                { label: publisherName, to: `/dashboard/publishers/${publisherName}` },
                                { label: 'Members' }
                            ],
                            seoSettings: {
                                title: 'Members',
                                description: `Manage members of the publisher ${publisherName} on LeiOS Hub`
                            }
                        };
                    }
                },
            }
        }
    });
}

const subrouterPathDynamics = useSubrouterPathDynamics({
    baseTitle: `${publisherName} | Publishers | LeiOS Hub`,
    basebreadcrumbItems: [
        { label: 'Publishers', to: '/dashboard/publishers' },
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
                icon="i-lucide-building"
                :breadcrumb-items="routePathDynamicValues.breadcrumbItems"
            />

            <UDashboardToolbar>
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

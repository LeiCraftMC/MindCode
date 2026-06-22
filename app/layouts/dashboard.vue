<script setup lang="ts">
import type { NavigationMenuItem } from "@nuxt/ui";
import UserMenu from "~/components/dashboard/UserMenu.vue";
import MindCodeLogo from "~/components/img/MindCodeLogo.vue";
import MindCodeIcon from "~/components/img/MindCodeIcon.vue";
import { useUserInfoStore } from "~/composables/stores/useUserStore";

const userInfoStore = useUserInfoStore();
const user = await userInfoStore.use();

const isAdmin = computed(() => user.value?.role === "admin");

const sidebarItems = computed(() => {
    const devItems: NavigationMenuItem[] = [
        {
            label: "Overview",
            icon: "i-lucide-layout-dashboard",
            to: "/dashboard",
        },
        {
            label: "Packages",
            icon: "i-lucide-package",
            to: "/dashboard/packages",
        },
        {
            label: "Publishers",
            icon: "i-lucide-building",
            to: "/dashboard/publishers",
        },
        {
            label: "API Keys",
            icon: "i-lucide-key",
            to: "/dashboard/apikeys",
        },
    ];

    const adminItems: NavigationMenuItem[] = [
        {
            label: "Admin",
            icon: "i-lucide-shield",
            type: "label",
            // defaultOpen: route.path.startsWith("/dashboard/admin"),
            // children: [
            //     {
            //         label: "Stable Promotion Requests",
            //         to: "/dashboard/admin/stable-promotion-requests",
            //     },
            //     {
            //         label: "Users",
            //         to: "/dashboard/admin/users",
            //     },
            //     {
            //         label: "All Packages",
            //         to: "/dashboard/admin/packages",
            //     },
            // ],
        },
        {
            label: "Users",
            icon: "i-lucide-users",
            to: "/dashboard/admin/users",
        },
        {
            label: "All Packages",
            icon: "i-lucide-package-search",
            to: "/dashboard/admin/packages",
        },
        {
            label: "Stable Promotion Requests",
            icon: "i-lucide-git-pull-request",
            to: "/dashboard/admin/stable-promotion-requests",
        },
        {
            label: "OS Releases",
            icon: "i-lucide-rocket",
            to: "/dashboard/admin/os-releases",
        },
        {
            label: "Tasks",
            icon: "i-lucide-list-checks",
            to: "/dashboard/admin/tasks",
        }
    ];


    const settings: NavigationMenuItem[] = [
        {
            label: "Settings",
            icon: "i-lucide-settings",
            type: "label",
        },
        {
            label: "General",
            icon: "i-lucide-user",
            to: "/dashboard/settings",
            exact: true,
        },
        {
            label: "Security",
            icon: "i-lucide-shield",
            to: "/dashboard/settings/security",
        },
    ];

    const footerItems: NavigationMenuItem[] = [
        {
            label: "Explorer",
            icon: "i-lucide-compass",
            to: "/explore",
        },
        {
            label: "Back to Home",
            icon: "i-lucide-home",
            to: "/",
        },
    ];

    return {
        dev: devItems,
        settings: settings,
        admin: adminItems,
        footer: footerItems,
    }
});


</script>

<template>
    <NuxtLoadingIndicator
        color="#00bcff"
        position="top"
    />

    <UDashboardGroup class="app-layout-dashboard main-bg-color">
        <UDashboardSidebar
            collapsible
            resizable
            :ui="{
                header: 'main-bg-color',
                body: 'main-bg-color',
                content: 'main-bg-color',
                footer: 'border-t border-default main-bg-color',
            }"
            :min-size="18"
            :default-size="20"
            :max-size="30"
        >
            <template #header="{ collapsed }">
                <NuxtLink to="/" :class="`${!collapsed ? 'ms-2.5' : ''} flex items-center gap-1.5`">
                    <MindCodeLogo v-if="!collapsed" class="h-6 w-auto flex-none" />
                    <MindCodeIcon v-else class="h-8 w-8" />
                </NuxtLink>
            </template>

            <template #default="{ collapsed }">
                <UNavigationMenu
                    :collapsed="collapsed"
                    :items="sidebarItems.dev"
                    orientation="vertical"
                />

                <UNavigationMenu
                    v-if="isAdmin"
                    :collapsed="collapsed"
                    :items="sidebarItems.admin"
                    orientation="vertical"
                />

                <UNavigationMenu
                    :collapsed="collapsed"
                    :items="sidebarItems.settings"
                    orientation="vertical"
                />

                <UNavigationMenu
                    :collapsed="collapsed"
                    :items="sidebarItems.footer"
                    orientation="vertical"
                    class="mt-auto"
                />
            </template>

            <template #footer="{ collapsed }">
                <UserMenu :collapsed="collapsed"></UserMenu>
            </template>
        </UDashboardSidebar>

        <slot />
    </UDashboardGroup>
</template>

<style scoped>
.app-layout-dashboard {
    color: rgb(241 245 249);
}
</style>

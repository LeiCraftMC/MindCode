<script setup lang="ts">
import type { NavigationMenuItem } from "@nuxt/ui";
import UserMenu from "~/components/dashboard/UserMenu.vue";
import MindCodeLogo from "~/components/img/MindCodeLogo.vue";
import MindCodeIcon from "~/components/img/MindCodeIcon.vue";
import { useUserInfoStore } from "~/composables/stores/useUserStore";

const userInfoStore = useUserInfoStore();
const user = await userInfoStore.use();

const isAdmin = computed(() => user.value?.role === "admin");

const route = useRoute();

const sidebarItems = computed(() => {
    const basicItems: NavigationMenuItem[] = [
        {
            label: "Projects",
            icon: "i-lucide-layout-dashboard",
            to: "/projects",
        },
        {
            label: "Claude Code",
            icon: "i-lucide-bot",
            to: "/code",
        },
    ];

    const adminItems: NavigationMenuItem[] = [
        {
            label: "Admin",
            icon: "i-lucide-shield",
            type: "label"
        },
        {
            label: "Users",
            icon: "i-lucide-users",
            to: "/admin/users",
        },
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
            to: "/settings",
            exact: true,
        },
        {
            label: "Security",
            icon: "i-lucide-shield",
            to: "/settings/security",
        }
    ];

    return {
        basic: basicItems,
        settings: settings,
        admin: adminItems,
    }
});

const displaySidebars = computed(() => {

    const settingsSidebar = route.path.startsWith('/settings');
    const adminSidebar = route.path.startsWith('/admin');

    return {
        basicSidebar: !settingsSidebar && !adminSidebar,
        settingsSidebar: settingsSidebar,
        adminSidebar: adminSidebar,
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
                    v-if="displaySidebars.basicSidebar"
                    :collapsed="collapsed"
                    :items="sidebarItems.basic"
                    orientation="vertical"
                />

                <UNavigationMenu
                    v-if="displaySidebars.adminSidebar || displaySidebars.settingsSidebar"
                    :collapsed="collapsed"
                    :items="[{
                        label: 'Go back to Projects',
                        icon: 'i-lucide-arrow-left',
                        to: '/projects',
                    }]"
                    orientation="vertical"
                    class="mb-2"
                />

                <UNavigationMenu
                    v-if="isAdmin && displaySidebars.adminSidebar"
                    :collapsed="collapsed"
                    :items="sidebarItems.admin"
                    orientation="vertical"
                />

                <UNavigationMenu
                    v-if="displaySidebars.settingsSidebar"
                    :collapsed="collapsed"
                    :items="sidebarItems.settings"
                    orientation="vertical"
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

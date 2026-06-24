<script setup lang="ts">
import type { NavigationMenuItem } from "@nuxt/ui";
import UserMenu from "~/components/dashboard/UserMenu.vue";
import MindCodeLogo from "~/components/img/MindCodeLogo.vue";
import MindCodeIcon from "~/components/img/MindCodeIcon.vue";
import { useUserInfoStore } from "~/composables/stores/useUserStore";
import { useSelectedProjectStore } from "~/composables/stores/useSelectedProjectStore";

const route = useRoute();

const userInfoStore = useUserInfoStore();
const user = await userInfoStore.use();

const isAdmin = computed(() => user.value?.role === "admin");

const currentProjectStore = await useSelectedProjectStore();
const currentProject = await currentProjectStore.use();
const currentProjectSessions = computed(() => currentProject.value?.sessions || []);

const sidebarItems = computed(() => {

    const basicItems: NavigationMenuItem[] = [
        {
            label: "No Project Selected",
            icon: "i-lucide-folder",
            type: "label"
        },
        {
            label: 'No Session to show',
            icon: 'i-lucide-message-square',
            exact: false,
        }
    ];

    const projectItems: NavigationMenuItem[] = [
        {
            label: currentProject.value?.name || "No Project Name",
            icon: "i-lucide-folder",
            type: "label"
        }
    ];
    
    const projectSessionsItems: NavigationMenuItem[] = [];

    if (currentProjectSessions.value.length > 0) {
        projectSessionsItems.push({
            label: "Sessions",
            icon: "i-lucide-mail",
            type: "label"
        });

        for (const session of currentProjectSessions.value) {
            projectSessionsItems.push({
                label: session.title,
                icon: "i-lucide-mail",
                to: `/projects/${encodeURIComponent(currentProject?.value?.absolute_path || '')}/sessions/${session.session_id}`,
                exact: false,
            });
        }
    } else {
        projectSessionsItems.push({
            label: 'No Session to show',
            icon: 'i-lucide-message-square',
            exact: false,
        });
    }

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

        project: projectItems,
        projectSessions: projectSessionsItems,

        settings: settings,
        admin: adminItems,
    }
});

const displaySidebars = computed(() => {

    const settingsSidebar = route.path.startsWith('/settings');
    const adminSidebar = route.path.startsWith('/admin');
    const projectSidebar = !!route.params.absolute_path

    return {
        basicSidebar: !settingsSidebar && !adminSidebar && !projectSidebar,
        projectSidebar: projectSidebar,
        settingsSidebar: settingsSidebar,
        adminSidebar: adminSidebar,
    }
});

</script>

<template>
    <NuxtLoadingIndicator
        color="#f97316"
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

               <div
                    v-if="displaySidebars.projectSidebar"
                    class="flex flex-col main-bg-color"
                >
                    <UNavigationMenu
                        :collapsed="collapsed"
                        :items="sidebarItems.project"
                        orientation="vertical"
                    />

                    <!-- Compose Button - Prominent -->
                    <div v-if="currentProject" class="px-2 mb-2">
                            <UButton
                                v-if="!collapsed"
                                icon="i-lucide-pen-square"
                                color="primary"
                                variant="solid"
                                size="md"
                                class="w-full justify-start"
                                :to="`/projects/${encodeURIComponent(currentProject.absolute_path)}/sessions/new`"
                            >
                                New Session
                            </UButton>
                            <UTooltip v-else text="New Session">
                                <UButton
                                    icon="i-lucide-pen-square"
                                    color="primary"
                                    variant="solid"
                                    size="md"
                                    :to="`/projects/${encodeURIComponent(currentProject.absolute_path)}/sessions/new`"
                                />
                            </UTooltip>
                        </div>

                    <UNavigationMenu
                        :collapsed="collapsed"
                        :items="sidebarItems.projectSessions"
                        orientation="vertical"
                        class="mt-0"
                    />
                </div>

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

                <UNavigationMenu
                    v-if="displaySidebars.adminSidebar || displaySidebars.settingsSidebar || displaySidebars.projectSidebar"
                    :collapsed="collapsed"
                    :items="[{
                        label: 'Go back to Project Selection',
                        icon: 'i-lucide-arrow-left',
                        to: '/projects',
                    }]"
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

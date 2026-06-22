<script setup lang="ts">
definePageMeta({
    layout: 'dashboard',
});

useSeoMeta({
    title: 'Dashboard | MindCode',
    description: 'Welcome to your MindCode dashboard'
});

const userInfoStore = useUserInfoStore();
const user = await userInfoStore.use();
if (!userInfoStore.isValid(user)) {
    throw new Error('User not authenticated but trying to access Dashboard');
}

const isAdmin = computed(() => user.value?.role === 'admin');
</script>

<template>
    <UDashboardPanel>
        <template #header>
            <UDashboardNavbar title="Dashboard" icon="i-lucide-layout-dashboard" />
        </template>

        <template #body>
            <div class="space-y-6">
                <div class="flex items-center justify-between">
                    <div>
                        <h1 class="text-2xl font-bold">
                            Welcome back, {{ user?.display_name || user?.username }}
                        </h1>
                        <p class="text-slate-400 mt-1">
                            This is your MindCode dashboard.
                        </p>
                    </div>
                    <UBadge v-if="isAdmin" color="primary" variant="soft" size="lg">
                        <UIcon name="i-lucide-shield" class="mr-1" />
                        Admin
                    </UBadge>
                </div>

                <UCard class="border-slate-800 bg-slate-900/60">
                    <UEmpty
                        icon="i-lucide-rocket"
                        title="Getting started"
                        description="Your dashboard is ready. Use the sidebar to manage users, settings, and more."
                    />
                </UCard>
            </div>
        </template>
    </UDashboardPanel>
</template>

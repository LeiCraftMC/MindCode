<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'
import LeiOSLogo from '../img/LeiOSLogo.vue';
import type { GetAccountResponses } from '~/api-client';
import type { UnwrapRef } from 'vue';
import { useUserInfoStore } from '~/composables/stores/useUserStore';

type UserInfo = GetAccountResponses["200"]["data"];

const route = useRoute()
const sessionCookie = useAppCookies().sessionToken.get()
const userInfoStore = useUserInfoStore();
const user = await userInfoStore.use();

const links = computed<NavigationMenuItem[]>(() => [
    {
        label: 'Home',
        to: '/'
    },
    {
        label: 'Explorer',
        to: '/explore'
    },
    {
        label: 'Dashboard',
        to: '/dashboard'
    }
])

const isAuthenticated = computed(() => Boolean(sessionCookie.value))

const profileLabel = computed(() => {
    if (user.value?.display_name) return user.value.display_name
    if (user.value?.username) return user.value.username
    return 'Profile'
})

const redirectQuery = computed(() => encodeURIComponent(route.fullPath))
</script>

<template>
    <UHeader class="backdrop-blur-xl">
        <template #left>
            <div class="flex items-center gap-2">
                <NuxtLink to="https://www.leios.dev" target="_blank">
                    <LeiOSLogo class="h-8 w-auto" />
                </NuxtLink>
                <NuxtLink to="/" class="flex items-center gap-2 text-2xl font-bold leading-none">
                    <span>/</span>
                    <span>Hub</span>
                </NuxtLink>
            </div>
        </template>

        <UNavigationMenu :items="links" />

        <template #body>
            <UNavigationMenu :items="links" orientation="vertical" class="w-full" />
        </template>

        <template #right>
            <div class="flex items-center gap-2">
                <template v-if="isAuthenticated">
                    <div class="hidden sm:flex items-center gap-1.5 text-white">
                        <UIcon name="i-lucide-user" class="size-4" />
                        <span class="text-sm">{{ profileLabel }}</span>
                    </div>
                    <UButton
                        icon="i-lucide-layout-dashboard"
                        to="/dashboard"
                        color="primary"
                        variant="soft"
                        class="hidden sm:flex"
                    >
                        Dashboard
                    </UButton>
                </template>

                <UButton v-else icon="i-lucide-log-in" :to="`/auth/login?url=${redirectQuery}`" color="primary"
                    variant="solid" class="">
                    Login
                </UButton>
            </div>
        </template>
    </UHeader>
</template>

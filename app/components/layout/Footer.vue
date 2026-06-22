<script setup lang="ts">
import type { FooterColumn } from '@nuxt/ui'

const socialLinks = [
    { icon: 'i-lucide-github', to: 'https://github.com/LeiOS-project', label: 'GitHub' },
    { icon: 'i-lucide-message-circle', to: 'https://discord.gg/8YC5BXjCc5', label: 'Discord' }
]

const resourceLinks = [
    { label: 'Blog', to: 'https://blog.leicraftmc.de/tag/leios/', target: '_blank' },
    { label: 'Source Code', to: 'https://git.leicraftmc.de/LeiOS/', target: '_blank' },
    { label: 'GitHub', to: 'https://github.com/LeiOS-project', target: '_blank' }
]

const communityLinks = [
    { label: 'Discord', to: 'https://discord.gg/8YC5BXjCc5', target: '_blank' },
    { label: 'Contribute', to: 'https://github.com/LeiOS-project', target: '_blank' }
]

const footerColumns: FooterColumn[] = [
    { label: 'Resources', children: resourceLinks },
    { label: 'Community', children: communityLinks }
]

const currentYear = new Date().getFullYear()
</script>

<template>
    <USeparator></USeparator>
    <UFooter :ui='{
        root: "py-12",
        container: "py-0 lg:py-0 lg:gap-x-0 gap-x-0 lg:block",
        bottom: "p-0 lg:p-0 mt-8"
    }'>
        <UFooterColumns :columns="footerColumns" :ui="{
            root: 'grid gap-8 sm:grid-cols-2 xl:grid-cols-2 w-full',
            center: 'xl:col-span-1 grid',
            label: 'text-slate-100 font-semibold text-base',
            link: 'text-slate-400 hover:text-sky-400 text-sm sm:text-base inline-block py-1 transition-colors',
            left: 'mb-0'
        }">
            <template #left>
                <div class="space-y-4">
                    <span
                        class="inline-block text-2xl font-bold bg-linear-to-tr from-sky-400 to-sky-200 bg-clip-text text-transparent">LeiOS</span>
                    <p class="text-slate-300/80 text-base leading-relaxed md:max-w-3xl">
                        A Debian-based operating system focused on stability, performance, and an exceptional out-of-box
                        experience. Built by developers, for everyone.
                    </p>
                    <div class="flex gap-2 pt-2">
                        <UButton v-for="social in socialLinks" :key="social.label" :to="social.to" target="_blank"
                            :icon="social.icon" color="neutral" variant="ghost" size="lg" :aria-label="social.label"
                            class="transition-transform hover:scale-110 hover:text-sky-400" />
                    </div>
                </div>
            </template>
        </UFooterColumns>

        <template #bottom>
            <UContainer>
                <div
                    class="border-t border-slate-800 pt-8 flex flex-col items-center text-center md:flex-row md:justify-between md:text-left">
                    <p class="text-slate-500 text-xs sm:text-sm">
                        © {{ currentYear }} LeiOS Project. Open Source under AGPL-3.0 License.
                    </p>
                    <p class="text-slate-500 text-xs sm:text-sm">
                        Built with ❤️ for the community
                    </p>
                </div>
            </UContainer>
        </template>
    </UFooter>
</template>

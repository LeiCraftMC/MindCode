<script setup lang="ts">
import type { FooterColumn } from '@nuxt/ui'

const currentYear = new Date().getFullYear()
</script>

<template>
    <USeparator></USeparator>
    <UFooter :ui='{
        root: "py-12",
        container: "py-0 lg:py-0 lg:gap-x-0 gap-x-0 lg:block",
        bottom: "p-0 lg:p-0 mt-8"
    }'>
        <UFooterColumns :columns="[]" :ui="{
            root: 'grid gap-8 sm:grid-cols-2 xl:grid-cols-2 w-full',
            center: 'xl:col-span-1 grid',
            label: 'text-slate-100 font-semibold text-base',
            link: 'text-slate-400 hover:text-sky-400 text-sm sm:text-base inline-block py-1 transition-colors',
            left: 'mb-0'
        }">
            <template #left>
                <div class="space-y-4">
                    <span
                        class="inline-block text-2xl font-bold bg-linear-to-tr from-sky-400 to-sky-200 bg-clip-text text-transparent">MindCode</span>
                    <p class="text-slate-300/80 text-base leading-relaxed md:max-w-3xl">
                        A new home for your code, packages, and projects.
                    </p>
                </div>
            </template>
        </UFooterColumns>

        <template #bottom>
            <UContainer>
                <div
                    class="border-t border-slate-800 pt-8 flex flex-col items-center text-center md:flex-row md:justify-between md:text-left">
                    <p class="text-slate-500 text-xs sm:text-sm">
                        © {{ currentYear }} MindCode. Open Source under AGPL-3.0 License.
                    </p>
                    <p class="text-slate-500 text-xs sm:text-sm">
                        Built with ❤️ for the community
                    </p>
                </div>
            </UContainer>
        </template>
    </UFooter>
</template>

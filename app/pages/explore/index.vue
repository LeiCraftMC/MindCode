<script setup lang="ts">
import type { GetPackagesResponses } from '~/api-client';

type PublicPackage = GetPackagesResponses[200]['data'][number]

const toast = useToast()
const search = ref('')

const { data: packages, pending, refresh } = await useAsyncData<PublicPackage[]>('public-packages', async () => {
    const res = await useAPI((api) => api.getPackages({}), true)
    if (!res.success) {
        toast.add({ title: 'Failed to load packages', description: res.message, color: 'error' })
        return []
    }
    return res.data
})

const filteredPackages = computed(() => {
    const term = search.value.trim().toLowerCase()
    if (!term) return packages.value || []
    return (packages.value || []).filter((pkg) =>
        pkg.name.toLowerCase().includes(term) ||
        (pkg.description || '').toLowerCase().includes(term) ||
        (pkg.homepage_url || '').toLowerCase().includes(term)
    )
})
</script>

<template>
    <div class="bg-slate-950/40 py-12">
        <UContainer class="space-y-8">
            <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div class="space-y-2">
                    <UBadge color="primary" variant="soft">Explorer</UBadge>
                    <h1 class="text-3xl font-bold">Browse LeiOS packages</h1>
                    <p class="text-slate-400">Public view of repository metadata across archive, testing, and stable.</p>
                </div>
                <div class="flex items-center gap-2">
                    <UInput v-model="search" icon="i-lucide-search" placeholder="Search by name or description" class="w-full md:w-80" />
                    <UButton variant="ghost" icon="i-lucide-refresh-cw" :loading="pending" @click="() => refresh()">Refresh</UButton>
                </div>
            </div>

            <UCard class="border-slate-800 bg-slate-900/60">
                <div class="space-y-4 p-4">
                    <div v-if="pending" class="flex items-center gap-3 text-slate-400">
                        <UIcon name="i-lucide-loader-2" class="animate-spin" /> Loading packages...
                    </div>

                    <div v-else-if="!filteredPackages.length" class="text-slate-400">
                        No packages found.
                    </div>

                    <div v-else class="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                        <UCard v-for="pkg in filteredPackages" :key="pkg.name" class="border-slate-800 bg-slate-900/70">
                            <div class="space-y-3 p-4">
                                <div class="flex items-center justify-between">
                                    <div class="flex items-center gap-2">
                                        <UIcon name="i-lucide-package" class="text-sky-400" />
                                        <h3 class="text-lg font-semibold">{{ pkg.name }}</h3>
                                    </div>
                                    <UBadge color="neutral" variant="soft">publisher #{{ pkg.publisher_id }}</UBadge>
                                </div>
                                <p class="text-sm text-slate-400">{{ pkg.description || 'No description provided.' }}</p>
                                <div class="flex flex-wrap gap-2">
                                    <UButton size="sm" variant="soft" color="primary" :to="`/explore/${pkg.fullname}`">
                                        View details
                                    </UButton>
                                    <UButton v-if="pkg.homepage_url" size="sm" variant="ghost" color="neutral" :to="pkg.homepage_url" target="_blank" icon="i-lucide-external-link">
                                        Homepage
                                    </UButton>
                                </div>
                            </div>
                        </UCard>
                    </div>
                </div>
            </UCard>
        </UContainer>
    </div>
</template>

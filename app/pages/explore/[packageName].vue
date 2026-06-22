<script setup lang="ts">
import type { TableColumn } from '#ui/types'
import type {
    GetPackagesByFullPackageNameReleasesResponses,
    GetPackagesByFullPackageNameResponses
} from '~/api-client'

const toast = useToast()
const route = useRoute()
const router = useRouter()

type PublicPackage = GetPackagesByFullPackageNameResponses[200]['data']
type PackageRelease = GetPackagesByFullPackageNameReleasesResponses[200]['data'][number]

const repoOptions = [
    { label: 'All repositories', value: 'all' },
    { label: 'Archive', value: 'leios-archive' },
    { label: 'Testing', value: 'leios-testing' },
    { label: 'Stable', value: 'leios-stable' }
]

const repo = ref<'all' | 'leios-archive' | 'leios-testing' | 'leios-stable'>('all')

const packageName = computed(() => route.params.packageName as string)

const { data: packageInfo, pending, refresh } = await useAsyncData<PublicPackage | null>(
    `public-package-${packageName.value}`,
    async () => {
        const res = await useAPI(
            (api) =>
                api.getPackagesByFullPackageName({
                    path: { fullPackageName: packageName.value }
                }),
            true
        )

        if (!res.success) {
            toast.add({ title: 'Failed to load package', description: res.message, color: 'error' })
            if (Number(res.code) === 404) {
                await router.push('/explore')
            }
            return null
        }
        return res.data
    },
    { watch: [packageName] }
)

const { data: releaseData } = await useAsyncData<PackageRelease[]>(
    `public-package-releases-${packageName.value}`,
    async () => {
        const res = await useAPI(
            (api) => api.getPackagesByFullPackageNameReleases({ path: { fullPackageName: packageName.value } }),
            true
        )

        if (!res.success) {
            return []
        }

        return res.data
    },
    { watch: [packageName] }
)

const packageTitle = computed(() => packageInfo.value?.display_name || packageInfo.value?.name || packageName.value)

const releases = computed(() => {
    return (releaseData.value || []).flatMap((release) => {
        const rows: ReleaseRow[] = []

        if (release.architectures.amd64) {
            rows.push({ version: release.version_with_leios_patch, arch: 'amd64', changelog: release.changelog })
        }

        if (release.architectures.arm64) {
            rows.push({ version: release.version_with_leios_patch, arch: 'arm64', changelog: release.changelog })
        }

        if (release.architectures.is_all) {
            rows.push({ version: release.version_with_leios_patch, arch: 'all', changelog: release.changelog })
        }

        return rows
    })
})

type ReleaseRow = {
    version: string
    arch: string
    changelog: string
}

const releaseColumns: TableColumn<ReleaseRow>[] = [
    { accessorKey: 'version', header: 'Version' },
    { accessorKey: 'arch', header: 'Arch' },
    { accessorKey: 'changelog', header: 'Changelog' }
]
</script>

<template>
    <div class="bg-slate-950/40 py-12">
        <UContainer class="space-y-8">
            <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div class="space-y-2">
                    <UBadge color="primary" variant="soft">Explorer</UBadge>
                    <div class="flex items-center gap-3">
                        <UButton icon="i-lucide-arrow-left" to="/explore" variant="ghost" color="neutral" size="sm">Back</UButton>
                        <h1 class="text-3xl font-bold">{{ packageTitle }}</h1>
                    </div>
                    <p class="text-slate-400">View public metadata and releases for this package.</p>
                </div>
                <div class="flex items-center gap-2">
                    <USelect v-model="repo" :items="repoOptions" class="w-48" />
                    <UButton icon="i-lucide-refresh-cw" variant="ghost" :loading="pending" @click="() => refresh()">Refresh</UButton>
                </div>
            </div>

            <UCard class="border-slate-800 bg-slate-900/60">
                <div class="space-y-4 p-5">
                    <div v-if="pending" class="flex items-center gap-2 text-slate-400">
                        <UIcon name="i-lucide-loader-2" class="animate-spin" /> Loading package...
                    </div>

                    <div v-else-if="!packageInfo" class="text-slate-400">
                        Package not found.
                    </div>

                    <template v-else>
                        <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div class="space-y-2">
                                <h2 class="text-2xl font-semibold">{{ packageInfo.name }}</h2>
                                <p class="text-slate-400">{{ packageInfo.description || 'No description provided.' }}</p>
                                <div class="flex flex-wrap gap-2">
                                    <UBadge color="neutral" variant="soft">publisher #{{ packageInfo.publisher_id }}</UBadge>
                                    <UButton v-if="packageInfo.homepage_url" size="sm" variant="ghost" color="neutral" :to="packageInfo.homepage_url" target="_blank" icon="i-lucide-external-link">Homepage</UButton>
                                </div>
                            </div>
                        </div>

                        <div class="mt-6 space-y-3">
                            <div class="flex items-center justify-between">
                                <h3 class="text-xl font-semibold">Releases</h3>
                                <UBadge color="neutral" variant="soft">{{ releases.length }} entries</UBadge>
                            </div>

                            <div v-if="!releases.length" class="text-slate-400">No releases for this selection.</div>

                            <UTable v-else :data="releases" :columns="releaseColumns" />
                        </div>
                    </template>
                </div>
            </UCard>
        </UContainer>
    </div>
</template>

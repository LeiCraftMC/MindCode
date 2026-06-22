<script setup lang="ts">
const highlights = [
    {
        icon: 'i-lucide-package-search',
        title: 'Repository-first',
        description: 'Single entry point for publishing, promoting, and reviewing LeiOS packages.'
    },
    {
        icon: 'i-lucide-shield-check',
        title: 'Role-aware access',
        description: 'Developer and admin spaces with guardrails for submissions and approvals.'
    },
    {
        icon: 'i-lucide-rocket',
        title: 'Fast delivery',
        description: 'Upload builds, request stable promotion, and track status in one place.'
    }
]

const flows = [
    {
        label: 'Developers',
        steps: [
            'Create a package entry with metadata',
            'Upload builds for amd64 or arm64',
            'Request promotion to stable once validated'
        ]
    },
    {
        label: 'Admins',
        steps: [
            'Review stable promotion requests',
            'Manage users and roles',
            'Promote or revoke releases instantly'
        ]
    }
]

const cards = [
    {
        title: 'Developer dashboard',
        icon: 'i-lucide-layout-dashboard',
        detail: 'Submit packages, upload releases, and track promotion requests with live status.',
        to: '/dashboard'
    },
    {
        title: 'Admin controls',
        icon: 'i-lucide-shield',
        detail: 'Approve stable promotion requests, reset passwords, and manage roles without leaving Nuxt UI.',
        to: '/dashboard?tab=admin'
    },
    {
        title: 'Public explorer',
        icon: 'i-lucide-compass',
        detail: 'Coming soon: browse packages and pull metadata directly from the repo.',
        to: '#'
    }
];

useSeoMeta({
    title: 'LeiOS Hub | Centralized Package Management for LeiOS',
    description: 'Manage and publish LeiOS packages with ease using the LeiOS Repository Hub. Designed for developers and admins alike.'
});

</script>

<template>
    <div class="space-y-0">
        <section class="relative flex min-h-[85vh] items-center overflow-hidden bg-[radial-gradient(ellipse_90%_55%_at_50%_-10%,rgba(56,189,248,0.14),transparent)]">
            <div class="pointer-events-none absolute inset-0 overflow-hidden">
                <div class="absolute h-96 w-96 rounded-full bg-sky-500/10 blur-3xl" style="top:22%;left:18%"></div>
                <div class="absolute h-96 w-96 rounded-full bg-sky-400/5 blur-3xl" style="bottom:18%;right:14%"></div>
            </div>

            <UContainer class="relative z-10">
                <div class="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
                    <div class="space-y-6 text-left">
                        <UBadge color="primary" variant="soft" size="lg" class="inline-flex items-center gap-2">
                            <UIcon name="i-lucide-server-cog" />
                            LeiOS Repository Hub
                        </UBadge>
                        <h1 class="text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">
                            Ship packages with <span class="bg-linear-to-tr from-sky-400 to-sky-200 bg-clip-text text-transparent">confidence</span>.
                        </h1>
                        <p class="max-w-2xl text-lg text-slate-400 sm:text-xl">
                            A Nuxt UI powered control center for LeiOS packages. Publish builds, request promotion to stable,
                            and keep everything auditable for developers and admins.
                        </p>
                        <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
                            <UButton to="/explore" size="lg" color="primary" class="px-7">
                                <template #leading>
                                    <UIcon name="i-lucide-log-in" />
                                </template>
                                Go to Repo Explorer
                            </UButton>
                            <UButton to="/auth/login" size="lg" variant="outline" color="neutral" class="px-7">
                                <template #leading>
                                    <UIcon name="i-lucide-lock" />
                                </template>
                                Developer / Admin login
                            </UButton>
                        </div>
                    </div>

                    <UCard class="border-sky-500/30 bg-slate-900/70 shadow-xl">
                        <div class="space-y-4 p-6">
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="text-sm text-slate-400">Public Explorer</p>
                                    <p class="text-xl font-semibold text-sky-100">Coming soon</p>
                                </div>
                                <UBadge color="neutral" variant="soft">preview</UBadge>
                            </div>

                            <div class="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                                <div class="flex items-center gap-3">
                                    <UIcon name="i-lucide-compass" class="text-sky-400" />
                                    <div>
                                        <p class="text-sm text-slate-400">Browse all packages</p>
                                        <p class="text-slate-200">API integration is on the way.</p>
                                    </div>
                                </div>
                                <p class="mt-3 text-sm text-slate-500">
                                    The public explorer endpoint is not live yet. You can still prepare packages and releases in the dashboard today.
                                </p>
                            </div>
                        </div>
                    </UCard>
                </div>
            </UContainer>
        </section>

        <section class="bg-slate-950/60 py-18">
            <UContainer>
                <div class="grid gap-6 md:grid-cols-3">
                    <UCard v-for="item in highlights" :key="item.title" class="border-slate-800 bg-slate-900/70">
                        <div class="space-y-3 p-3">
                            <div class="flex h-11 w-11 items-center justify-center rounded-lg bg-sky-500/10">
                                <UIcon :name="item.icon" class="text-lg text-sky-400" />
                            </div>
                            <h3 class="text-lg font-semibold">{{ item.title }}</h3>
                            <p class="text-slate-400">{{ item.description }}</p>
                        </div>
                    </UCard>
                </div>
            </UContainer>
        </section>

        <section class="py-20">
            <UContainer class="space-y-12">
                <header class="text-center">
                    <UBadge color="primary" variant="soft" class="mb-3">Roles</UBadge>
                    <h2 class="text-3xl font-bold sm:text-4xl">Built for developers and admins</h2>
                    <p class="mt-3 text-lg text-slate-400">One UI, two focused workspaces. Switch context without losing the LeiOS design language.</p>
                </header>

                <div class="grid gap-8 lg:grid-cols-2">
                    <UCard v-for="flow in flows" :key="flow.label" class="border-slate-800 bg-slate-900/60">
                        <div class="space-y-4 p-5">
                            <div class="flex items-center gap-2">
                                <UIcon :name="flow.label === 'Developers' ? 'i-lucide-code-2' : 'i-lucide-shield'" class="text-sky-400" />
                                <h3 class="text-xl font-semibold">{{ flow.label }}</h3>
                            </div>
                            <ul class="space-y-3 text-slate-300">
                                <li v-for="step in flow.steps" :key="step" class="flex items-start gap-2">
                                    <UIcon name="i-lucide-check" class="mt-1 text-sky-400" />
                                    <span>{{ step }}</span>
                                </li>
                            </ul>
                        </div>
                    </UCard>
                </div>
            </UContainer>
        </section>

        <section class="bg-slate-950/60 py-16">
            <UContainer>
                <div class="grid gap-6 md:grid-cols-3">
                    <UCard v-for="card in cards" :key="card.title" class="border-slate-800 bg-slate-900/60 transition hover:border-sky-500/50">
                        <div class="space-y-3 p-4">
                            <div class="flex items-center gap-2">
                                <UIcon :name="card.icon" class="text-sky-400" />
                                <h3 class="text-lg font-semibold">{{ card.title }}</h3>
                            </div>
                            <p class="text-slate-400">{{ card.detail }}</p>
                            <UButton :to="card.to" :disabled="card.title === 'Public explorer'" size="sm" color="primary" variant="soft">
                                {{ card.title === 'Public explorer' ? 'Coming soon' : 'Open' }}
                            </UButton>
                        </div>
                    </UCard>
                </div>
            </UContainer>
        </section>

        <section class="relative overflow-hidden py-20">
            <div class="pointer-events-none absolute inset-0 bg-linear-to-b from-transparent via-sky-500/5 to-transparent"></div>
            <UContainer class="relative z-10">
                <div class="mx-auto max-w-3xl text-center space-y-6">
                    <h2 class="text-3xl font-bold sm:text-4xl">Ready to publish?</h2>
                    <p class="text-lg text-slate-400">Login with your LeiOS account to start uploading packages. Need access? Contact an admin for credentials.</p>
                    <div class="flex flex-col gap-3 sm:flex-row sm:justify-center">
                        <UButton to="/auth/login" size="lg" color="primary" class="px-7">Sign in</UButton>
                        <UButton to="/dashboard" size="lg" variant="outline" color="neutral" class="px-7">Open dashboard</UButton>
                    </div>
                </div>
            </UContainer>
        </section>
    </div>
</template>


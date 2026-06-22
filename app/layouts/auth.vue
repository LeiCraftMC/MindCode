<script setup lang="ts">
import Header from '~/components/layout/Header.vue'
import Footer from '~/components/layout/Footer.vue'

</script>

<template>
    <NuxtLoadingIndicator
        color="#00bcff"
        position="top"
    />

    <div class="app-layout main-bg-color">
        <!-- Navigation -->
        <Header />

        <!-- Main Content -->
        <UMain class="main-content">
            <div class="pointer-events-none absolute inset-0 bg-linear-to-b from-transparent via-sky-500/5 to-transparent"></div>
            <div class="flex min-h-[calc(100vh-80px)] items-center justify-center">
                <UPageCard class="w-full max-w-md border-slate-800">
                    <slot />
                </UPageCard>
            </div>
        </UMain>

        <!-- Footer -->
        <Footer />
    </div>
</template>

<style scoped>
.app-layout {
    min-height: 100vh;
    color: rgb(241 245 249);
    display: flex;
    flex-direction: column;
}

.main-content {
    flex: 1;
}
</style>
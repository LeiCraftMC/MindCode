<script setup lang="ts">
import type { DropdownMenuItem, TableColumn } from "#ui/types";
import type { GetPackagesResponses } from "@/api-client/types.gen";
import type { Publisher } from '~/utils/types';
import * as z from "zod";
import type { FormSubmitEvent } from "@nuxt/ui";
import { zPostPackagesBody } from "~/api-client/zod.gen";
import { useUserInfoStore } from "~/composables/stores/useUserStore";

type AdminPackage = GetPackagesResponses[200]["data"][number];

definePageMeta({
    layout: "dashboard",
});

useSeoMeta({
    title: "All Packages | LeiOS Hub",
    description: "Manage all packages",
});

const toast = useToast();

// Check admin access
const userInfoStore = useUserInfoStore();
const currentUser = await userInfoStore.use();
if (!userInfoStore.isValid(currentUser)) {
    throw new Error('User not authenticated but trying to access Admin Packages');
}

if (currentUser.value.role !== "admin") {
    await navigateTo("/dashboard");
}

const packageColumns: TableColumn<AdminPackage>[] = [
    { accessorKey: "id", header: "ID" },
    { accessorKey: "fullname", header: "Name" },
    { accessorKey: "publisher_id", header: "Publisher", enableSorting: true },
    { accessorKey: "description", header: "Description" },
    { id: "stable", header: "Stable" },
    { id: "testing", header: "Testing" },
    { id: "actions", header: "", enableSorting: false, enableHiding: false },
];

const {
    data: packages,
    loading,
    refresh,
} = await useAPILazyAsyncData<AdminPackage[]>("admin-packages-list", async () => {
    const res = await useAPI((api) => api.getPackages({}));
    if (!res.success) {
        toast.add({
            title: "Failed to load packages",
            description: res.message,
            color: "error",
        });
        return [];
    }
    return res.data;
});

// Load publishers for filter + display
const { data: publishers } = await useAPILazyAsyncData<Publisher[]>(
    'admin-packages-publishers',
    async () => {
        const res = await useAPI((api) => api.getPublishers({}));
        if (!res.success) return [];
        return res.data;
    }
);

const publisherFilterOptions = computed(() =>
    (publishers.value || []).map(p => ({
        label: p.display_name,
        value: p.id,
    }))
);

const publisherNameById = computed(() => {
    const map: Record<number, string> = {};
    for (const p of (publishers.value || [])) {
        map[p.id] = p.display_name;
    }
    return map;
});

function getAdminPackageRowActions(row: {
    original: AdminPackage;
}): DropdownMenuItem[][] {
    return [
        [
            {
                label: "Edit",
                icon: "i-lucide-pencil",
                onSelect: () => openEdit(row.original),
            },
            {
                label: "View Releases",
                icon: "i-lucide-list",
                to: `/dashboard/packages/${row.original.fullname}`,
            },
        ],
        [
            {
                label: "Delete",
                icon: "i-lucide-trash-2",
                color: "error",
                onSelect: () => openDelete(row.original),
            },
        ],
    ];
}

const showCreateModal = ref(false);
const showEditModal = ref(false);
const selectedPackage = ref<AdminPackage | null>(null);

const createSchema = zPostPackagesBody;
type CreateSchema = z.output<typeof createSchema>;

const editForm = reactive({
    description: "",
    homepage_url: "",
});

const createForm = reactive({
    name: '',
    display_name: '',
    publisher_id: undefined as number | undefined,
    description: '',
    homepage_url: '',
});

async function handleCreate(event: FormSubmitEvent<CreateSchema>) {
    const res = await useAPI((api) =>
        api.postPackages({ body: event.data })
    );
    if (res.success) {
        toast.add({ title: "Package created", color: "success" });
        showCreateModal.value = false;
        await refresh();
    } else {
        toast.add({
            title: "Create failed",
            description: res.message,
            color: "error",
        });
    }
}

function openEdit(pkg: AdminPackage) {
    selectedPackage.value = pkg;
    editForm.description = pkg.description;
    editForm.homepage_url = pkg.homepage_url;
    showEditModal.value = true;
}

function openDelete(pkg: AdminPackage) {
    packageToDelete.value = pkg;
    showDeleteModal.value = true;
}

async function submitEdit() {
    if (!selectedPackage.value) return;
    const target = selectedPackage.value;
    const res = await useAPI((api) =>
        api.putPackagesByFullPackageName({
            path: { fullPackageName: target.fullname },
            body: {
                description: editForm.description,
                homepage_url: editForm.homepage_url,
            },
        })
    );

    if (res.success) {
        toast.add({ title: "Package updated", color: "success" });
        showEditModal.value = false;
        await refresh();
    } else {
        toast.add({
            title: "Update failed",
            description: res.message,
            color: "error",
        });
    }
}

// Delete with DashboardDeleteModal
const showDeleteModal = ref(false);
const deleting = ref(false);
const packageToDelete = ref<AdminPackage | null>(null);

async function deletePackage() {
    if (!packageToDelete.value) return;
    const target = packageToDelete.value;
    deleting.value = true;
    const res = await useAPI((api) =>
        api.deletePackagesByFullPackageName({
            path: { fullPackageName: target.fullname },
        })
    );
    deleting.value = false;

    if (res.success) {
        toast.add({ title: "Package deleted", color: "success" });
        showDeleteModal.value = false;
        packageToDelete.value = null;
        await refresh();
    } else {
        toast.add({
            title: "Delete failed",
            description: res.message,
            color: "error",
        });
    }
}
</script>

<template>
    <UDashboardPanel>
        <template #header>
            <DashboardPageHeader
                title="All Packages"
                icon="i-lucide-package-search"
                description="Manage all packages"
            />
        </template>

        <template #body>
            <DashboardPageBody>
                <DashboardDataTable
                    :data="packages"
                    :columns="packageColumns"
                    :loading="loading"
                    :filters="[
                        {
                            column: 'fullname',
                            type: 'text',
                            placeholder: 'Search packages...',
                            icon: 'i-lucide-search',
                        },
                        {
                            column: 'publisher_id',
                            type: 'select',
                            placeholder: 'All Publishers',
                            icon: 'i-lucide-building',
                            options: publisherFilterOptions,
                        },
                    ]"
                    empty-title="No packages"
                    empty-description="Create the first package to get started."
                    empty-icon="i-lucide-package-x"
                    @refresh="refresh"
                >
                    <template #header-right>
                        <UButton
                            label="New Package"
                            icon="i-lucide-plus"
                            color="primary"
                            @click="showCreateModal = true"
                        />
                    </template>

                    <template #id-cell="{ row }">
                        <span class="font-mono text-sm">#{{ row.original.id }}</span>
                    </template>

                    <template #fullname-cell="{ row }">
                        <NuxtLink
                            :to="`/dashboard/packages/${row.original.fullname}`"
                            class="font-medium text-sky-400 hover:underline"
                        >
                            {{ row.original.fullname }}
                        </NuxtLink>
                    </template>

                    <template #publisher_id-cell="{ row }">
                        <span class="text-sm text-slate-400">
                            {{ publisherNameById[row.original.publisher_id] || `#${row.original.publisher_id}` }}
                        </span>
                    </template>

                    <template #description-cell="{ row }">
                        <span class="text-slate-400 line-clamp-1 max-w-xs">
                            {{ row.original.description || "—" }}
                        </span>
                    </template>

                    <template #stable-cell="{ row }">
                        <div class="flex gap-1">
                            <UBadge v-if="row.original.latest_stable_release.amd64" color="success" variant="soft" size="sm">
                                amd64
                            </UBadge>
                            <UBadge v-if="row.original.latest_stable_release.arm64" color="success" variant="soft" size="sm">
                                arm64
                            </UBadge>
                            <span v-if="!row.original.latest_stable_release.amd64 && !row.original.latest_stable_release.arm64" class="text-slate-500">—</span>
                        </div>
                    </template>

                    <template #testing-cell="{ row }">
                        <div class="flex gap-1">
                            <UBadge v-if="row.original.latest_testing_release.amd64" color="warning" variant="soft" size="sm">
                                amd64
                            </UBadge>
                            <UBadge v-if="row.original.latest_testing_release.arm64" color="warning" variant="soft" size="sm">
                                arm64
                            </UBadge>
                            <span v-if="!row.original.latest_testing_release.amd64 && !row.original.latest_testing_release.arm64" class="text-slate-500">—</span>
                        </div>
                    </template>

                    <template #actions-cell="{ row }">
                        <UDropdownMenu
                            :ui="{ viewport: 'main-bg-color' }"
                            :items="getAdminPackageRowActions(row)"
                        >
                            <UButton
                                icon="i-lucide-more-horizontal"
                                variant="ghost"
                                color="neutral"
                                size="xs"
                            />
                        </UDropdownMenu>
                    </template>

                    <template #empty-actions>
                        <UButton
                            label="Create Package"
                            color="primary"
                            @click="showCreateModal = true"
                        />
                    </template>
                </DashboardDataTable>
            </DashboardPageBody>
        </template>
    </UDashboardPanel>

    <!-- Create Package Modal -->
    <DashboardModal
        v-model:open="showCreateModal"
        title="Create Package"
        icon="i-lucide-package-plus"
    >
        <UForm :schema="createSchema" :state="createForm" class="space-y-4" @submit="handleCreate">
            <UFormField label="Name" name="name" required>
                <UInput v-model="createForm.name" placeholder="my-package" class="w-full" />
            </UFormField>
            <UFormField label="Display Name" name="display_name" required>
                <UInput v-model="createForm.display_name" placeholder="My Package" class="w-full" />
            </UFormField>
            <UFormField label="Publisher ID" name="publisher_id" required>
                <UInput v-model="createForm.publisher_id" type="number" placeholder="1" class="w-full" />
            </UFormField>
            <UFormField label="Description" name="description" required>
                <UTextarea v-model="createForm.description" placeholder="A brief description of the package" class="w-full" />
            </UFormField>
            <UFormField label="Homepage URL" name="homepage_url">
                <UInput v-model="createForm.homepage_url" placeholder="https://github.com/..." class="w-full" />
            </UFormField>

            <div class="flex justify-end gap-2 pt-4">
                <UButton
                    label="Cancel"
                    color="neutral"
                    variant="ghost"
                    @click="showCreateModal = false"
                />
                <UButton type="submit" label="Create" color="primary" />
            </div>
        </UForm>
    </DashboardModal>

    <!-- Edit Package Modal -->
    <DashboardModal
        v-model:open="showEditModal"
        :title="`Edit Package: ${selectedPackage?.name}`"
        icon="i-lucide-pencil"
    >
        <div class="space-y-4">
            <UFormField label="Description">
                <UTextarea v-model="editForm.description" class="w-full" />
            </UFormField>
            <UFormField label="Homepage URL">
                <UInput v-model="editForm.homepage_url" class="w-full" />
            </UFormField>

            <div class="flex justify-end gap-2 pt-4">
                <UButton
                    label="Cancel"
                    color="neutral"
                    variant="ghost"
                    @click="showEditModal = false"
                />
                <UButton label="Save" color="primary" @click="submitEdit" />
            </div>
        </div>
    </DashboardModal>

    <!-- Delete Package Modal -->
    <DashboardModal
        v-model:open="showDeleteModal"
        title="Delete Package"
        :description="packageToDelete ? `This will delete ${packageToDelete.name} and all releases.` : ''"
        icon="i-lucide-alert-triangle"
        icon-color="error"
    >
        <div class="space-y-4">
            <UAlert
                icon="i-lucide-alert-octagon"
                color="error"
                title="This action cannot be undone"
                description="All releases belonging to this package will be permanently removed."
            />

            <div class="flex justify-end gap-2 pt-2">
                <UButton
                    label="Cancel"
                    color="neutral"
                    variant="ghost"
                    @click="showDeleteModal = false; packageToDelete = null"
                />
                <UButton
                    label="Delete"
                    color="error"
                    :loading="deleting"
                    @click="deletePackage"
                />
            </div>
        </div>
    </DashboardModal>
</template>

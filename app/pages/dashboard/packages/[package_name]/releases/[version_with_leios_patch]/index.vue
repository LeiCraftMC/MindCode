<script setup lang="ts">
import type z from "zod";
import { zPostPackagesByFullPackageNameReleasesBody } from "~/api-client/zod.gen";
import DashboardDeleteModal from "~/components/dashboard/DashboardDeleteModal.vue";

const route = useRoute();
const toast = useToast();

const pkg_data = useSubrouterInjectedData<DevPackage>("package").inject().data;
const pkg_release = useSubrouterInjectedData<
    DevPackageRelease,
    NewDevPackageRelease
>("package_release", true).inject();
const pkg_release_data = pkg_release.data;
const pkg_release_loading = pkg_release.loading;

const headerTexts = computed(() => {
    if (pkg_release.isNew) {
        return {
            title: "Create New Package Release",
            description: `Create a new package release for the package ${pkg_data.value.name}.`,
        };
    }
    return {
        title: `Package Release: ${pkg_release_data.value.version_with_leios_patch}`,
        description: "View and manage the details of the package.",
    };
});

const package_release_form_schema =
    zPostPackagesByFullPackageNameReleasesBody;
const package_release_form_state = ref<NewDevPackageRelease>({
    version_with_leios_patch: pkg_release_data.value.version_with_leios_patch,
    changelog: pkg_release_data.value.changelog,
});

const submitting = ref(false);

async function onFormSubmit() {
    submitting.value = true;
    try {
        if (pkg_release.isNew) {
            const result = await useAPI((api) =>
                api.postPackagesByFullPackageNameReleases({
                    path: {
                        fullPackageName: pkg_data.value.fullname,
                    },
                    body: package_release_form_state.value,
                })
            );

            if (result.success) {
                toast.add({
                    title: "Package Release created",
                    description: `The Package Release has been successfully created.`,
                    icon: "i-lucide-check",
                    color: "success",
                });

                // Redirect to the new package page
                await navigateTo(
                    `/dashboard/packages/${pkg_data.value.fullname}/releases/${package_release_form_state.value.version_with_leios_patch}`
                );
            } else {
                throw new Error(
                    result.message || "Failed to create package release"
                );
            }
        } else {
            const result = await useAPI((api) =>
                api.putPackagesByFullPackageNameReleasesByVersionWithLeiosPatch({
                    path: {
                        fullPackageName: pkg_data.value.fullname,
                        version_with_leios_patch:
                            pkg_release_data.value.version_with_leios_patch,
                    },
                    body: {
                        changelog: package_release_form_state.value.changelog,
                    },
                })
            );

            if (result.success) {
                pkg_release_data.value.changelog =
                    package_release_form_state.value.changelog;

                toast.add({
                    title: "Package Release updated",
                    description: `The Package has been successfully updated.`,
                    icon: "i-lucide-check",
                    color: "success",
                });
            } else {
                throw new Error(
                    result.message || "Failed to update package release"
                );
            }
        }
    } catch (error: any) {
        toast.add({
            title: "Error",
            description: error.message || "An unexpected error occurred.",
            icon: "i-lucide-x-circle",
            color: "error",
        });
    } finally {
        submitting.value = false;
    }
}

const deleteConfirmOpen = ref(false);

async function onDeletePackage() {

    toast.add({
        title: "Package release deletion is not yet implemented.",
        description: "This feature is coming soon.",
        icon: "i-lucide-info",
        color: "info",
    });

    deleteConfirmOpen.value = false;
}

// Architecture types
type Architecture = "amd64" | "arm64";

const architecturesLists: { key: Architecture | "all"; label: string; icon: string }[] = [
    {
        key: "amd64",
        label: "AMD64 (x86_64)",
        icon: "i-lucide-cpu"
    },
    {
        key: "arm64",
        label: "ARM64 (aarch64)",
        icon: "i-lucide-circuit-board",
    },
    {
        key: "all",
        label: "Universal (All Architectures)",
        icon: "i-lucide-globe",
    }
];

// Computed to check which architectures already have uploads
const uploadedArchitectures = computed(() => {

    const data = pkg_release_data.value as DevPackageRelease;

    if (pkg_release.isNew) return {
        amd64: false,
        arm64: false,
        all: false
    };

    return {
        amd64: !!data.architectures["amd64"],
        arm64: !!data.architectures["arm64"],
        all: !!data.architectures["is_all"]
    };
});

type UploadState = {
    file: File | null;
    uploading: boolean;
    dragOver: boolean;
};

// File upload state per architecture
const uploadStates = reactive<Record<Architecture | "all", UploadState>>({
    amd64: { file: null, uploading: false, dragOver: false },
    arm64: { file: null, uploading: false, dragOver: false },
    all: { file: null, uploading: false, dragOver: false }
});

async function uploadDebFile(arch: Architecture | "all") {
    const file = uploadStates[arch].file;
    if (!file) return;

    uploadStates[arch].uploading = true;

    try {
        const result = await useAPI((api) =>
            api.postPackagesByFullPackageNameReleasesByVersionWithLeiosPatchByArch({
                path: {
                    fullPackageName: pkg_data.value.fullname,
                    version_with_leios_patch:
                        pkg_release_data.value.version_with_leios_patch,
                    arch: arch,
                },
                body: {
                    file: file,
                },
            })
        );

        if (result.success) {

            uploadStates[arch].file = null;

            toast.add({
                title: "Upload successful",
                description: `The .deb file for ${arch} has been uploaded successfully.`,
                icon: "i-lucide-check-circle",
                color: "success",
            });

            await pkg_release.refresh();

        } else {
            throw new Error(result.message || "Failed to upload file");
        }
    } catch (error: any) {
        toast.add({
            title: "Upload failed",
            description:
                error.message || "An unexpected error occurred during upload.",
            icon: "i-lucide-x-circle",
            color: "error",
        });
    } finally {
        uploadStates[arch].uploading = false;
    }
}

function onFileChange(
    arch: Architecture | "all",
    files: File | File[] | null | undefined
) {
    if (!files) {
        uploadStates[arch].file = null;
        return;
    }

    const file = Array.isArray(files) ? files[0] : files;

    if (file && !file.name.endsWith(".deb")) {
        toast.add({
            title: "Invalid file type",
            description: "Please select a .deb file.",
            icon: "i-lucide-alert-circle",
            color: "warning",
        });
        uploadStates[arch].file = null;
        return;
    }

    uploadStates[arch].file = file || null;
}

function formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
</script>

<template>
    <div class="space-y-6 w-full lg:w-3xl mx-auto">
        <!-- Header -->
        <div>
            <h2 class="text-xl font-semibold text-white">
                {{ headerTexts.title }}
            </h2>
            <p class="text-sm text-slate-400 mt-1">
                {{ headerTexts.description }}
            </p>
        </div>

        <!-- Profile Card -->
        <div class="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm overflow-hidden">
            <div class="px-6 py-4 border-b border-slate-800">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-lg bg-sky-500/10 flex items-center justify-center">
                        <UIcon class="w-5 h-5 text-sky-400" name="i-lucide-info" />
                    </div>
                    <div>
                        <h3 class="font-medium text-white">
                            Release Information
                        </h3>
                        <p class="text-sm text-slate-400">
                            View and manage the details of this OS Release.
                        </p>
                    </div>
                </div>
            </div>

            <div class="p-6">
                <UForm id="settings" class="divide-y divide-slate-800" :schema="package_release_form_schema"
                    :state="package_release_form_state" @submit="onFormSubmit()">
                    <!-- <UFormField
                        name="name"
                        label="Package Name"
                        description="The name of this package."
                        required
                        class="flex max-sm:flex-col justify-between items-start gap-4 py-4 first:pt-0 last:pb-0"
                    >
                        <UInput
                            :model-value="package_form_state.name"
                            :disabled="!pkg.isNew"
                            variant="none"
                            placeholder="Enter package name"
                            :ui="{
                                base: 'w-full text-end sm:text-center sm:w-96 font-bold text-xl px-0 text-info',
                            }"
                        />
                    </UFormField> -->

                    <UFormField name="version_with_leios_patch" label="Version Tag"
                        description="The version tag of this package release."
                        class="flex max-sm:flex-col justify-between items-start gap-4 py-4 first:pt-0 last:pb-0" :ui="{
                            root: 'w-full sm:w-auto',
                            container: 'w-full sm:w-auto',
                        }">
                        <UInput v-model="package_release_form_state.version_with_leios_patch
                            " :disabled="!pkg_release.isNew" placeholder="Enter package release version tag"
                            class="w-full sm:w-96" />
                    </UFormField>

                    <UFormField name="changelog" label="Changelog" description="The changelog for this package release."
                        class="flex justify-between items-start gap-4 py-4 first:pt-0 last:pb-0" :ui="{
                            container: 'w-full',
                        }">
                        <UTextarea v-model="package_release_form_state.changelog" placeholder="No changelog provided."
                            :rows="5" autoresize class="w-full" />
                    </UFormField>

                    <div class="pt-4">
                        <UButton v-if="!pkg_release.isNew" label="Save Changes" color="primary" type="submit"
                            :loading="submitting" icon="i-lucide-save" />
                        <UButton v-else label="Create Package Release" color="primary" type="submit"
                            :loading="submitting" icon="i-lucide-plus-circle" />
                    </div>
                </UForm>
            </div>
        </div>

        <!-- Deb Files Upload Card -->
        <div v-if="!pkg_release.isNew"
            class="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm overflow-hidden">
            <div class="px-6 py-4 border-b border-slate-800">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                        <UIcon class="w-5 h-5 text-emerald-400" name="i-lucide-package" />
                    </div>
                    <div>
                        <h3 class="font-medium text-white">Package Files</h3>
                        <p class="text-sm text-slate-400">
                            Upload and manage .deb files for different
                            architectures.
                        </p>
                    </div>
                </div>
            </div>

            <div class="p-6 space-y-6">
                <!-- Architecture Upload Sections -->

                <UTabs
                    :items='[
                        { label: "Per Architecture" as const },
                        { label: "Universal" as const }
                    ]'
                    color="primary"
                >

                    <template #content="{ item }">
                        
                        <div class="space-y-2">

                            <div v-for="arch in architecturesLists.filter(a => item.label === 'Per Architecture' ? a.key !== 'all' : a.key === 'all')" :key="arch.key"
                                class="rounded-lg border border-slate-700 bg-slate-800/40 overflow-hidden">
                                <!-- Architecture Header -->
                                <div class="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
                                    <div class="flex items-center gap-3">
                                        <UIcon :name="arch.icon" class="w-5 h-5 text-slate-400" />
                                        <span class="font-medium text-white">
                                            {{ arch.label }}</span>
                                    </div>
                                    <div>
                                        <span v-if="uploadedArchitectures[arch.key]"
                                            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                            <UIcon name="i-lucide-check-circle" class="w-3.5 h-3.5" />
                                            Uploaded
                                        </span>
                                        <span v-else
                                            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                            <UIcon name="i-lucide-alert-circle" class="w-3.5 h-3.5" />
                                            Missing
                                        </span>
                                    </div>
                                </div>

                                <!-- Upload Area -->
                                <div class="p-4">
                                    <!-- Already Uploaded State -->
                                    <div v-if="uploadedArchitectures[arch.key]"
                                        class="flex items-center justify-between p-4 rounded-lg bg-emerald-950/30 border border-emerald-900/30">
                                        <div class="flex items-center gap-3">
                                            <div
                                                class="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                                                <UIcon name="i-lucide-file-archive" class="w-5 h-5 text-emerald-400" />
                                            </div>
                                            <div>
                                                <p class="text-sm font-medium text-white">
                                                        {{ pkg_data.name }}_{{
                                                        pkg_release_data.version_with_leios_patch
                                                    }}_{{ arch.key }}.deb
                                                </p>
                                                <p class="text-xs text-slate-400">
                                                    Package file uploaded and available in
                                                    testing repository
                                                </p>
                                            </div>
                                        </div>
                                        <UIcon name="i-lucide-check" class="w-5 h-5 text-emerald-400" />
                                    </div>

                                    <!-- File Upload with UFileUpload -->
                                    <div v-else class="space-y-3">
                                        <UFileUpload v-if="!uploadStates[arch.key].file"
                                            :model-value="uploadStates[arch.key].file" @update:model-value="
                                                onFileChange(arch.key, $event)
                                                " accept=".deb" color="neutral" :disabled="uploadStates[arch.key].uploading"
                                            :preview="true" layout="list" file-icon="i-lucide-file-archive"
                                            class="w-full min-h-32" @dragover.prevent="
                                                uploadStates[arch.key].dragOver = true;
                                            " @dragleave.prevent="
                                                uploadStates[arch.key].dragOver = false;
                                            " :ui="{
                                                base: 'relative border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer data-[dragging=true]:border-sky-500 data-[dragging=true]:bg-sky-500/10 data-[dragging=false]:border-slate-700 data-[dragging=false]:hover:border-slate-600 data-[dragging=false]:bg-slate-800 data-[dragging=false]:hover:bg-slate-800/50',
                                                wrapper: 'py-0',
                                                label: 'text-slate-300',
                                                description: 'text-slate-500',
                                            }">
                                            <template #leading>
                                                <div class="w-12 h-12 rounded-full flex items-center justify-center transition-colors"
                                                    :class="uploadStates[arch.key].dragOver
                                                            ? 'bg-sky-500/20'
                                                            : 'bg-slate-700'
                                                        ">
                                                    <UIcon name="i-lucide-upload-cloud" class="w-6 h-6 transition-colors"
                                                        :class="uploadStates[arch.key].dragOver
                                                                ? 'text-sky-400'
                                                                : 'text-slate-400'
                                                            " />
                                                </div>
                                            </template>

                                            <template #label>
                                                <span class="text-sm text-white">
                                                    <span class="text-sky-400 font-medium">Click to upload</span>
                                                    or drag and drop
                                                </span>
                                            </template>

                                            <template #description>
                                                <span class="text-xs text-slate-500 mt-1">
                                                    Select the .deb file for
                                                    {{ arch.label }}.
                                                </span>
                                            </template>
                                        </UFileUpload>
                                        <!-- Upload Button -->
                                    </div>
                                    <div v-if="uploadStates[arch.key].file" class="space-y-3">
                                        <div
                                            class="flex items-center justify-between p-4 rounded-lg bg-sky-950/30 border border-sky-900/30">
                                            <div class="flex items-center gap-3">
                                                <div
                                                    class="w-10 h-10 rounded-lg bg-sky-500/10 flex items-center justify-center">
                                                    <UIcon name="i-lucide-file-archive" class="w-5 h-5 text-sky-400" />
                                                </div>
                                                <div>
                                                    <p class="text-sm font-medium text-white">
                                                        {{ uploadStates[arch.key].file!.name }}
                                                    </p>
                                                    <p class="text-xs text-slate-400">
                                                        {{ formatFileSize(uploadStates[arch.key].file!.size) }}
                                                    </p>
                                                </div>
                                            </div>
                                            <UButton icon="i-lucide-x" color="neutral" variant="ghost" size="sm"
                                                :disabled="uploadStates[arch.key].uploading"
                                                @click="uploadStates[arch.key].file = null" />
                                        </div>
                                        <div class="flex justify-end gap-2">
                                            <UButton label="Cancel" color="neutral" variant="ghost"
                                                :disabled="uploadStates[arch.key].uploading"
                                                @click="uploadStates[arch.key].file = null" />
                                            <UButton label="Upload" color="primary" icon="i-lucide-upload"
                                                :loading="uploadStates[arch.key].uploading"
                                                @click="uploadDebFile(arch.key)" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div>
                        
                    </template>

                </UTabs>

                <!-- Info Box -->
                <div class="flex items-start gap-3 p-4 rounded-lg bg-sky-950/30 border border-sky-900/30">
                    <UIcon name="i-lucide-info" class="w-5 h-5 text-sky-400 mt-0.5 flex-shrink-0" />
                    <div class="text-sm text-slate-300">
                        <p>
                            Upload .deb files for each supported architecture.
                            Files will be automatically verified and published
                            to the
                            <span class="text-sky-400 font-medium">testing repository</span>.
                        </p>
                        <p class="mt-2 text-slate-400 text-xs">
                            Once both architectures are uploaded and tested, you
                            can request a promotion to the stable repository.
                        </p>
                    </div>
                </div>
            </div>
        </div>

        <!-- Danger Zone Card -->
        <div v-if="!pkg_release.isNew"
            class="rounded-xl border border-red-900/50 bg-red-950/20 backdrop-blur-sm overflow-hidden">
            <div class="px-6 py-4 border-b border-red-900/50">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                        <UIcon name="i-lucide-alert-triangle" class="w-5 h-5 text-red-400" />
                    </div>
                    <div>
                        <h3 class="font-medium text-red-400">Danger Zone</h3>
                        <p class="text-sm text-slate-400">
                            Irreversible and destructive actions
                        </p>
                    </div>
                </div>
            </div>

            <div class="p-6">
                <div class="flex flex-col md:flex-row md:items-center gap-4">
                    <div class="flex-1">
                        <h4 class="font-medium text-white">
                            Delete Package Release
                        </h4>
                        <p class="text-sm text-slate-400 mt-1">
                            Permanently delete this package release and all
                            associated data. This action cannot be undone.
                        </p>
                    </div>
                    <UButton label="Delete Package Release" color="error" variant="soft" icon="i-lucide-trash-2"
                        @click="deleteConfirmOpen = true" />
                </div>
            </div>
        </div>

        <!-- Delete Confirmation Modal -->
        <DashboardDeleteModal
            v-if="!pkg_release.isNew"
            title="Delete Package Release"
            warning-text="All data associated with this package release and related information will be permanently deleted. This action cannot be reversed."
            v-model:open="deleteConfirmOpen"
            :onDelete="onDeletePackage"
            :prevent-auto-close=true
        />
    </div>
</template>

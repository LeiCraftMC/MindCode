<script setup lang="ts">
import type {
    GetPublishersResponses,
    GetPackagesResponses,
    GetPackagesByFullPackageNameResponses,
    PostPackagesData,
} from "@/api-client/types.gen";
import type z from "zod";
import {
    zPostPackagesBody,
    zPutPackagesByFullPackageNameBody,
} from "~/api-client/zod.gen";
type DevPackage = GetPackagesByFullPackageNameResponses[200]["data"];
type NewDevPackage = NonNullable<PostPackagesData["body"]>;

const toast = useToast();

const pkg = useSubrouterInjectedData<DevPackage, NewDevPackage>("package", true).inject();
const pkg_data = pkg.data;
const pkg_loading = pkg.loading;

type Publisher = GetPublishersResponses[200]["data"][number];

const { data: publishers } = await useAPIAsyncData<Publisher[]>(
    "package-publishers",
    async () => {
        if (!pkg.isNew) {
            return [];
        }

        const result = await useAPI((api) => api.getPublishers({ query: { onlyMembershipByMe: true } }));
        if (!result.success) {
            toast.add({
                title: "Failed to load publishers",
                description: result.message,
                color: "error",
            });
            return [];
        }

        return result.data;
    }
);

const publisherOptions = computed(() =>
    (publishers.value || []).map((publisher) => ({
        label: publisher.display_name,
        value: publisher.id,
    }))
);

const headerTexts = computed(() => {
    if (pkg.isNew) {
        return {
            title: "Create New Package",
            description: "Create a new package on LeiOS Hub.",
        };
    }
    return {
        title: `Package ${(pkg_data as Ref<DevPackage>).value.name}`,
        description: "View and manage the details of the package.",
    };
});

const package_form_schema = pkg.isNew ? zPostPackagesBody : zPutPackagesByFullPackageNameBody;
type PackageFormSchema = NonNullable<z.infer<typeof package_form_schema>>;
const package_form_state = ref<NewDevPackage>(
    pkg.isNew
        ? { name: '', display_name: '', description: '', homepage_url: '', requires_patching: false } as unknown as NewDevPackage
        : {
            publisher_id: (pkg_data.value as DevPackage).publisher_id,
            name: (pkg_data.value as DevPackage).name,
            display_name: (pkg_data.value as DevPackage).display_name,
            description: (pkg_data.value as DevPackage).description,
            homepage_url: (pkg_data.value as DevPackage).homepage_url,
            requires_patching: (pkg_data.value as DevPackage).requires_patching,
        }
);

watchEffect(() => {
    if (pkg.isNew && !package_form_state.value.publisher_id && publisherOptions.value.length === 1) {
        package_form_state.value.publisher_id = publisherOptions.value[0]!.value;
    }
});

async function onFormSubmit() {
    try {
        if (pkg.isNew) {
            const result = await useAPI((api) =>
                api.postPackages({
                    body: package_form_state.value,
                })
            );

            if (result.success) {
                const packagesResult = await useAPI((api) => api.getPackages({
                    query: {
                        onlyMembershipByMe: true,
                        publisherID: package_form_state.value.publisher_id,
                        searchString: package_form_state.value.name,
                    },
                }));

                const packagesData = packagesResult.success
                    ? (packagesResult.data as GetPackagesResponses["200"]["data"])
                    : null;
                const createdPackage = packagesData?.find((candidate) =>
                    candidate.publisher_id === package_form_state.value.publisher_id &&
                    candidate.name === package_form_state.value.name
                ) ?? null;

                toast.add({
                    title: "Package created",
                    description: `The Package has been successfully created.`,
                    icon: "i-lucide-check",
                    color: "success",
                });

                // Redirect to the new package page
                await navigateTo(
                    `/dashboard/packages/${createdPackage?.fullname || package_form_state.value.name}`
                );
            } else {
                throw new Error(result.message || "Failed to create package");
            }
        } else {
            const result = await useAPI((api) =>
                api.putPackagesByFullPackageName({
                    path: {
                        fullPackageName: (pkg_data.value as DevPackage).fullname,
                    },
                    body: {
                        display_name: package_form_state.value.display_name,
                        description: package_form_state.value.description,
                        homepage_url: package_form_state.value.homepage_url,
                        requires_patching:
                            package_form_state.value.requires_patching,
                    },
                })
            );

            if (result.success) {
                pkg_data.value = {
                    ...pkg_data.value,
                    ...package_form_state.value,
                };

                toast.add({
                    title: "Package updated",
                    description: `The Package has been successfully updated.`,
                    icon: "i-lucide-check",
                    color: "success",
                });
            } else {
                throw new Error(result.message || "Failed to update package");
            }
        }
    } catch (error: any) {
        toast.add({
            title: "Error",
            description: error.message || "An unexpected error occurred.",
            icon: "i-lucide-x-circle",
            color: "error",
        });
    }
}

async function onDeletePackage() {
    console.warn("Package deletion is not yet implemented.");
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
        <div
            class="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm overflow-hidden"
        >
            <div class="px-6 py-4 border-b border-slate-800">
                <div class="flex items-center gap-3">
                    <div
                        class="w-10 h-10 rounded-lg bg-sky-500/10 flex items-center justify-center"
                    >
                        <UIcon
                            class="w-5 h-5 text-sky-400"
                            name="i-lucide-info"
                        />
                    </div>
                    <div>
                        <h3 class="font-medium text-white">
                            Package Information
                        </h3>
                        <p class="text-sm text-slate-400">
                            View and manage the details of this package.
                        </p>
                    </div>
                </div>
            </div>

            <div class="p-6">
                <UForm
                    id="settings"
                    class="divide-y divide-slate-800"
                    :schema="package_form_schema"
                    :state="package_form_state"
                    @submit="onFormSubmit()"
                >
                    <UFormField
                        v-if="pkg.isNew"
                        name="publisher_id"
                        label="Publisher"
                        description="Choose the publisher that will own this package."
                        class="flex max-sm:flex-col justify-between items-start gap-4 py-4 first:pt-0 last:pb-0"
                        :ui="{
                            root: 'w-full sm:w-auto',
                            container: 'w-full sm:w-auto',
                        }"
                    >
                        <USelect
                            v-model="package_form_state.publisher_id"
                            :items="publisherOptions"
                            placeholder="Select a publisher"
                            value-key="value"
                            class="w-full sm:w-96"
                        />
                    </UFormField>

                    <UFormField
                        name="name"
                        label="Package Name"
                        description="The name of this package."
                        class="flex max-sm:flex-col justify-between items-start gap-4 py-4 first:pt-0 last:pb-0"
                        :ui="{
                            root: 'w-full sm:w-auto',
                            container: 'w-full sm:w-auto',
                        }"
                    >
                        <UInput
                            v-model="package_form_state.name"
                            :disabled="!pkg.isNew"
                            placeholder="Enter package name"
                            class="w-full sm:w-96"
                        />
                    </UFormField>

                    <UFormField
                        name="display_name"
                        label="Display Name"
                        description="The human-readable package name shown in the UI."
                        class="flex max-sm:flex-col justify-between items-start gap-4 py-4 first:pt-0 last:pb-0"
                        :ui="{
                            root: 'w-full sm:w-auto',
                            container: 'w-full sm:w-auto',
                        }"
                    >
                        <UInput
                            v-model="package_form_state.display_name"
                            placeholder="Enter package display name"
                            class="w-full sm:w-96"
                        />
                    </UFormField>

                    <UFormField
                        name="description"
                        label="Description"
                        description="The description for this package."
                        class="flex justify-between items-start gap-4 py-4 first:pt-0 last:pb-0"
                        :ui="{
                            container: 'w-full',
                        }"
                    >
                        <UTextarea
                            v-model="package_form_state.description"
                            placeholder="No description provided."
                            :rows="5"
                            autoresize
                            class="w-full"
                        />
                    </UFormField>

                    <UFormField
                        name="homepage_url"
                        label="Homepage URL"
                        description="Enter the homepage URL for this package."
                        class="flex max-sm:flex-col justify-between items-start gap-4 py-4 first:pt-0 last:pb-0"
                        :ui="{
                            root: 'w-full sm:w-auto',
                            container: 'w-full sm:w-auto',
                        }"
                    >
                        <UInput
                            v-model="package_form_state.homepage_url"
                            placeholder="Enter homepage URL for this package"
                            class="w-full sm:w-96"
                        />
                    </UFormField>

                    <UFormField
                        name="requires_patching"
                        label="Requires Patching"
                        description="Indicates whether this package requires every package release to include a patch suffix in its version tag."
                        required
                        class="flex justify-between items-start gap-4 py-4 first:pt-0 last:pb-0"
                    >
                        <div
                            class="w-full sm:w-96 rounded-md border-0 appearance-none placeholder:text-dimmed focus:outline-none disabled:cursor-not-allowed disabled:opacity-75 transition-colors py-1.5 text-sm gap-1.5 text-highlighted bg-transparent sm:flex sm:justify-center"
                        >
                            <UCheckbox v-model="package_form_state.requires_patching" />
                        </div>
                    </UFormField>

                    <div class="pt-4">
                        <UButton
                            v-if="!pkg.isNew"
                            label="Save Changes"
                            color="primary"
                            type="submit"
                            :loading="pkg_loading"
                            icon="i-lucide-save"
                        />
                        <UButton
                            v-else
                            label="Create Package"
                            color="primary"
                            type="submit"
                            :loading="pkg_loading"
                            icon="i-lucide-plus-circle"
                        />
                    </div>
                </UForm>
            </div>
        </div>

        <!-- Danger Zone Card -->
        <div
            v-if="!pkg.isNew"
            class="rounded-xl border border-red-900/50 bg-red-950/20 backdrop-blur-sm overflow-hidden"
        >
            <div class="px-6 py-4 border-b border-red-900/50">
                <div class="flex items-center gap-3">
                    <div
                        class="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center"
                    >
                        <UIcon
                            name="i-lucide-alert-triangle"
                            class="w-5 h-5 text-red-400"
                        />
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
                            Delete Package
                        </h4>
                        <p class="text-sm text-slate-400 mt-1">
                            Permanently delete this package and all
                            associated data. This action cannot be undone.
                        </p>
                    </div>
                    <UTooltip text="Coming soon — deletion is not yet implemented">
                        <UButton
                            label="Delete Package"
                            color="error"
                            variant="soft"
                            icon="i-lucide-trash-2"
                            disabled
                        />
                    </UTooltip>
                </div>
            </div>
        </div>

    </div>
</template>

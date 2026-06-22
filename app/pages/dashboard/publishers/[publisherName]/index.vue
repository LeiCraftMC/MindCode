<script setup lang="ts">
import type { Publisher, NewPublisher } from "~/utils/types";
import { zPostPublishersBody, zPutPublishersByPublisherNameBody } from "~/api-client/zod.gen";
import type z from "zod";

definePageMeta({
    layout: 'dashboard'
});

const route = useRoute();
const toast = useToast();

const pub = useSubrouterInjectedData<Publisher, NewPublisher>("publisher", true).inject();
const pub_data = pub.data;
const pub_loading = pub.loading;

const headerTexts = computed(() => {
    if (pub.isNew) {
        return {
            title: 'Create New Publisher',
            description: 'Create a new publisher on LeiOS Hub.',
        };
    }
    return {
        title: `Publisher: ${pub_data.value.name}`,
        description: 'View and manage the details of the publisher.',
    };
});

const publisher_form_schema = pub.isNew ? zPostPublishersBody : zPutPublishersByPublisherNameBody;
const publisher_form_state = ref<NewPublisher>({
    name: pub_data.value.name || '',
    display_name: pub_data.value.display_name || '',
    description: pub_data.value.description || '',
    homepage_url: pub_data.value.homepage_url || '',
});

const submitting = ref(false);

async function onFormSubmit() {
    submitting.value = true;
    try {
        if (pub.isNew) {
            const result = await useAPI((api) =>
                api.postPublishers({
                    body: {
                        name: publisher_form_state.value.name,
                        display_name: publisher_form_state.value.display_name,
                        description: publisher_form_state.value.description,
                        homepage_url: publisher_form_state.value.homepage_url,
                    }
                })
            );

            if (result.success) {
                toast.add({
                    title: 'Publisher created',
                    description: `The publisher "${publisher_form_state.value.name}" has been created.`,
                    icon: 'i-lucide-check',
                    color: 'success',
                });

                await navigateTo(`/dashboard/publishers/${publisher_form_state.value.name}`);
            } else {
                throw new Error(result.message || 'Failed to create publisher');
            }
        } else {
            const result = await useAPI((api) =>
                api.putPublishersByPublisherName({
                    path: {
                        publisherName: pub_data.value.name,
                    },
                    body: {
                        display_name: publisher_form_state.value.display_name,
                        description: publisher_form_state.value.description,
                        homepage_url: publisher_form_state.value.homepage_url,
                    }
                })
            );

            if (result.success) {
                pub_data.value = {
                    ...pub_data.value,
                    display_name: publisher_form_state.value.display_name,
                    description: publisher_form_state.value.description,
                    homepage_url: publisher_form_state.value.homepage_url,
                };

                toast.add({
                    title: 'Publisher updated',
                    description: `The publisher has been successfully updated.`,
                    icon: 'i-lucide-check',
                    color: 'success',
                });
            } else {
                throw new Error(result.message || 'Failed to update publisher');
            }
        }
    } catch (error: any) {
        toast.add({
            title: 'Error',
            description: error.message || 'An unexpected error occurred.',
            icon: 'i-lucide-x-circle',
            color: 'error',
        });
    } finally {
        submitting.value = false;
    }
}

const deleteConfirmOpen = ref(false);

async function onDeletePublisher() {
    try {
        const result = await useAPI((api) =>
            api.deletePublishersByPublisherName({
                path: { publisherName: pub_data.value.name }
            })
        );

        if (result.success) {
            toast.add({
                title: 'Publisher deleted',
                description: `The publisher "${pub_data.value.name}" has been deleted.`,
                icon: 'i-lucide-check',
                color: 'success',
            });

            await navigateTo('/dashboard/publishers');
        } else {
            throw new Error(result.message || 'Failed to delete publisher');
        }
    } catch (error: any) {
        toast.add({
            title: 'Error',
            description: error.message || 'An unexpected error occurred.',
            icon: 'i-lucide-x-circle',
            color: 'error',
        });
        deleteConfirmOpen.value = false;
    }
}

// Pre-fill empty homepage_url so the input doesn't error on empty URL fields
watchEffect(() => {
    if (!publisher_form_state.value.homepage_url) {
        publisher_form_state.value.homepage_url = 'https://';
    }
});
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

        <!-- Publisher Settings Card -->
        <div class="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm overflow-hidden">
            <div class="px-6 py-4 border-b border-slate-800">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-lg bg-sky-500/10 flex items-center justify-center">
                        <UIcon class="w-5 h-5 text-sky-400" name="i-lucide-building" />
                    </div>
                    <div>
                        <h3 class="font-medium text-white">Publisher Information</h3>
                        <p class="text-sm text-slate-400">View and manage the details of this publisher.</p>
                    </div>
                </div>
            </div>

            <div class="p-6">
                <UForm
                    id="publisher-settings"
                    class="divide-y divide-slate-800"
                    :schema="publisher_form_schema"
                    :state="publisher_form_state"
                    @submit="onFormSubmit"
                >
                    <UFormField
                        name="name"
                        label="Publisher Name"
                        description="The unique name of this publisher (cannot be changed later)."
                        class="flex max-sm:flex-col justify-between items-start gap-4 py-4 first:pt-0 last:pb-0"
                        :ui="{ root: 'w-full sm:w-auto', container: 'w-full sm:w-auto' }"
                    >
                        <UInput
                            v-model="publisher_form_state.name"
                            :disabled="!pub.isNew"
                            placeholder="Enter publisher name"
                            class="w-full sm:w-96"
                        />
                    </UFormField>

                    <UFormField
                        name="display_name"
                        label="Display Name"
                        description="The human-readable publisher name shown in the UI."
                        class="flex max-sm:flex-col justify-between items-start gap-4 py-4 first:pt-0 last:pb-0"
                        :ui="{ root: 'w-full sm:w-auto', container: 'w-full sm:w-auto' }"
                    >
                        <UInput
                            v-model="publisher_form_state.display_name"
                            placeholder="Enter display name"
                            class="w-full sm:w-96"
                        />
                    </UFormField>

                    <UFormField
                        name="description"
                        label="Description"
                        description="The description for this publisher."
                        class="flex justify-between items-start gap-4 py-4 first:pt-0 last:pb-0"
                        :ui="{ container: 'w-full' }"
                    >
                        <UTextarea
                            v-model="publisher_form_state.description"
                            placeholder="No description provided."
                            :rows="5"
                            autoresize
                            class="w-full"
                        />
                    </UFormField>

                    <UFormField
                        name="homepage_url"
                        label="Homepage URL"
                        description="Enter the homepage URL for this publisher."
                        class="flex max-sm:flex-col justify-between items-start gap-4 py-4 first:pt-0 last:pb-0"
                        :ui="{ root: 'w-full sm:w-auto', container: 'w-full sm:w-auto' }"
                    >
                        <UInput
                            v-model="publisher_form_state.homepage_url"
                            placeholder="https://..."
                            class="w-full sm:w-96"
                        />
                    </UFormField>

                    <div class="pt-4">
                        <UButton
                            v-if="!pub.isNew"
                            label="Save Changes"
                            color="primary"
                            type="submit"
                            :loading="submitting"
                            icon="i-lucide-save"
                        />
                        <UButton
                            v-else
                            label="Create Publisher"
                            color="primary"
                            type="submit"
                            :loading="submitting"
                            icon="i-lucide-plus-circle"
                        />
                    </div>
                </UForm>
            </div>
        </div>

        <!-- Danger Zone Card -->
        <div
            v-if="!pub.isNew"
            class="rounded-xl border border-red-900/50 bg-red-950/20 backdrop-blur-sm overflow-hidden"
        >
            <div class="px-6 py-4 border-b border-red-900/50">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                        <UIcon name="i-lucide-alert-triangle" class="w-5 h-5 text-red-400" />
                    </div>
                    <div>
                        <h3 class="font-medium text-red-400">Danger Zone</h3>
                        <p class="text-sm text-slate-400">Irreversible and destructive actions</p>
                    </div>
                </div>
            </div>

            <div class="p-6">
                <div class="flex flex-col md:flex-row md:items-center gap-4">
                    <div class="flex-1">
                        <h4 class="font-medium text-white">Delete Publisher</h4>
                        <p class="text-sm text-slate-400 mt-1">
                            Permanently delete this publisher. This will fail if the publisher still has packages.
                        </p>
                    </div>
                    <UButton
                        label="Delete Publisher"
                        color="error"
                        variant="soft"
                        icon="i-lucide-trash-2"
                        @click="deleteConfirmOpen = true"
                    />
                </div>
            </div>
        </div>

        <!-- Delete Confirmation Modal -->
        <DashboardDeleteModal
            v-if="!pub.isNew"
            title="Delete Publisher"
            warning-text="All data associated with this publisher will be permanently deleted. This action cannot be reversed. Note: publishers with existing packages cannot be deleted."
            v-model:open="deleteConfirmOpen"
            :on-delete="onDeletePublisher"
            :prevent-auto-close="true"
        />
    </div>
</template>

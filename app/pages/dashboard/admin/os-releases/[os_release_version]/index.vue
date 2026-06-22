<script lang="ts" setup>
import type { FormError, NavigationMenuItem } from '@nuxt/ui';
import z from 'zod';
import type { GetAdminOsReleasesResponses, PostAdminOsReleasesData } from '~/api-client';
import { zPostAdminOsReleasesBody, zPutAdminOsReleasesByVersionBody } from '~/api-client/zod.gen';
import DashboardDeleteModal from '~/components/dashboard/DashboardDeleteModal.vue';

const toast = useToast();
const route = useRoute();

type OSRelease = GetAdminOsReleasesResponses["200"]["data"][number];
type NewOSRelease = NonNullable<PostAdminOsReleasesData["body"]>;

// const os_release = inject<Ref<OSRelease | NewOSRelease>>('os_release_data');
// const os_release_refresh = inject<() => Promise<void>>('os_release_refresh');
// const os_release_pending = inject<Ref<boolean>>('os_release_pending');
// const os_release_is_new = inject<boolean>('os_release_is_new');

const os_release = useSubrouterInjectedData<OSRelease, NewOSRelease>('os_release', true).inject();
console.log('os_release:', os_release);
const os_release_data = os_release.data;
const os_release_loading = os_release.loading;

function getPublishingStatusColor(status: OSRelease['publishing_status']) {
    switch (status) {
        case 'pending':
            return 'warning'
        case 'paused':
            return 'warning'
        case 'completed':
            return 'success'
        case 'failed':
            return 'error'
        case 'running':
            return 'info'
    }
}

const os_release_form_schema = os_release.isNew ? zPostAdminOsReleasesBody : zPutAdminOsReleasesByVersionBody;
type OSReleaseFormState = NonNullable<z.infer<typeof os_release_form_schema>>;
const os_release_form_state = ref<NewOSRelease>({
	changelog: os_release_data.value.changelog,
});

async function onFormSubmit() {

	os_release_loading.value = true;

	try {

		if (os_release.isNew) {
			const result = await useAPI((api) => api.postAdminOsReleases({
				body: {
					changelog: os_release_form_state.value.changelog,
				}
			}));

			if (result.success) {
				toast.add({
					title: 'OS Release created',
					description: 'The OS Release has been successfully created.',
					icon: 'i-lucide-check',
					color: 'success'
				})

				// Redirect to the newly created OS Release page
				navigateTo(`/dashboard/admin/os-releases/${result.data?.version}`);
			} else {
				throw new Error(result.message || 'Failed to create OS Release');
			}

		} else {
			
			const result = await useAPI((api) => api.putAdminOsReleasesByVersion({
				path: {
					version: (os_release_data as Ref<OSRelease>).value.version
				},
				body: {
					changelog: os_release_form_state.value.changelog
				}
			}));

			if (result.success) {
				os_release_data.value.changelog = os_release_form_state.value.changelog as string;

				toast.add({
					title: 'OS Release updated',
					description: 'The OS Release has been successfully updated.',
					icon: 'i-lucide-check',
					color: 'success'
				})
			} else {
				throw new Error(result.message || 'Failed to update OS Release');
			}

		}
	} catch (error: any) {
		toast.add({
			title: 'Error',
			description: error.message || 'An unexpected error occurred.',
			icon: 'i-lucide-alert-circle',
			color: 'error'
		})
	} finally {
		os_release_loading.value = false
	}
	
}


const deleteConfirmOpen = ref(false);

async function onDeleteOSRelease() {


    toast.add({
        title: 'OS Release deletion not implemented',
        description: 'The deletion of OS Releases is not yet implemented.',
        icon: 'i-lucide-alert-triangle',
        color: 'warning'
    });

	deleteConfirmOpen.value = false;

	// try {
	// 	// const result = await useAPI((api) => api.deleteOSRelease({}))

	// 	if (result.success) {
	// 		toast.add({
	// 			title: 'OS Release deleted',
	// 			description: 'The OS Release has been permanently deleted.',
	// 			icon: 'i-lucide-check',
	// 			color: 'success'
	// 		})

	// 		await useUserInfoStore().clear();
	// 		useCookie("leioshub_session_token").value = null
	// 		navigateTo('/')
	// 	} else {
	// 		toast.add({
	// 			title: 'Error',
	// 			description: result.message || 'An error occurred while deleting the OS Release.',
	// 			icon: 'i-lucide-alert-circle',
	// 			color: 'error'
	// 		})
	// 	}
	// } catch (error) {
	// 	toast.add({
	// 		title: 'Error',
	// 		description: 'An unexpected error occurred.',
	// 		icon: 'i-lucide-alert-circle',
	// 		color: 'error'
	// 	})
	// } finally {
	// 	deleteLoading.value = false
	// 	deleteConfirmOpen.value = false
	// }
}

const headerTexts = computed(() => {
	if (os_release.isNew) {
		return {
			title: 'New OS Release',
			description: 'Create a new OS Release for LeiOS.'
		}
	}
	return {
		title: `OS Release ${(os_release_data as Ref<OSRelease>).value.version}`,
		description: 'View and manage the details of this OS Release.'
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

		<!-- Profile Card -->
		<div class="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm overflow-hidden">
			<div class="px-6 py-4 border-b border-slate-800">
				<div class="flex items-center gap-3">
					<div class="w-10 h-10 rounded-lg bg-sky-500/10 flex items-center justify-center">
						<UIcon class="w-5 h-5 text-sky-400" name="i-lucide-info" />
					</div>
					<div>
						<h3 class="font-medium text-white">Release Information</h3>
						<p class="text-sm text-slate-400">View and manage the details of this OS Release.</p>
					</div>
				</div>
			</div>
			
			<div class="p-6">
				<UForm id="settings" class="divide-y divide-slate-800" :schema="os_release_form_schema" :state="os_release_form_state" @submit="onFormSubmit()">
					<UFormField 
						name="version" 
						label="Version"
						description="The version number of this OS Release."
						required
						class="flex justify-between items-start gap-4 py-4 first:pt-0 last:pb-0"
					>
						<UInput
							:model-value="(os_release_data as OSRelease).version ?? 'Auto Generated'"
							disabled variant="none"
							placeholder="Enter version"
							:ui="{
                            	base: 'w-full text-end sm:text-center sm:w-96 font-bold text-xl px-0 text-info'
                        	}"
						/>
					</UFormField>

                    <UFormField 
                        name="publishing_status" 
                        label="Publishing Status"
                        description="The current publishing status of this OS Release."
                        required
                        class="flex justify-between items-start gap-4 py-4 first:pt-0 last:pb-0"
					>
                        <div class="w-full sm:w-96 rounded-md border-0 appearance-none placeholder:text-dimmed focus:outline-none disabled:cursor-not-allowed disabled:opacity-75 transition-colors py-1.5 text-sm gap-1.5 text-highlighted bg-transparent sm:flex sm:justify-center">
                            <UBadge v-if="!os_release.isNew"
                                :label="(os_release_data as OSRelease).publishing_status.toUpperCase()" 
                                :color="getPublishingStatusColor((os_release_data as OSRelease).publishing_status)"
                                size="md"
                                class="sm:w-96 max-w-max" 
                            />
							<UBadge v-else
								label="NOT PUBLISHED"
								color="neutral"
								size="md"
								class="sm:w-96 max-w-max"
							/>
                        </div>
					</UFormField>

                    <UFormField
                        name="changelog"
                        label="Changelog"
                        description="The changelog for this OS Release."
                        class="flex justify-between items-start gap-4 py-4 first:pt-0 last:pb-0"
                        :ui='{
                            container: "w-full"
                        }'
                    >
                        <!-- <UTextarea 
                            :model-value="'Currently not implemented.'"  
                            placeholder="No changelog provided."
                            :rows="5"
                            disabled
                            autoresize
                            class="w-full"
                        /> -->
						<UTextarea 
                            v-model="os_release_form_state.changelog"
                            placeholder="No changelog provided."
                            :rows="5"
                            autoresize
                            class="w-full"
                        />
                    </UFormField>

                    <div class="pt-4">
						<UButton v-if="!os_release.isNew"
							label="Save Changes" 
							color="primary"
							type="submit" 
							:loading="os_release_loading"
							icon="i-lucide-save"
						/>
						<UButton v-else
							label="Create OS Release" 
							color="primary"
							type="submit" 
							:loading="os_release_loading"
							icon="i-lucide-plus-circle"
						/>
					</div>

				</UForm>
			</div>
		</div>

        <!-- Danger Zone Card -->
		<div v-if="!os_release.isNew" class="rounded-xl border border-red-900/50 bg-red-950/20 backdrop-blur-sm overflow-hidden">
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
						<h4 class="font-medium text-white">Delete OS Release</h4>
						<p class="text-sm text-slate-400 mt-1">
							Permanently delete this OS Release and all associated data. This action cannot be undone.
						</p>
					</div>
					<UButton 
						label="Delete OS Release" 
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
			v-if="!os_release.isNew"
			title="Delete OS Release"
			warning-text="All the OS release data including packages, releases, and related information will be permanently deleted. This action cannot be reversed."
			v-model:open="deleteConfirmOpen"
			:onDelete="onDeleteOSRelease"
			:prevent-auto-close=true
		></DashboardDeleteModal>
		<!-- <DashboardModal
			v-if="!os_release.isNew"
			v-model:open="deleteConfirmOpen"
			title="Delete OS Release"
			description="This action is permanent"
			icon="i-lucide-alert-triangle"
			icon-color="error"
		>
			<div class="space-y-4">
				<div class="p-4 rounded-lg bg-red-950/50 border border-red-900/50">
					<p class="text-sm text-red-300">
						<strong>Warning:</strong> All the OS release data including packages, releases, and related information will be permanently deleted. This action cannot be reversed.
					</p>
				</div>

				<div>
					<label class="block text-sm font-medium text-slate-300 mb-2">
						Type <span class="text-red-400">DELETE</span> to confirm
					</label>
					<UInput 
						v-model="deleteConfirmText" 
						type="text" 
						placeholder="Type DELETE"
						class="w-full"
					/>
				</div>

				<div class="flex justify-end gap-3 pt-2">
					<UButton 
						label="Cancel" 
						color="neutral" 
						variant="ghost"
						@click="deleteConfirmOpen = false; deleteConfirmText = ''"
					/>
					<UButton 
						label="Delete OS Release" 
						color="error"
						:loading="deleteLoading"
						:disabled="deleteConfirmText !== 'DELETE'"
						icon="i-lucide-trash-2"
						@click="onDeleteOSRelease"
					/>
				</div>
			</div>
		</DashboardModal> -->

	</div>
</template>

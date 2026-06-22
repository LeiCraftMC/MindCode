<script setup lang="ts">
import type { TableColumn } from '#ui/types'
import type { Row } from '@tanstack/vue-table'
import type { PackageRoleAssignment, PublisherMember } from '~/utils/types'

interface FilterConfig {
    column: keyof MemberWithOverride;
    type?: 'text' | 'select' | 'multi-select';
    placeholder?: string;
    icon?: string;
    class?: string;
    options?: { label: string; value: string }[];
    filterFn?: (row: Row<any>, columnId: string, filterValue: any) => boolean;
}

definePageMeta({
    layout: 'dashboard'
});

const route = useRoute();
const toast = useToast();

const fullPackageName = route.params.package_name as string;
const publisherName = fullPackageName.split('.')[0]!;

const roleBadgeColor: Record<string, 'info' | 'success' | 'warning' | 'neutral'> = {
    ADMIN: 'info',
    MAINTAINER: 'success',
    DEVELOPER: 'warning',
    VIEWER: 'neutral',
};

const roleOptions = [
    { label: 'ADMIN', value: 'ADMIN' },
    { label: 'MAINTAINER', value: 'MAINTAINER' },
    { label: 'DEVELOPER', value: 'DEVELOPER' },
    { label: 'VIEWER', value: 'VIEWER' },
];

const roleHierarchy: Record<string, number> = {
    VIEWER: 1,
    DEVELOPER: 2,
    MAINTAINER: 3,
    ADMIN: 4,
};

function roleOptionsAbove(publisherRole: string | null): typeof roleOptions {
    if (!publisherRole) return roleOptions;
    const minLevel = roleHierarchy[publisherRole] ?? 0;
    return roleOptions.filter(r => (roleHierarchy[r.value] ?? 0) > minLevel);
}

// ---- Data: publisher members + role overrides ----

interface MemberWithOverride {
    user_id: number;
    user_username: string;
    user_display_name: string | null;
    publisher_role: string;
    /** The package-level override role, or the *current* assignment's role if one exists */
    override_role: string | null;
    /** The role-assignment DB id (if an override exists) */
    override_id: number | null;
}

const membersData = ref<MemberWithOverride[]>([]);
const loading = ref(true);


async function loadData() {
    loading.value = true;
    try {
        const [membersRes, overridesRes] = await Promise.all([
            useAPI((api) => api.getPublishersByPublisherNameMembers({ path: { publisherName } })),
            useAPI((api) => api.getPackagesByFullPackageNameRoleAssignments({ path: { fullPackageName } })),
        ]);

        const members: PublisherMember[] = membersRes.success ? (membersRes.data ?? []) : [];
        const overrides: PackageRoleAssignment[] = overridesRes.success ? (overridesRes.data ?? []) : [];

        // Build a lookup from the overrides
        const overrideByUserId = new Map<number, PackageRoleAssignment>();
        for (const o of overrides) {
            overrideByUserId.set(o.user_id, o);
        }

        // Merge: every member gets a row, enriched with override info if present
        membersData.value = members.map(m => {
            const override = overrideByUserId.get(m.user_id);
            return {
                user_id: m.user_id,
                user_username: m.user_username,
                user_display_name: m.user_display_name ?? null,
                publisher_role: m.role,
                override_role: override?.role ?? null,
                override_id: override?.id ?? null,
            };
        });

        // Also add any override-only users (non-members who have a package override)
        for (const o of overrides) {
            if (!membersData.value.some(m => m.user_id === o.user_id)) {
                membersData.value.push({
                    user_id: o.user_id,
                    user_username: o.user_username,
                    user_display_name: o.user_display_name ?? null,
                    publisher_role: o.publisher_role ?? '(not a member)',
                    override_role: o.role,
                    override_id: o.id,
                });
            }
        }
    } catch (err: any) {
        toast.add({ title: 'Failed to load data', description: err.message || 'Unexpected error', color: 'error' });
    } finally {
        loading.value = false;
    }
}

await loadData();

const tableColumns: TableColumn<MemberWithOverride>[] = [
    { accessorKey: 'user_username', header: 'Username' },
    { accessorKey: 'user_display_name', header: 'Display Name' },
    { accessorKey: 'publisher_role', header: 'Publisher Role' },
    { accessorKey: 'override_role', header: 'Package Override' },
    { accessorKey: 'actions', header: '', enableSorting: false, enableHiding: false }
];

// ---- User Search for Add Override ----
const userSearchQuery = ref('');
const searchResults = ref<Array<{ id: number; username: string; display_name: string | null }>>([]);
const searchLoading = ref(false);
const selectedUser = ref<{ id: number; username: string; display_name: string | null } | null>(null);
let searchTimeout: ReturnType<typeof setTimeout> | null = null;

function onUserSearchInput(value: string) {
    userSearchQuery.value = value;
    selectedUser.value = null;
    addState.user_id = 0;

    if (searchTimeout) clearTimeout(searchTimeout);
    if (value.length < 2) { searchResults.value = []; return; }

    searchTimeout = setTimeout(async () => {
        searchLoading.value = true;
        try {
            const res = await useAPI((api) => api.getUsersSearch({ query: { q: value, limit: 10 } }));
            searchResults.value = res.success ? (res.data ?? []) : [];
        } catch {
            searchResults.value = [];
        } finally {
            searchLoading.value = false;
        }
    }, 300);
}

function selectUser(user: { id: number; username: string; display_name: string | null }) {
    selectedUser.value = user;
    addState.user_id = user.id;
    // Look up their publisher role from our merged data, or from publisher members
    const existing = membersData.value.find(m => m.user_id === user.id);
    addStatePublisherRole.value = existing?.publisher_role ?? null;
    const available = roleOptionsAbove(addStatePublisherRole.value);
    addState.role = (available[0]?.value ?? 'MAINTAINER') as 'ADMIN' | 'MAINTAINER' | 'DEVELOPER' | 'VIEWER';
    userSearchQuery.value = user.display_name || user.username;
    searchResults.value = [];
}

// ---- Add Override ----
const showAddModal = ref(false);
const addState = reactive({
    user_id: 0 as number,
    role: 'MAINTAINER' as 'ADMIN' | 'MAINTAINER' | 'DEVELOPER' | 'VIEWER',
});
const addStatePublisherRole = ref<string | null>(null);
const addSubmitting = ref(false);
const addAvailableRoles = computed(() => roleOptionsAbove(addStatePublisherRole.value));

function resetAddForm() {
    showAddModal.value = false;
    addState.user_id = 0;
    addState.role = 'MAINTAINER';
    addStatePublisherRole.value = null;
    userSearchQuery.value = '';
    searchResults.value = [];
    selectedUser.value = null;
}

async function onAddOverride() {
    if (!addState.user_id) {
        toast.add({ title: 'Error', description: 'Please select a user.', color: 'error' });
        return;
    }
    addSubmitting.value = true;
    try {
        const res = await useAPI((api) => api.postPackagesByFullPackageNameRoleAssignments({
            path: { fullPackageName },
            body: { user_id: addState.user_id, role: addState.role },
        }));
        if (res.success) {
            toast.add({ title: 'Override added', description: `Package role set to ${addState.role}.`, icon: 'i-lucide-check', color: 'success' });
            resetAddForm();
            await loadData();
        } else {
            throw new Error(res.message || 'Failed to add override');
        }
    } catch (error: any) {
        toast.add({ title: 'Error', description: error.message || 'An unexpected error occurred.', icon: 'i-lucide-x-circle', color: 'error' });
    } finally {
        addSubmitting.value = false;
    }
}

// ---- Edit Override ----
const showEditModal = ref(false);
const editTarget = ref<{ userId: number; currentRole: string; publisherRole: string | null; username: string } | null>(null);
const editRole = ref<'ADMIN' | 'MAINTAINER' | 'DEVELOPER' | 'VIEWER'>('MAINTAINER');
const editSubmitting = ref(false);
const editAvailableRoles = computed(() => roleOptionsAbove(editTarget.value?.publisherRole ?? null));

function openEditOverride(member: MemberWithOverride) {
    editTarget.value = {
        userId: member.user_id,
        currentRole: member.override_role ?? member.publisher_role,
        publisherRole: member.publisher_role === '(not a member)' ? null : member.publisher_role,
        username: member.user_username,
    };
    editRole.value = (member.override_role ?? member.publisher_role) as 'ADMIN' | 'MAINTAINER' | 'DEVELOPER' | 'VIEWER';
    showEditModal.value = true;
}

async function onEditOverride() {
    if (!editTarget.value) return;
    const target = editTarget.value;
    editSubmitting.value = true;
    try {
        const res = await useAPI((api) => api.putPackagesByFullPackageNameRoleAssignmentsByUserId({
            path: { fullPackageName, userId: target.userId },
            body: { role: editRole.value },
        }));
        if (res.success) {
            toast.add({ title: 'Override updated', description: `Role changed to ${editRole.value}.`, icon: 'i-lucide-check', color: 'success' });
            showEditModal.value = false;
            editTarget.value = null;
            await loadData();
        } else {
            throw new Error(res.message || 'Failed to update override');
        }
    } catch (error: any) {
        toast.add({ title: 'Error', description: error.message || 'An unexpected error occurred.', icon: 'i-lucide-x-circle', color: 'error' });
    } finally {
        editSubmitting.value = false;
    }
}

// ---- Remove Override ----
const deleteConfirmOpen = ref(false);
const deleteTarget = ref<{ userId: number; username: string } | null>(null);

function openRemoveOverride(member: MemberWithOverride) {
    deleteTarget.value = { userId: member.user_id, username: member.user_username };
    deleteConfirmOpen.value = true;
}

async function onRemoveOverride() {
    if (!deleteTarget.value) return;
    const target = deleteTarget.value;
    try {
        const res = await useAPI((api) => api.deletePackagesByFullPackageNameRoleAssignmentsByUserId({
            path: { fullPackageName, userId: target.userId },
        }));
        if (res.success) {
            toast.add({ title: 'Override removed', description: `Reverted to publisher-level role for ${target.username}.`, icon: 'i-lucide-check', color: 'success' });
            deleteConfirmOpen.value = false;
            deleteTarget.value = null;
            await loadData();
        } else {
            throw new Error(res.message || 'Failed to remove override');
        }
    } catch (error: any) {
        toast.add({ title: 'Error', description: error.message || 'An unexpected error occurred.', icon: 'i-lucide-x-circle', color: 'error' });
    }
}
</script>

<template>
    <div class="space-y-6 w-full lg:w-3xl mx-auto">
        <DashboardDataTable
            :data="membersData"
            :columns="tableColumns"
            :loading="loading"
            :filters="[
                {
                    column: 'user_username',
                    type: 'text',
                    placeholder: 'Filter by username or display name...',
                    icon: 'i-lucide-search',
                    class: 'min-w-64',
                    filterFn: (row, _columnId, filterValue) => {
                        if (!filterValue) return true;
                        const q = String(filterValue).toLowerCase();
                        const username = String(row.getValue('user_username') ?? '').toLowerCase();
                        const displayName = String(row.getValue('user_display_name') ?? '').toLowerCase();
                        return username.includes(q) || displayName.includes(q);
                    },
                },
                {
                    column: 'publisher_role',
                    type: 'multi-select',
                    placeholder: 'All roles',
                    class: 'min-w-36',
                    icon: 'i-lucide-shield',
                    options: [
                        { label: 'ADMIN', value: 'ADMIN' },
                        { label: 'MAINTAINER', value: 'MAINTAINER' },
                        { label: 'DEVELOPER', value: 'DEVELOPER' },
                        { label: 'VIEWER', value: 'VIEWER' },
                    ],
                },
            ]"
            empty-title="No publisher members"
            empty-description="Add members to the publisher first, then override their role for this package."
            empty-icon="i-lucide-shield"
            @refresh="loadData()"
        >
            <template #user_username-cell="{ row }">
                <span class="font-medium text-sky-400">{{ row.original.user_username }}</span>
            </template>

            <template #user_display_name-cell="{ row }">
                <span class="text-slate-100">{{ row.original.user_display_name || '—' }}</span>
            </template>

            <template #publisher_role-cell="{ row }">
                <UBadge
                    :color="roleBadgeColor[row.original.publisher_role] || 'neutral'"
                    variant="outline"
                    size="sm"
                >
                    {{ row.original.publisher_role }}
                </UBadge>
            </template>

            <template #override_role-cell="{ row }">
                <div class="flex items-center gap-1.5">
                    <template v-if="row.original.override_role">
                        <UBadge
                            :color="roleBadgeColor[row.original.override_role] || 'neutral'"
                            variant="solid"
                            size="sm"
                        >
                            {{ row.original.override_role }}
                        </UBadge>
                        <span
                            v-if="row.original.override_role === row.original.publisher_role"
                            class="text-xs text-amber-400"
                            title="Same as publisher role — no effective change"
                        >(same)</span>
                        <span
                            v-else
                            class="text-xs text-emerald-400"
                            title="Elevated above publisher role"
                        >(elevated)</span>
                    </template>
                    <span v-else class="text-slate-500 text-sm">—</span>
                </div>
            </template>

            <template #actions-cell="{ row }">
                <div class="flex gap-1">
                    <template v-if="row.original.override_id">
                        <UButton
                            icon="i-lucide-pencil"
                            variant="ghost"
                            color="neutral"
                            size="xs"
                            title="Edit override"
                            @click="openEditOverride(row.original)"
                        />
                        <UButton
                            icon="i-lucide-undo-2"
                            variant="ghost"
                            color="error"
                            size="xs"
                            title="Remove override (revert to publisher role)"
                            @click="openRemoveOverride(row.original)"
                        />
                    </template>
                    <UButton
                        v-else
                        icon="i-lucide-plus"
                        variant="ghost"
                        color="primary"
                        size="xs"
                        title="Add override for this member"
                        @click="selectUser({ id: row.original.user_id, username: row.original.user_username, display_name: row.original.user_display_name }); showAddModal = true"
                    />
                </div>
            </template>
        </DashboardDataTable>
    </div>

    <!-- Add Override Modal -->
    <DashboardModal
        v-model:open="showAddModal"
        title="Add Package Role Override"
        description="Elevate a user's role specifically for this package. Must be higher than their publisher-level role."
        icon="i-lucide-shield-plus"
    >
        <UForm @submit="onAddOverride" class="space-y-4">
            <UFormField label="User" name="user_search" required>
                <div class="relative w-full">
                    <UInput
                        v-model="userSearchQuery"
                        placeholder="Search by username or display name..."
                        class="w-full"
                        @input="onUserSearchInput(($event.target as HTMLInputElement).value)"
                    >
                        <template v-if="searchLoading" #trailing>
                            <UIcon name="i-lucide-loader-circle" class="animate-spin" />
                        </template>
                    </UInput>

                    <div
                        v-if="searchResults.length > 0"
                        class="absolute z-50 w-full mt-1 rounded-lg border border-slate-700 bg-slate-900 shadow-xl max-h-48 overflow-y-auto"
                    >
                        <button
                            v-for="user in searchResults"
                            :key="user.id"
                            type="button"
                            class="w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800 hover:text-white flex items-center gap-2 transition-colors"
                            @click="selectUser(user)"
                        >
                            <UIcon name="i-lucide-user" class="w-4 h-4 shrink-0 text-slate-500" />
                            <span class="font-medium">{{ user.username }}</span>
                            <span v-if="user.display_name" class="text-slate-500">({{ user.display_name }})</span>
                        </button>
                    </div>

                    <div v-if="selectedUser" class="mt-2 space-y-1">
                        <p class="text-xs text-emerald-400 flex items-center gap-1">
                            <UIcon name="i-lucide-check-circle" class="w-3.5 h-3.5" />
                            <strong>{{ selectedUser.username }}</strong>
                            <span v-if="selectedUser.display_name" class="text-slate-500">— {{ selectedUser.display_name }}</span>
                        </p>
                        <p class="text-xs text-slate-400 flex items-center gap-1">
                            <UIcon name="i-lucide-building" class="w-3.5 h-3.5" />
                            Publisher role:
                            <UBadge
                                v-if="addStatePublisherRole"
                                :color="roleBadgeColor[addStatePublisherRole] || 'neutral'"
                                variant="outline"
                                size="xs"
                            >
                                {{ addStatePublisherRole }}
                            </UBadge>
                            <span v-else class="text-slate-500 italic">No publisher membership</span>
                        </p>
                    </div>
                </div>
            </UFormField>

            <UFormField label="Override Role" name="role" required>
                <USelect
                    v-model="addState.role"
                    :items="addAvailableRoles"
                    class="w-full"
                />
                <p v-if="addStatePublisherRole" class="text-xs text-slate-500 mt-1">
                    Must be strictly higher than <strong>{{ addStatePublisherRole }}</strong>.
                </p>
                <p v-else class="text-xs text-amber-400 mt-1">
                    This user is not a publisher member — any role can be assigned.
                </p>
            </UFormField>

            <div class="flex justify-end gap-2 pt-4">
                <UButton label="Cancel" color="neutral" variant="ghost" @click="resetAddForm()" />
                <UButton type="submit" label="Add Override" color="primary" :loading="addSubmitting" icon="i-lucide-shield-plus" />
            </div>
        </UForm>
    </DashboardModal>

    <!-- Edit Override Modal -->
    <DashboardModal
        v-model:open="showEditModal"
        title="Edit Package Role Override"
        icon="i-lucide-pencil"
    >
        <div class="space-y-4">
            <div class="space-y-1 text-sm">
                <p class="text-slate-400">
                    User: <strong class="text-white">{{ editTarget?.username }}</strong>
                </p>
                <p class="text-slate-400 flex items-center gap-1">
                    Publisher role:
                    <UBadge
                        v-if="editTarget?.publisherRole"
                        :color="roleBadgeColor[editTarget.publisherRole] || 'neutral'"
                        variant="outline"
                        size="xs"
                    >
                        {{ editTarget.publisherRole }}
                    </UBadge>
                    <span v-else class="text-slate-500 italic">None</span>
                </p>
                <p v-if="editTarget?.publisherRole" class="text-xs text-slate-500">
                    Override must be strictly higher than <strong>{{ editTarget.publisherRole }}</strong>.
                </p>
            </div>

            <UFormField label="Override Role" name="role" required>
                <USelect v-model="editRole" :items="editAvailableRoles" class="w-full" />
            </UFormField>

            <div class="flex justify-end gap-2 pt-4">
                <UButton label="Cancel" color="neutral" variant="ghost" @click="showEditModal = false" />
                <UButton label="Save" color="primary" :loading="editSubmitting" icon="i-lucide-save" @click="onEditOverride" />
            </div>
        </div>
    </DashboardModal>

    <!-- Remove Override Modal -->
    <DashboardDeleteModal
        title="Remove Package Role Override"
        :warning-text="`Remove the override for &quot;${deleteTarget?.username || ''}&quot;? They will revert to their publisher-level role for this package.`"
        v-model:open="deleteConfirmOpen"
        :on-delete="onRemoveOverride"
        :prevent-auto-close="true"
    />
</template>

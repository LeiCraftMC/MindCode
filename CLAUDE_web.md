# LeiOS Hub Website — Claude Code Guide

## Project Overview

Single-package Nuxt 4 application on Bun (not a monorepo). Main source lives under `app/`. UI built on `@nuxt/ui` 4.x with Tailwind 4. Runtime is Bun end-to-end with Nitro using `preset: 'bun'`.

---

## Design System

### Color Mode
- **Dark mode only** — `nuxt.config.ts` sets `colorMode: { preference: 'dark', fallback: 'dark', classSuffix: '' }`
- CSS enforces `:root { color-scheme: dark; }` — no light mode support, do not introduce it

### Palette

| Role | Color | Tailwind Palette | Usage |
|------|-------|-----------------|-------|
| **Primary** | Sky | `sky-400`, `sky-500`, etc. | Accents, links, focus rings, primary buttons |
| **Neutral / Gray** | Slate | `slate-50`–`slate-950` | Backgrounds, borders, text |
| **Success** | Emerald | `emerald-400` | Positive badges, success toasts |
| **Warning** | Amber | `amber-400` | Warning badges, caution states |
| **Error** | Red | `red-400`, `red-900`, `red-950` | Error toasts, danger zones, delete modals |

Configured in `app/app.config.ts`:
```ts
ui: { colors: { primary: 'sky', neutral: 'slate' } }
theme: { radius: 0.5, blackAsPrimary: false }
```

### Common CSS Classes & Patterns

- `main-bg-color` — The universal background (`rgb(2 6 23)` = `slate-950`); used on layouts, sidebar, cards
- Card backgrounds: `border-slate-800 bg-slate-900/60`
- Danger zone cards: `border-red-900/50 bg-red-950/20`
- Text color: `color: rgb(241 245 249)` (`slate-100`)
- Font stack: `"Inter", "Rubik", sans-serif` (set via `@theme` in `main.css`)
- Loading indicator: `color="#00bcff"` (sky-500)
- A subtle ambient glow on auth pages: `bg-linear-to-b from-transparent via-sky-500/5 to-transparent`

### Styling Rules

- **DO NOT** add a separate CSS framework or styling system — everything uses Nuxt UI + Tailwind utility classes
- **DO NOT** write custom CSS where a Nuxt UI prop or Tailwind class works — inline styles only as last resort
- Always prefer Nuxt UI component props for layout (e.g. `UContainer`, `UMain`, `USeparator`) over manual divs with margin/padding
- All new CSS should go in `app/assets/css/main.css` using `@layer` components or utilities when a reusable pattern emerges

---

## Component Architecture

### Custom Component Library

| Component | File | Purpose | Key Props |
|-----------|------|---------|-----------|
| `DashboardPageHeader` | `app/components/dashboard/DashboardPageHeader.vue` | Page title + icon + breadcrumb + description inside `UDashboardNavbar` | `title`, `icon`, `description`, `breadcrumbItems` |
| `DashboardPageBody` | `app/components/dashboard/DashboardPageBody.vue` | Simple `<div class="space-y-6"><slot /></div>` wrapper | none (slot only) |
| `DashboardDataTable` | `app/components/dashboard/DataTable.vue` | Generic typed table with filters, pagination, refresh, empty states, dynamic column slots | Generic `<T>`, `columns`, `data`, `loading`, pagination props |
| `DashboardModal` | `app/components/dashboard/Modal.vue` | Wraps `UModal` with title/icon/loading state, optional danger-zone card | `title`, `icon`, `iconColor`, loading bindings, `open` v-model |
| `DashboardDeleteModal` | `app/components/dashboard/DeleteModal.vue` | Delete confirmation with "type DELETE" pattern | `open` v-model, `itemName`, `onConfirm` |
| `UserMenu` | `app/components/dashboard/UserMenu.vue` | Dropdown menu — user name, settings, logout | none (uses `useUserInfoStore`) |
| `Gravatar` | `app/components/dashboard/Gravatar.vue` | Async Gravatar via SHA-256 hash, wraps `UAvatar` | `email` |
| `DateRangePicker` | `app/components/form/DateRangePicker.vue` | `UPopover` + `UCalendar` for date range | `from`, `to` v-model |
| `LeiOSLogo` / `LeiOSIcon` | `app/components/img/LeiOSLogo.vue` | Inline SVG pixel-art logo | none |
| `Header` | `app/components/layout/Header.vue` | Site-wide header | none |
| `Footer` | `app/components/layout/Footer.vue` | Site-wide footer | none |

### Component Creation Guidelines

Every new component should follow these rules:

1. **File location**: `app/components/<category>/PascalCase.vue` (categories: `dashboard/`, `form/`, `layout/`, `img/`)
2. **Template**: `<script setup lang="ts">` — no Options API
3. **Props**: `interface Props` then `defineProps<Props>()` with `withDefaults` for defaults
4. **Two-way binding**: Use `defineModel<boolean>('open', { required: true })` pattern
5. **Typed slots**: `defineSlots<{ default(props: {}): any }>()` when slots have complex props
6. **Generic components**: Use Vue 3.5+ `generic` attribute: `<script setup lang="ts" generic="T extends Record<string, any>>"`
7. **File naming**: PascalCase, multi-word — `DashboardDeleteModal.vue`, not `DeleteModal.vue` or `delete-modal.vue`
8. **Wrap Nuxt UI**: When wrapping a Nuxt UI component, pass through `:ui` prop for customization

### Example Component Skeleton

```vue
<script setup lang="ts">
interface Props {
  title?: string
  icon?: string
  description?: string
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  icon: undefined,
})
</script>

<template>
  <div class="border-slate-800 bg-slate-900/60 rounded-lg p-6">
    <UIcon v-if="icon" :name="icon" class="text-sky-400 size-5" />
    <h3 class="text-slate-100 font-semibold">{{ title }}</h3>
    <p v-if="description" class="text-slate-400 text-sm mt-1">{{ description }}</p>
    <slot />
  </div>
</template>
```

---

## Layout Patterns

### Dashboard Layout (`app/layouts/dashboard.vue`)

The skeleton:
```vue
<UDashboardGroup>
  <UDashboardSidebar
    :collapsible="true" :resizable="true"
    :min-size="18" :default-size="20" :max-size="30"
    :ui="{ header: 'main-bg-color', body: 'main-bg-color', ... }"
  >
    <template #header>
      <!-- LeiOS logo + "/ Hub" text; icon-only when collapsed -->
    </template>
    <template #body>
      <!-- 4 navigation sections -->
      <UNavigationMenu :items="navDev" orientation="vertical" />
      <UNavigationMenu v-if="isAdmin" :items="navAdmin" orientation="vertical" />
      <UNavigationMenu :items="navSettings" orientation="vertical" />
      <UNavigationMenu :items="navFooter" orientation="vertical" class="mt-auto" />
    </template>
    <template #footer>
      <UserMenu />
    </template>
  </UDashboardSidebar>
  <slot />  <!-- NuxtPage renders here -->
</UDashboardGroup>
```

The sidebar has 4 `UNavigationMenu` sections:
1. **Dev** — Overview, Packages, API Keys (always visible)
2. **Admin** — Users, All Packages, Stable Promotion Requests, OS Releases, Tasks (visible only if `isAdmin`)
3. **Settings** — General, Security
4. **Footer** — Explorer, Back to Home (with `class="mt-auto"` to stick to bottom)

### Page Skeleton Pattern

Every dashboard page follows:
```vue
<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'Page Title', description: 'Page description' })
// Fetch data or set up reactive state
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <DashboardPageHeader title="Page Title" icon="i-heroicons-icon" description="..." />
    </template>
    <template #body>
      <DashboardPageBody>
        <!-- Cards, tables, forms -->
      </DashboardPageBody>
    </template>
  </UDashboardPanel>
</template>
```

### Auth Layout
Centered card layout with ambient glow: `Header` > `UMain` with centered `UPageCard` > `Footer`.

### Default Layout
Full-width layout: `Header` > `UMain` with full-width slot > `Footer`.

---

## Data Fetching Patterns

### Core Composable: `useAPI(handler)`
```ts
const result = await useAPI(async (api) => {
  return await api.getPackages({ query: { limit: 20, offset: 0 } });
});
```
- Wraps API calls: handles auth header injection via `updateAPIClient()`, cookie-based session token, 401 redirect
- Returns the unwrapped `data` on success, or `{ success: false, code: 500, message }` on error

### Async Data: `useAPIAsyncData(key, handler)` / `useAPILazyAsyncData(key, handler)`
```ts
const { data, loading, refresh } = await useAPILazyAsyncData('packages', async (api) => {
  return await api.getPackages({ query: { limit: 20 } });
});
// data is Ref<TReturn> (not TReturn | null)
// Use loading for v-show / v-if spinners
```
- Wraps `useLazyAsyncData` — `data` is cast to remove `| null`
- `loading` is aliased from `pending` for consistent naming

### When to use which:
- **`useAPI`** — For mutation calls (create, update, delete) and one-off fetches where you manage loading yourself
- **`useAPILazyAsyncData`** — For page-level data that loads on mount (lists, detail views)
- **`useAPIAsyncData`** — Same but blocks navigation until data is ready (use sparingly)

---

## Form Patterns

Every form follows this structure:

```vue
<script setup lang="ts">
import { z } from 'zod'
const schema = z.object({ name: z.string().min(1) })
type Schema = z.output<typeof schema>

const toast = useToast()
const { handleSubmit, formRestore } = useForm<Schema>({ schema })
const onFormSubmit = handleSubmit(async (values) => {
  try {
    await useAPI(async (api) => api.postPackages({ body: values }))
    toast.add({ title: 'Created', icon: 'i-heroicons-check-circle', color: 'success' })
  } catch {
    toast.add({ title: 'Failed', icon: 'i-heroicons-exclamation-circle', color: 'error' })
  }
})
</script>

<template>
  <UForm :schema="schema" :state="formRestore" @submit="onFormSubmit">
    <UFormField label="Name" name="name">
      <UInput v-model="formRestore.name" />
    </UFormField>
    <UButton type="submit" label="Save" color="primary" />
  </UForm>
</template>
```

### Key form rules:
- Always use `useForm` + `UForm` + `UFormField` + Zod — never raw HTML forms
- Use `useDefaultOnFormError()` for auto-focus on first errored field
- Wrap submit handlers in `try/catch` with `toast.add()` for user feedback
- Loading state: add `:loading="submitting"` to `UButton`, wrap in `ref(false)` that toggles

---

## Modal Patterns

### Standard Modal (`DashboardModal`)
```vue
<DashboardModal v-model:open="showModal" title="Create Package" icon="i-heroicons-plus">
  <!-- form or content here -->
</DashboardModal>
```
Props: `title`, `icon`, `iconColor` (defaults to primary), `loading` (for async ops), `danger` (red-themed danger zone)

### Delete Confirmation (`DashboardDeleteModal`)
```vue
<DashboardDeleteModal
  v-model:open="showDelete"
  :item-name="selectedPackage.name"
  :on-confirm="handleDelete"
/>
```
Shows "type DELETE to confirm" pattern — user must type the word "DELETE" before the button activates.

---

## Data Table Patterns

Use `DashboardDataTable` for any tabular data list:

```vue
<script setup lang="ts" generic="T extends Record<string, any>">
// DashboardDataTable.vue itself is generic — consumers use it like:
</script>

<template>
  <DashboardDataTable
    :columns="[
      { accessorKey: 'name', header: 'Name', cell: ({ row }) => row.getValue('name') },
      { accessorKey: 'version', header: 'Version' },
    ]"
    :data="packages"
    :loading="loading"
    :pagination="false"  <!-- or bind pagination state -->
    @refresh="refresh"
  >
    <!-- Empty state slot -->
    <template #empty>
      <div class="text-slate-400">No packages found.</div>
    </template>
  </DashboardDataTable>
</template>
```

Built-in features: column sorting, pagination, search filter, refresh button, empty state slot, loading skeleton.

---

## Toast Feedback Pattern

Always use the `useToast()` composable for feedback:

```ts
const toast = useToast()
toast.add({ title: 'Success', description: 'Package created', icon: 'i-heroicons-check-circle', color: 'success' })
toast.add({ title: 'Error', description: error.message, icon: 'i-heroicons-exclamation-circle', color: 'error' })
toast.add({ title: 'Info', description: 'Processing...', icon: 'i-heroicons-information-circle', color: 'info' })
toast.add({ title: 'Warning', description: 'Disk almost full', icon: 'i-heroicons-exclamation-triangle', color: 'warning' })
```

Available colors: `'success'` (emerald), `'error'` (red), `'info'` (sky/primary), `'warning'` (amber)

---

## Naming Conventions

| Category | Convention | Examples |
|----------|-----------|---------|
| Vue components | PascalCase | `DashboardPageHeader.vue`, `UserMenu.vue` |
| Composables | camelCase, `use` prefix | `useAPI.ts`, `useUserInfoStore.ts` |
| Utilities | camelCase | `routeMatcher.ts`, `abstractStore.ts` |
| Stores | camelCase, `use` + `Store` suffix | `useUserStore.ts` |
| Layouts | lowercase with dashes | `dashboard.vue`, `auth.vue` |
| Page files | kebab-case or `[param].vue` | `index.vue`, `[package_name].vue` |
| Variables | camelCase | `const userName = ref('')` |
| Constants / Zod schemas | UPPER_SNAKE_CASE or camelCase | `profileSchema`, `roleOptions` |
| Types / interfaces | PascalCase | `UserInfo`, `NavigationMenuItem` |
| API-generated types | PascalCase | `PostAuthLoginData`, `GetPackagesResponses` |

---

## TypeScript & Code Style

### Import conventions:
- Alias `~/` for `app/` imports: `~/components/dashboard/UserMenu.vue`, `~/composables/useAPI`
- Alias `@/` also works (same resolution) — prefer `~/` for consistency
- Type-only imports: always use `import type { Foo } from '...'`
- Generated API types: `import type { PostAuthLoginData } from '@/api-client/types.gen'`

### Idioms:
- **Discriminated unions** for create/edit pages: `isNew: true | false` toggles the entire form behavior
- **`satisfies`** for return type verification (same pattern as the API server)
- **`as const`** for literal object return types from composables
- **`Record<string, any>`** for generic table row types
- **Function overloads** for composables with multiple call signatures
- **`NonNullable<T>`** to extract element types from arrays
- **No `.then()` chains** — all async code uses `await` everywhere
- **Top-level `await`** in `<script setup>` is fine

### Component patterns:
- Single quote strings preferred (' over ")
- Semicolons used at end of statements
- Template uses 2-space indentation (match existing files)
- Destructure `definePageMeta` and `useSeoMeta` at the top of every page

---

## Page Meta Pattern

Every page component starts with:
```vue
<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })  // or 'auth' or 'default'
useSeoMeta({ title: 'My Page', description: 'What this page does' })
// ...
</script>
```

### SSR Rules:
- Public pages: SSR enabled (default)
- Dashboard and auth routes: `ssr: false` (forced in `nuxt.config.ts`) — avoid `useAsyncData` or `useFetch` in these, always use `useAPIAsyncData`/`useAPILazyAsyncData`

---

## Routing & Subrouter Patterns

### CRUD Subrouter Pattern
Uses `useSubrouterInjectedData` + `useSubrouterPathDynamics` composables for create/edit/detail:

```ts
// In the parent route:
const { inject } = useSubrouterInjectedData()
inject(entityData, false)  // (data, isNew)

// In the child detail route:
const { data } = useSubrouterInjectedData<EntityType>().provide()
// If isNew is true, show create form; otherwise show edit form
```

### Auth & Middleware
- `app/middleware/auth.global.ts` — Redirects `/dashboard*` to `/auth/login` if no valid session cookie
- `app/middleware/rewrites.global.ts` — Strips trailing slashes
- Admin-only pages check `user.role === 'admin'` inside the page or via a route-level check

---

## Data & API Conventions

- All API access goes through composables in `~/composables/useAPI.ts` — never raw `$fetch` or `useFetch` for backend calls
- Auth is handled automatically: `updateAPIClient()` reads the session token cookie and sets the Bearer header on the generated client
- API client is generated from OpenAPI spec at `http://localhost:13338/docs/openapi`
- **Never hand-edit** `app/api-client/*.gen.ts` — these are auto-generated by `@hey-api/openapi-ts`
- Runtime config: `LEIOS_API_URL`, `LEIOS_HUB_APP_URL`, `LEIOS_HUB_APP_ENABLE_SIGNUP` (defined in `nuxt.config.ts`)

---

## Tests

- Small suite under `tests/` using `bun test`
- Primarily exercises `app/utils/routeMatcher.ts`
- No frontend test harness (no Vitest, no Playwright)
- Focused verification: `bun test tests/utiils.test.ts`

---

## Nuxt / Nuxt UI MCP Servers

Nuxt and Nuxt UI MCP servers are configured in `.claude/settings.json`. Use them when working on Nuxt/Nuxt UI components instead of guessing props, slots, or component names — run queries against the MCP to get accurate API reference.

---

## Claude Code Custom Commands

Custom `/` commands defined in `.claude/settings.json`:
- **`/verify`** — Run tests then build (standard verification flow)
- **`/test`** — Run the test suite (`bun test`)
- **`/typecheck`** — Run the full TypeScript type checker (`bun run typecheck` which runs `nuxt typecheck` + `tsc`)
- **`/api-client`** — Regenerate the typed API client from OpenAPI spec
- **`/dev`** — Start or inspect the dev server setup

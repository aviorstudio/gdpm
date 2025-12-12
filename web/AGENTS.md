# GDPM Web (Godot Plugin Manager)

- **Stack**: Astro + Qwik via `@qwikdev/astro`, Supabase for auth, minimal custom styling in `src/layouts/Layout.astro`.
- **Auth flow**: Qwik components handle sign-in/sign-up and a lightweight sign-out button. Supabase client is centralized in `src/services/supabase.ts` and wrapped by per-component utils:
  - `components/qwik/authForm/AuthForm.tsx` (+ `authFormUtil.ts`) handles sign-in/up, username→email resolution, creates the `profiles` row on sign-up, and redirects to `/`.
  - `components/qwik/signOutButton/SignOutButton.tsx` signs out and redirects to `/signin`.
- **Pages**:
  - `/signin` renders the auth form (`components/SupabaseAuth` wraps the Qwik component).
  - `/` renders the signed-in view server-side and includes only the Qwik sign-out button.
- **Supabase data**: expects a `profiles` table keyed by `id` (FK to `auth.users`), with `username` and `email`. Username sign-in resolves email via this table.
- **Styling/layout**: Global CSS lives in `src/layouts/Layout.astro`; components are plain and reuse shared classes (`card`, `cta`, etc.).
- **Build/run**: `pnpm install`, then `pnpm dev` or `pnpm build`. Vite may warn about `vite-plugin-qwik` emitFile; safe to ignore for now.

Keep Qwik component logic lean: DB calls belong in the corresponding `*Util.ts` using the shared Supabase service. No direct `createClient` in JSX/Astro files.***

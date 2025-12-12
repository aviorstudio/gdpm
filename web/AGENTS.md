# GDPM Web (Godot Plugin Manager)

- **Stack**: Astro + Qwik via `@qwikdev/astro`, Supabase for auth, minimal custom styling in `src/layouts/RootLayout.astro`. Auth pages share `src/layouts/AuthLayout.astro`.
- **Auth flow**: `/signin` and `/signup` are server-rendered forms (no Qwik/JS). Supabase client and auth helpers live in `src/services/supabase.ts`. The only hydrated piece is the `components/qwik/signOutButton/SignOutButton.tsx` on the home page.
- **Pages**:
  - `/signin` renders a simple POST form for email/username + password.
  - `/signup` renders a POST form for username/email/password and creates the Supabase user + profiles row.
  - `/` renders the signed-in view server-side and includes only the Qwik sign-out button.
- **Supabase data**: expects a `profiles` table keyed by `id` (FK to `auth.users`), with `username` and `email`. Username sign-in resolves email via this table.
- **Styling/layout**: Global CSS lives in `src/layouts/RootLayout.astro`; auth shell in `src/layouts/AuthLayout.astro`; components are plain and reuse shared classes (`card`, `cta`, etc.).
- **Build/run**: `pnpm install`, then `pnpm dev` or `pnpm build`. Vite may warn about `vite-plugin-qwik` emitFile; safe to ignore for now.

Keep Qwik component logic lean: DB calls belong in the corresponding `*Util.ts` using the shared Supabase service. No direct `createClient` in JSX/Astro files.***

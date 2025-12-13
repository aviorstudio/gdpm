# GDPM Web (Godot Plugin Manager)

- **Stack**: Astro + Qwik via `@qwikdev/astro`, Supabase for auth, minimal custom styling in `src/layouts/RootLayout.astro`. Auth pages share `src/layouts/AuthLayout.astro`.
- **Auth flow**: `/signin` and `/register` are server-rendered forms (no Qwik/JS). Supabase client lives in `src/lib/supabase.ts`, cookie/session helpers live in `src/lib/auth.ts`, sign-in/out endpoints live in `src/pages/api/auth/*`, and `/register` handles email code confirmation via an HTML `dialog`.
- **Data access**: Put table reads/writes in `src/lib/dtoService.ts` (no cookie/auth handling).
- **Pages**:
  - `/signin` renders a simple POST form for email + password.
  - `/register` collects username + email + password, then confirms email via an 8-digit code modal before creating `profiles` + `usernames` rows.
  - `/` validates auth cookies server-side and renders the signed-in view.
- **Styling/layout**: Global CSS lives in `src/layouts/RootLayout.astro`; auth shell in `src/layouts/AuthLayout.astro`; components are plain and reuse shared classes (`card`, `cta`, etc.).
- **Build/run**: `pnpm install`, then `pnpm dev` or `pnpm build`. Vite may warn about `vite-plugin-qwik` emitFile; safe to ignore for now.

Keep Qwik component logic lean: use `src/lib/supabase.ts` and server routes/pages for Supabase calls. No direct `createClient` in JSX/Astro files.***

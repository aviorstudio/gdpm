# Repository Guidelines

## Project Structure & Module Organization

- `cli/`: Go 1.22 module for the `gdpm` CLI (`cmd/gdpm` entrypoint, shared code in `internal/`, tests in `*_test.go`).
- `web/`: Astro + Qwik site (`src/pages`, `src/components`, `src/lib`, assets in `public/`; build output in `dist/`).
- `supabase/`: Supabase project directories (`migrations/` for SQL migrations).
- When changing files under `web/`, also follow `web/AGENTS.md`.

## Build, Test, and Development Commands

**CLI (from `cli/`)**

- `go test ./...` — run unit tests.
- `go build ./cmd/gdpm` — build the `gdpm` binary.
- `go run ./cmd/gdpm init` — run locally against a Godot project (creates/updates `gdpm.json` and `addons/`).

**Web (from `web/`)**

- `pnpm install` — install dependencies (Node version pinned in `web/.node-version`).
- `pnpm dev` — start the dev server (`http://localhost:4321`).
- `pnpm build` / `pnpm preview` — build and preview production output.
- `pnpm astro check` — typecheck/validate.

## Coding Style & Naming Conventions

- Go: run `gofmt` on changed files; keep packages lowercase; filenames use `snake_case.go`.
- Web: TypeScript uses 2-space indentation; Astro components use `PascalCase.astro`; helpers in `src/lib/` use `camelCase.ts`.
- Routing: follow Astro file-based routing (e.g. `web/src/pages/@[username]/[plugin].astro`).

## Testing Guidelines

- Go uses the standard `testing` package; prefer small, table-driven tests colocated with the code (`*_test.go`).
- Web has no dedicated test suite; run `pnpm astro check` and manually verify core flows (signin/register, profile pages) for UI changes.

## Commit & Pull Request Guidelines

- Commit messages are short, imperative, and usually lowercase (examples in history: `clean up ui structure`, `add splash to index`).
- PRs: include a clear description, screenshots for UI changes, and a testing note (commands run + manual checks). Call out new env vars or Supabase migrations.

## Security & Configuration Tips

- Don’t commit secrets. Use `web/.env` (start from `web/.env.example`) and set `GITHUB_TOKEN` locally if the CLI hits GitHub rate limits.


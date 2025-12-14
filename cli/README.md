# GDPM CLI

Installs Godot addons from GitHub repositories into your project's `addons/` folder and tracks them in `gdpm.json`.

## Build

From `cli/`:

```sh
go build ./cmd/gdpm
```

## Usage

```sh
gdpm init
gdpm add @owner/repo@1.2.3
gdpm add @owner/repo
gdpm remove @owner/repo
```

If you hit GitHub rate limits, set `GITHUB_TOKEN`.


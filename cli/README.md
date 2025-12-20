# GDPM CLI

Installs Godot addons from GitHub repositories (including monorepo subdirectories) into your project's `addons/` folder and tracks them in `gdpm.json`.

`gdpm` expects the addon directory to contain a `plugin.cfg` at its root (so it can be enabled automatically in `project.godot`).

## Build

From `cli/`:

```sh
go build ./cmd/gdpm
```

## Usage

```sh
gdpm init
gdpm add @username/plugin@1.2.3
gdpm add @username/plugin
gdpm install
gdpm remove @username/plugin
gdpm link @username/plugin /absolute/path/to/addons/dir
gdpm link @username/plugin
gdpm unlink @username/plugin
```

See [`USAGE.md`](USAGE.md) for complete command behavior and state-dependent cases.

`gdpm link` will create a plugin entry in `gdpm.json` if it doesn't exist yet (as a local-only plugin, without a `repo`).

`gdpm.json` uses:

```json
{
  "plugins": {
    "@user/plugin": {
      "repo": "https://github.com/owner/repo/tree/<sha>",
      "version": "1.2.3"
    },
    "@user/monorepo_plugin": {
      "repo": "https://github.com/owner/monorepo/tree/<sha>/path/to/addon",
      "version": "1.2.3"
    },
    "@user/other": {
    }
  }
}
```

`gdpm.link.json` stores per-user link state and paths (add it to your `.gitignore`):

```json
{
  "plugins": {
    "@user/plugin": {
      "enabled": true,
      "path": "~/dev/plugin"
    },
    "@user/other": {
      "enabled": true,
      "path": "~/dev/other"
    }
  }
}
```

`gdpm.json` should not contain any `"link"` fields.

If you hit GitHub rate limits, set `GITHUB_TOKEN`.

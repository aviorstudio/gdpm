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
gdpm remove @username/plugin
gdpm link @username/plugin /absolute/path/to/addons/dir
gdpm unlink @username/plugin
gdpm unlink @name
```

`gdpm link` will create a plugin entry in `gdpm.json` if it doesn't exist yet (as a local-only plugin, without a `repo`).

`gdpm.json` uses:

```json
{
  "schemaVersion": "0.0.3",
  "plugins": {
    "@user/plugin": {
      "repo": "https://github.com/owner/repo/tree/<sha>",
      "version": "1.2.3",
      "link": "~/dev/plugin"
    },
    "@user/monorepo_plugin": {
      "repo": "https://github.com/owner/monorepo/tree/<sha>/path/to/addon",
      "version": "1.2.3"
    },
    "@user/other": {
      "link": "~/dev/other"
    }
  }
}
```

If you hit GitHub rate limits, set `GITHUB_TOKEN`.

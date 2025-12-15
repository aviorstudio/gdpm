package commands

import (
	"context"
	"fmt"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/aviorstudio/gdpm/cli/internal/fsutil"
	"github.com/aviorstudio/gdpm/cli/internal/manifest"
	"github.com/aviorstudio/gdpm/cli/internal/project"
	"github.com/aviorstudio/gdpm/cli/internal/spec"
)

type LinkOptions struct {
	Spec string
	Path string
}

func Link(ctx context.Context, opts LinkOptions) error {
	_ = ctx

	pathInput := strings.TrimSpace(opts.Path)
	if pathInput == "" {
		return fmt.Errorf("%w: missing local path", ErrUserInput)
	}

	startDir, err := os.Getwd()
	if err != nil {
		return err
	}

	projectDir, ok := project.FindManifestDir(startDir)
	if !ok {
		return fmt.Errorf("%w: no gdpm.json found (run `gdpm init`)", ErrUserInput)
	}

	manifestPath := filepath.Join(projectDir, "gdpm.json")
	m, err := manifest.Load(manifestPath)
	if err != nil {
		return err
	}

	expanded, err := fsutil.ExpandHome(pathInput)
	if err != nil {
		return err
	}
	abs, err := filepath.Abs(expanded)
	if err != nil {
		return err
	}
	info, err := os.Stat(abs)
	if err != nil {
		return err
	}
	if !info.IsDir() {
		return fmt.Errorf("%w: local path is not a directory: %s", ErrUserInput, abs)
	}

	if ok, err := pluginCfgExistsAtDirRoot(abs); err != nil {
		return fmt.Errorf("%w: %v", ErrUserInput, err)
	} else if !ok {
		return fmt.Errorf("%w: plugin.cfg not found at %s (pass the addon directory that contains plugin.cfg)", ErrUserInput, filepath.Join(abs, "plugin.cfg"))
	}

	var pluginKey string
	if strings.TrimSpace(opts.Spec) == "" {
		baseName := strings.TrimSpace(filepath.Base(abs))
		baseName = strings.TrimPrefix(baseName, "@")
		baseName = strings.ReplaceAll(baseName, " ", "_")
		pluginKey = "@" + baseName
		if !strings.HasPrefix(pluginKey, "@") || pluginKey == "@" {
			return fmt.Errorf("%w: failed to derive plugin name from path: %s", ErrUserInput, abs)
		}
		if manifest.HasPlugin(m, pluginKey) {
			return fmt.Errorf("%w: plugin already exists in gdpm.json: %s (run `gdpm unlink %s` first)", ErrUserInput, pluginKey, pluginKey)
		}
	} else {
		pkg, err := spec.ParsePackageSpec(opts.Spec)
		if err != nil {
			return fmt.Errorf("%w: %v", ErrUserInput, err)
		}
		if pkg.Version != "" {
			return fmt.Errorf("%w: link does not take a version (use @username/plugin)", ErrUserInput)
		}
		pluginKey = pkg.Name()
		if !manifest.HasPlugin(m, pluginKey) {
			return fmt.Errorf("%w: plugin not found in gdpm.json: %s", ErrUserInput, pluginKey)
		}
		if strings.TrimSpace(m.Plugins[pluginKey].Repo) == "" {
			return fmt.Errorf("%w: plugin has no repo in gdpm.json: %s", ErrUserInput, pluginKey)
		}
	}

	addonDirName, err := addonDirNameForPluginKey(pluginKey)
	if err != nil {
		return fmt.Errorf("%w: %v", ErrUserInput, err)
	}
	if err := validateNoAddonDirCollision(m, pluginKey, addonDirName); err != nil {
		return err
	}

	localAddonsDir := filepath.Join(projectDir, "addons")
	if err := os.MkdirAll(localAddonsDir, 0o755); err != nil {
		return err
	}

	dst := filepath.Join(localAddonsDir, addonDirName)
	if strings.TrimSpace(opts.Spec) == "" {
		if _, err := os.Lstat(dst); err == nil {
			return fmt.Errorf("%w: destination already exists: %s", ErrUserInput, dst)
		} else if !os.IsNotExist(err) {
			return err
		}
	} else {
		if err := fsutil.RemoveAll(dst); err != nil {
			return err
		}
	}

	if err := fsutil.SymlinkDir(abs, dst); err != nil {
		return err
	}

	if ok, err := pluginCfgExistsAtDirRoot(dst); err != nil {
		_ = fsutil.RemoveAll(dst)
		return fmt.Errorf("%w: %v", ErrUserInput, err)
	} else if !ok {
		_ = fsutil.RemoveAll(dst)
		return fmt.Errorf("%w: linked addon is missing plugin.cfg at %s", ErrUserInput, filepath.Join(dst, "plugin.cfg"))
	}

	storedPath, err := fsutil.AbbrevHome(abs)
	if err != nil {
		return err
	}

	plugin := m.Plugins[pluginKey]
	plugin.Path = storedPath
	m = manifest.UpsertPlugin(m, pluginKey, plugin)
	if err := manifest.Save(manifestPath, m); err != nil {
		return err
	}

	projectGodotPath := filepath.Join(projectDir, "project.godot")
	if _, err := os.Stat(projectGodotPath); err == nil {
		pluginCfgResPath := "res://" + path.Join("addons", addonDirName, "plugin.cfg")
		updated, err := project.SetEditorPluginEnabled(projectGodotPath, pluginCfgResPath, true)
		if err != nil {
			return err
		}
		if updated {
			fmt.Printf("enabled %s\n", pluginCfgResPath)
		}
	} else if !os.IsNotExist(err) {
		return err
	}

	fmt.Printf("linked %s -> %s\n", pluginKey, storedPath)
	return nil
}

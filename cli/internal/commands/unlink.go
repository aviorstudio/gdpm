package commands

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/aviorstudio/gdpm/cli/internal/fsutil"
	"github.com/aviorstudio/gdpm/cli/internal/gdpmdb"
	"github.com/aviorstudio/gdpm/cli/internal/githubapi"
	"github.com/aviorstudio/gdpm/cli/internal/manifest"
	"github.com/aviorstudio/gdpm/cli/internal/project"
	"github.com/aviorstudio/gdpm/cli/internal/spec"
)

type UnlinkOptions struct {
	Spec string
}

func Unlink(ctx context.Context, opts UnlinkOptions) error {
	specInput := strings.TrimSpace(opts.Spec)
	if specInput == "" {
		return fmt.Errorf("%w: missing plugin spec", ErrUserInput)
	}
	if !strings.HasPrefix(specInput, "@") {
		return fmt.Errorf("%w: spec must start with @ (got %q)", ErrUserInput, specInput)
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

	var pluginKey string
	if strings.Contains(specInput, "/") {
		pkg, err := spec.ParsePackageSpec(specInput)
		if err != nil {
			return fmt.Errorf("%w: %v", ErrUserInput, err)
		}
		if pkg.Version != "" {
			return fmt.Errorf("%w: unlink does not take a version (use @username/plugin)", ErrUserInput)
		}
		pluginKey = pkg.Name()
	} else {
		if strings.Count(specInput, "@") > 1 {
			return fmt.Errorf("%w: invalid plugin name %q", ErrUserInput, specInput)
		}
		pluginKey = specInput
	}

	plugin, ok := m.Plugins[pluginKey]
	if !ok {
		return fmt.Errorf("%w: plugin not found in gdpm.json: %s", ErrUserInput, pluginKey)
	}
	if strings.TrimSpace(plugin.Path) == "" {
		return fmt.Errorf("%w: plugin is not linked: %s", ErrUserInput, pluginKey)
	}

	addonDirName, err := addonDirNameForPluginKey(pluginKey)
	if err != nil {
		return fmt.Errorf("%w: %v", ErrUserInput, err)
	}
	dst := filepath.Join(projectDir, "addons", addonDirName)

	if strings.TrimSpace(plugin.Repo) == "" {
		if err := fsutil.RemoveAll(dst); err != nil {
			return err
		}
		m = manifest.RemovePlugin(m, pluginKey)
		if err := manifest.Save(manifestPath, m); err != nil {
			return err
		}
		fmt.Printf("unlinked %s\n", pluginKey)
		return nil
	}

	ghOwner, ghRepo, ref, err := gdpmdb.ParseGitHubTreeURL(plugin.Repo)
	if err != nil {
		return err
	}

	tmpDir, err := os.MkdirTemp("", "gdpm-unlink-*")
	if err != nil {
		return err
	}
	defer os.RemoveAll(tmpDir)

	zipPath := filepath.Join(tmpDir, "repo.zip")
	gh := githubapi.NewClient(os.Getenv("GITHUB_TOKEN"))
	if err := gh.DownloadZipball(ctx, ghOwner, ghRepo, ref, zipPath); err != nil {
		return err
	}

	extractDir := filepath.Join(tmpDir, "extract")
	rootDir, err := fsutil.ExtractZip(zipPath, extractDir)
	if err != nil {
		return err
	}

	localAddonsDir := filepath.Join(projectDir, "addons")
	if err := os.MkdirAll(localAddonsDir, 0o755); err != nil {
		return err
	}

	if err := fsutil.RemoveAll(dst); err != nil {
		return err
	}

	if err := fsutil.CopyPath(rootDir, dst); err != nil {
		return err
	}

	plugin.Path = ""
	m = manifest.UpsertPlugin(m, pluginKey, plugin)
	if err := manifest.Save(manifestPath, m); err != nil {
		return err
	}

	fmt.Printf("unlinked %s\n", pluginKey)
	return nil
}

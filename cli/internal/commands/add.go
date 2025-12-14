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

type AddOptions struct {
	Spec string
}

func Add(ctx context.Context, opts AddOptions) error {
	if opts.Spec == "" {
		return fmt.Errorf("%w: missing plugin spec", ErrUserInput)
	}

	startDir, err := os.Getwd()
	if err != nil {
		return err
	}

	projectDir, ok := project.FindManifestDir(startDir)
	if !ok {
		if godotDir, ok := project.FindGodotProjectDir(startDir); ok {
			return fmt.Errorf("%w: no gdpm.json found (run `gdpm init` in %s)", ErrUserInput, godotDir)
		}
		return fmt.Errorf("%w: no gdpm.json found (run `gdpm init`)", ErrUserInput)
	}

	manifestPath := filepath.Join(projectDir, "gdpm.json")
	m, err := manifest.Load(manifestPath)
	if err != nil {
		return err
	}

	pkg, err := spec.ParsePackageSpec(opts.Spec)
	if err != nil {
		return fmt.Errorf("%w: %v", ErrUserInput, err)
	}

	db := gdpmdb.NewDefaultClient()

	resolved, err := db.ResolvePlugin(ctx, pkg.Owner, pkg.Repo, pkg.Version)
	if err != nil {
		return fmt.Errorf("%w: %v", ErrUserInput, err)
	}

	tmpDir, err := os.MkdirTemp("", "gdpm-add-*")
	if err != nil {
		return err
	}
	defer os.RemoveAll(tmpDir)

	zipPath := filepath.Join(tmpDir, "repo.zip")
	gh := githubapi.NewClient(os.Getenv("GITHUB_TOKEN"))
	if err := gh.DownloadZipball(ctx, resolved.GitHubOwner, resolved.GitHubRepo, resolved.SHA, zipPath); err != nil {
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

	addonDirName := strings.ReplaceAll(pkg.Name(), "/", "_")
	if err := validateAddonDirName(addonDirName); err != nil {
		return fmt.Errorf("%w: %v", ErrUserInput, err)
	}

	rel := filepath.Join("addons", addonDirName)
	for otherName := range m.Plugins {
		if otherName == pkg.Name() {
			continue
		}
		parsed, err := spec.ParsePackageSpec(otherName)
		if err != nil {
			return fmt.Errorf("invalid plugin in gdpm.json: %s", otherName)
		}
		otherAddonDirName := strings.ReplaceAll(parsed.Name(), "/", "_")
		if otherAddonDirName == addonDirName {
			return fmt.Errorf("%w: path %s is already managed by %s", ErrUserInput, rel, otherName)
		}
	}

	dst := filepath.Join(localAddonsDir, addonDirName)
	if manifest.HasPlugin(m, pkg.Name()) {
		if err := fsutil.RemoveAll(dst); err != nil {
			return err
		}
	} else {
		if _, err := os.Lstat(dst); err == nil {
			return fmt.Errorf("%w: destination already exists: %s", ErrUserInput, dst)
		} else if !os.IsNotExist(err) {
			return err
		}
	}

	if err := fsutil.CopyPath(rootDir, dst); err != nil {
		return err
	}

	m = manifest.UpsertPlugin(m, pkg.Name(), manifest.Plugin{
		Repo:    gdpmdb.GitHubTreeURL(resolved.GitHubOwner, resolved.GitHubRepo, resolved.SHA),
		Version: resolved.Version,
	})
	if err := manifest.Save(manifestPath, m); err != nil {
		return err
	}

	fmt.Printf("installed %s@%s (%s)\n", pkg.Name(), resolved.Version, resolved.SHA)
	return nil
}

package commands

import (
	"context"
	"fmt"
	"os"
	"path"
	"path/filepath"
	"time"

	"github.com/aviorstudio/gdpm/cli/internal/fsutil"
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
		return fmt.Errorf("%w: missing package spec", ErrUserInput)
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

	client := githubapi.NewClient(os.Getenv("GITHUB_TOKEN"))
	ref, sha, err := client.ResolveRefAndSHA(ctx, pkg.Owner, pkg.Repo, pkg.Version)
	if err != nil {
		return err
	}

	tmpDir, err := os.MkdirTemp("", "gdpm-add-*")
	if err != nil {
		return err
	}
	defer os.RemoveAll(tmpDir)

	zipPath := filepath.Join(tmpDir, "repo.zip")
	if err := client.DownloadZipball(ctx, pkg.Owner, pkg.Repo, sha, zipPath); err != nil {
		return err
	}

	extractDir := filepath.Join(tmpDir, "extract")
	rootDir, err := fsutil.ExtractZip(zipPath, extractDir)
	if err != nil {
		return err
	}

	remoteAddonsDir := filepath.Join(rootDir, "addons")
	remoteEntries, err := os.ReadDir(remoteAddonsDir)
	if err != nil {
		if os.IsNotExist(err) {
			return fmt.Errorf("repo %s has no top-level addons/ directory at %s", pkg.RepoPath(), ref)
		}
		return err
	}
	if len(remoteEntries) == 0 {
		return fmt.Errorf("repo %s has an empty addons/ directory at %s", pkg.RepoPath(), ref)
	}

	existing, existingIdx := manifest.FindPackage(m, pkg.Name())
	if existingIdx >= 0 {
		if err := removeInstalledPaths(projectDir, existing.InstalledPaths, true); err != nil {
			return err
		}
	}

	localAddonsDir := filepath.Join(projectDir, "addons")
	if err := os.MkdirAll(localAddonsDir, 0o755); err != nil {
		return err
	}

	var installed []string
	for _, entry := range remoteEntries {
		rel := path.Join("addons", entry.Name())
		if _, other := manifest.PathOwner(m, rel, pkg.Name()); other != "" {
			return fmt.Errorf("%w: path %s is already managed by %s", ErrUserInput, rel, other)
		}

		src := filepath.Join(remoteAddonsDir, entry.Name())
		dst := filepath.Join(localAddonsDir, entry.Name())
		if _, err := os.Lstat(dst); err == nil {
			return fmt.Errorf("%w: destination already exists: %s", ErrUserInput, dst)
		} else if !os.IsNotExist(err) {
			return err
		}

		if err := fsutil.CopyPath(src, dst); err != nil {
			return err
		}
		installed = append(installed, rel)
	}

	entry := manifest.Package{
		Name:           pkg.Name(),
		Repo:           pkg.RepoPath(),
		Version:        ref,
		SHA:            sha,
		InstalledPaths: installed,
		InstalledAt:    time.Now().UTC().Format(time.RFC3339),
	}
	m = manifest.UpsertPackage(m, entry)
	if err := manifest.Save(manifestPath, m); err != nil {
		return err
	}

	fmt.Printf("installed %s@%s (%s)\n", pkg.Name(), ref, sha)
	return nil
}

func removeInstalledPaths(projectDir string, relPaths []string, allowMissing bool) error {
	for _, rel := range relPaths {
		ok, err := manifest.IsSafeInstalledPath(rel)
		if err != nil {
			return err
		}
		if !ok {
			return fmt.Errorf("refusing to remove non-addons path: %s", rel)
		}
		abs := filepath.Join(projectDir, filepath.FromSlash(rel))
		if err := fsutil.RemoveAll(abs); err != nil {
			if allowMissing && os.IsNotExist(err) {
				continue
			}
			return err
		}
	}
	return nil
}

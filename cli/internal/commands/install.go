package commands

import (
	"context"
	"fmt"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strings"

	"github.com/aviorstudio/gdpm/cli/internal/fsutil"
	"github.com/aviorstudio/gdpm/cli/internal/gdpmdb"
	"github.com/aviorstudio/gdpm/cli/internal/githubapi"
	"github.com/aviorstudio/gdpm/cli/internal/manifest"
	"github.com/aviorstudio/gdpm/cli/internal/project"
)

type InstallOptions struct{}

type installCandidate struct {
	pluginKey   string
	addonDir    string
	dst         string
	version     string
	ghOwner     string
	ghRepo      string
	ref         string
	repoSubdir  string
	prepRootDir string
}

func Install(ctx context.Context, opts InstallOptions) error {
	_ = opts

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

	pluginKeys := make([]string, 0, len(m.Plugins))
	for key := range m.Plugins {
		pluginKeys = append(pluginKeys, key)
	}
	sort.Strings(pluginKeys)

	addonsDir := filepath.Join(projectDir, "addons")
	candidates := make([]installCandidate, 0, len(pluginKeys))

	for _, pluginKey := range pluginKeys {
		addonDirName, err := addonDirNameForPluginKey(pluginKey)
		if err != nil {
			return fmt.Errorf("%w: invalid plugin key in gdpm.json: %s (%v)", ErrUserInput, pluginKey, err)
		}
		if err := validateNoAddonDirCollision(m, pluginKey, addonDirName); err != nil {
			return err
		}

		plugin := m.Plugins[pluginKey]
		if pluginLinkEnabled(plugin) {
			continue
		}

		dst := filepath.Join(addonsDir, addonDirName)
		if info, err := os.Lstat(dst); err == nil {
			if info.IsDir() || info.Mode()&os.ModeSymlink != 0 {
				continue
			}
			return fmt.Errorf("%w: addon path exists and is not a directory: %s", ErrUserInput, dst)
		} else if !os.IsNotExist(err) {
			return err
		}

		repoURL := strings.TrimSpace(plugin.Repo)
		if repoURL == "" {
			return fmt.Errorf("%w: plugin is not installed and has no repo: %s", ErrUserInput, pluginKey)
		}
		owner, repo, ref, repoSubdir, err := gdpmdb.ParseGitHubTreeURLWithPath(repoURL)
		if err != nil {
			return fmt.Errorf("%w: invalid repo for %s: %v", ErrUserInput, pluginKey, err)
		}

		candidates = append(candidates, installCandidate{
			pluginKey:  pluginKey,
			addonDir:   addonDirName,
			dst:        dst,
			version:    strings.TrimSpace(plugin.Version),
			ghOwner:    owner,
			ghRepo:     repo,
			ref:        ref,
			repoSubdir: repoSubdir,
		})
	}

	if len(candidates) == 0 {
		return nil
	}

	if err := os.MkdirAll(addonsDir, 0o755); err != nil {
		return err
	}

	projectGodotPath := filepath.Join(projectDir, "project.godot")
	hasProjectGodot := false
	if _, err := os.Stat(projectGodotPath); err == nil {
		hasProjectGodot = true
	} else if !os.IsNotExist(err) {
		return err
	}

	tmpDir, err := os.MkdirTemp("", "gdpm-install-*")
	if err != nil {
		return err
	}
	defer os.RemoveAll(tmpDir)

	gh := githubapi.NewClient(os.Getenv("GITHUB_TOKEN"))

	for i := range candidates {
		if _, err := os.Lstat(candidates[i].dst); err == nil {
			continue
		} else if !os.IsNotExist(err) {
			return err
		}

		pkgTmpDir := filepath.Join(tmpDir, fmt.Sprintf("pkg-%d", i))
		if err := os.MkdirAll(pkgTmpDir, 0o755); err != nil {
			return err
		}

		zipPath := filepath.Join(pkgTmpDir, "repo.zip")
		if err := gh.DownloadZipball(ctx, candidates[i].ghOwner, candidates[i].ghRepo, candidates[i].ref, zipPath); err != nil {
			return err
		}

		extractDir := filepath.Join(pkgTmpDir, "extract")
		rootDir, err := fsutil.ExtractZip(zipPath, extractDir)
		if err != nil {
			return err
		}

		pkgRootDir, err := repoSubdirRoot(rootDir, candidates[i].repoSubdir)
		if err != nil {
			return fmt.Errorf("%w: %v", ErrUserInput, err)
		}

		if ok, err := pluginCfgExistsAtDirRoot(pkgRootDir); err != nil {
			return fmt.Errorf("%w: %v", ErrUserInput, err)
		} else if !ok {
			expected := "res://" + path.Join("addons", candidates[i].addonDir, "plugin.cfg")
			if strings.TrimSpace(candidates[i].repoSubdir) != "" {
				return fmt.Errorf("%w: package is missing plugin.cfg at %s in repository (expected to install it to %s)", ErrUserInput, candidates[i].repoSubdir, expected)
			}
			return fmt.Errorf("%w: package is missing plugin.cfg at repository root (expected to install it to %s)", ErrUserInput, expected)
		}

		if _, err := os.Lstat(candidates[i].dst); err == nil {
			continue
		} else if !os.IsNotExist(err) {
			return err
		}

		if err := fsutil.CopyPath(pkgRootDir, candidates[i].dst); err != nil {
			return err
		}

		if ok, err := pluginCfgExistsAtDirRoot(candidates[i].dst); err != nil {
			_ = fsutil.RemoveAll(candidates[i].dst)
			return fmt.Errorf("%w: %v", ErrUserInput, err)
		} else if !ok {
			_ = fsutil.RemoveAll(candidates[i].dst)
			return fmt.Errorf("%w: installed addon is missing plugin.cfg at %s", ErrUserInput, filepath.Join(candidates[i].dst, "plugin.cfg"))
		}

		if hasProjectGodot {
			pluginCfgResPath := "res://" + path.Join("addons", candidates[i].addonDir, "plugin.cfg")
			updated, err := project.SetEditorPluginEnabled(projectGodotPath, pluginCfgResPath, true)
			if err != nil {
				return err
			}
			if updated {
				fmt.Printf("enabled %s\n", pluginCfgResPath)
			}
		}

		if candidates[i].version != "" {
			fmt.Printf("installed %s@%s\n", candidates[i].pluginKey, candidates[i].version)
		} else {
			fmt.Printf("installed %s\n", candidates[i].pluginKey)
		}
	}

	return nil
}

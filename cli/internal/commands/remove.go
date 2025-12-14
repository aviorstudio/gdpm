package commands

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/aviorstudio/gdpm/cli/internal/fsutil"
	"github.com/aviorstudio/gdpm/cli/internal/manifest"
	"github.com/aviorstudio/gdpm/cli/internal/project"
	"github.com/aviorstudio/gdpm/cli/internal/spec"
)

type RemoveOptions struct {
	Spec string
}

func Remove(ctx context.Context, opts RemoveOptions) error {
	_ = ctx

	if opts.Spec == "" {
		return fmt.Errorf("%w: missing plugin spec", ErrUserInput)
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

	pkg, err := spec.ParsePackageSpec(opts.Spec)
	if err != nil {
		return fmt.Errorf("%w: %v", ErrUserInput, err)
	}
	if pkg.Version != "" {
		return fmt.Errorf("%w: remove does not take a version (use @username/plugin)", ErrUserInput)
	}

	if !manifest.HasPlugin(m, pkg.Name()) {
		return fmt.Errorf("%w: plugin not found in gdpm.json: %s", ErrUserInput, pkg.Name())
	}

	addonDirName := strings.ReplaceAll(pkg.Name(), "/", "_")
	if err := validateAddonDirName(addonDirName); err != nil {
		return fmt.Errorf("%w: %v", ErrUserInput, err)
	}

	dst := filepath.Join(projectDir, "addons", addonDirName)
	if err := fsutil.RemoveAll(dst); err != nil {
		return err
	}

	m = manifest.RemovePlugin(m, pkg.Name())
	if err := manifest.Save(manifestPath, m); err != nil {
		return err
	}

	fmt.Printf("removed %s\n", pkg.Name())
	return nil
}

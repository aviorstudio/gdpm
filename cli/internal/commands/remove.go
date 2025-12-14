package commands

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

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
		return fmt.Errorf("%w: missing package spec", ErrUserInput)
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
		return fmt.Errorf("%w: remove does not take a version (use @owner/repo)", ErrUserInput)
	}

	existing, idx := manifest.FindPackage(m, pkg.Name())
	if idx < 0 {
		return fmt.Errorf("%w: package not found in gdpm.json: %s", ErrUserInput, pkg.Name())
	}

	if err := removeInstalledPaths(projectDir, existing.InstalledPaths, true); err != nil {
		return err
	}

	m = manifest.RemovePackage(m, pkg.Name())
	if err := manifest.Save(manifestPath, m); err != nil {
		return err
	}

	fmt.Printf("removed %s\n", pkg.Name())
	return nil
}

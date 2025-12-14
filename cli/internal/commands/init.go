package commands

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	"github.com/aviorstudio/gdpm/cli/internal/manifest"
	"github.com/aviorstudio/gdpm/cli/internal/project"
)

type InitOptions struct{}

func Init(ctx context.Context, _ InitOptions) error {
	_ = ctx

	startDir, err := os.Getwd()
	if err != nil {
		return err
	}

	if dir, ok := project.FindManifestDir(startDir); ok {
		return fmt.Errorf("%w: gdpm.json already exists at %s", ErrUserInput, filepath.Join(dir, "gdpm.json"))
	}

	targetDir := startDir
	if dir, ok := project.FindGodotProjectDir(startDir); ok {
		targetDir = dir
	}

	manifestPath := filepath.Join(targetDir, "gdpm.json")
	m := manifest.New()
	if err := manifest.Save(manifestPath, m); err != nil {
		return err
	}

	fmt.Printf("created %s\n", manifestPath)
	return nil
}

package commands

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sort"

	"github.com/aviorstudio/gdpm/cli/internal/manifest"
	"github.com/aviorstudio/gdpm/cli/internal/project"
)

type UnlinkAllOptions struct{}

func UnlinkAll(ctx context.Context, opts UnlinkAllOptions) error {
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
	for key, plugin := range m.Plugins {
		if !pluginLinkEnabled(plugin) {
			continue
		}
		pluginKeys = append(pluginKeys, key)
	}
	sort.Strings(pluginKeys)

	for _, pluginKey := range pluginKeys {
		if err := Unlink(ctx, UnlinkOptions{Spec: pluginKey}); err != nil {
			return err
		}
	}

	return nil
}

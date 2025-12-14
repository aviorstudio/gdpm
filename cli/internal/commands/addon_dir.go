package commands

import (
	"fmt"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/aviorstudio/gdpm/cli/internal/manifest"
)

var addonDirNameRe = regexp.MustCompile(`^@[A-Za-z0-9][A-Za-z0-9._-]*$`)

func validateAddonDirName(name string) error {
	name = strings.TrimSpace(name)
	if name == "" || name == "." || name == ".." {
		return fmt.Errorf("invalid addon dir name: %q", name)
	}
	if !addonDirNameRe.MatchString(name) {
		return fmt.Errorf("invalid addon dir name: %q", name)
	}
	return nil
}

func addonDirNameForPluginKey(pluginKey string) (string, error) {
	pluginKey = strings.TrimSpace(pluginKey)
	if pluginKey == "" {
		return "", fmt.Errorf("invalid plugin key: %q", pluginKey)
	}
	addonDirName := strings.ReplaceAll(pluginKey, "/", "_")
	if err := validateAddonDirName(addonDirName); err != nil {
		return "", err
	}
	return addonDirName, nil
}

func validateNoAddonDirCollision(m manifest.Manifest, pluginKey, addonDirName string) error {
	rel := filepath.Join("addons", addonDirName)
	for otherName := range m.Plugins {
		if otherName == pluginKey {
			continue
		}
		otherAddonDirName, err := addonDirNameForPluginKey(otherName)
		if err != nil {
			return fmt.Errorf("invalid plugin in gdpm.json: %s", otherName)
		}
		if otherAddonDirName == addonDirName {
			return fmt.Errorf("%w: path %s is already managed by %s", ErrUserInput, rel, otherName)
		}
	}
	return nil
}

package commands

import (
	"fmt"
	"regexp"
	"strings"
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

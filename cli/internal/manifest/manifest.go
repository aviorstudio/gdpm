package manifest

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"path"
	"sort"
	"strings"

	"github.com/aviorstudio/gdpm/cli/internal/fsutil"
)

const CurrentSchemaVersion = 1

type Manifest struct {
	SchemaVersion int       `json:"schemaVersion"`
	Packages      []Package `json:"packages"`
}

type Package struct {
	Name           string   `json:"name"`
	Repo           string   `json:"repo"`
	Version        string   `json:"version"`
	SHA            string   `json:"sha"`
	InstalledPaths []string `json:"installedPaths"`
	InstalledAt    string   `json:"installedAt,omitempty"`
}

func New() Manifest {
	return Manifest{
		SchemaVersion: CurrentSchemaVersion,
		Packages:      []Package{},
	}
}

func Load(path string) (Manifest, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return Manifest{}, err
	}

	var m Manifest
	dec := json.NewDecoder(bytes.NewReader(b))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&m); err != nil {
		return Manifest{}, err
	}
	if m.SchemaVersion == 0 {
		m.SchemaVersion = CurrentSchemaVersion
	}
	if m.SchemaVersion != CurrentSchemaVersion {
		return Manifest{}, fmt.Errorf("unsupported gdpm.json schemaVersion %d (expected %d)", m.SchemaVersion, CurrentSchemaVersion)
	}
	if m.Packages == nil {
		m.Packages = []Package{}
	}
	return m, nil
}

func Save(path string, m Manifest) error {
	sort.Slice(m.Packages, func(i, j int) bool {
		return m.Packages[i].Name < m.Packages[j].Name
	})
	out, err := json.MarshalIndent(m, "", "  ")
	if err != nil {
		return err
	}
	out = append(out, '\n')
	return fsutil.WriteFileAtomic(path, out, 0o644)
}

func FindPackage(m Manifest, name string) (Package, int) {
	for i, p := range m.Packages {
		if p.Name == name {
			return p, i
		}
	}
	return Package{}, -1
}

func UpsertPackage(m Manifest, pkg Package) Manifest {
	_, idx := FindPackage(m, pkg.Name)
	if idx >= 0 {
		m.Packages[idx] = pkg
		return m
	}
	m.Packages = append(m.Packages, pkg)
	return m
}

func RemovePackage(m Manifest, name string) Manifest {
	_, idx := FindPackage(m, name)
	if idx < 0 {
		return m
	}
	m.Packages = append(m.Packages[:idx], m.Packages[idx+1:]...)
	return m
}

func PathOwner(m Manifest, relPath string, excludeName string) (bool, string) {
	relPath = path.Clean(relPath)
	for _, p := range m.Packages {
		if p.Name == excludeName {
			continue
		}
		for _, ip := range p.InstalledPaths {
			if path.Clean(ip) == relPath {
				return true, p.Name
			}
		}
	}
	return false, ""
}

func IsSafeInstalledPath(rel string) (bool, error) {
	rel = path.Clean(rel)
	if rel == "." || rel == "" {
		return false, nil
	}
	if path.IsAbs(rel) {
		return false, nil
	}
	if rel == ".." || strings.HasPrefix(rel, "../") {
		return false, nil
	}
	return rel == "addons" || strings.HasPrefix(rel, "addons/"), nil
}

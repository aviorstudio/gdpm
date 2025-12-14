package manifest

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"

	"github.com/aviorstudio/gdpm/cli/internal/fsutil"
)

const SchemaVersionLegacy = "0.0.1"
const SchemaVersionCurrent = "0.0.2"

type Manifest struct {
	SchemaVersion string            `json:"schemaVersion"`
	Plugins       map[string]Plugin `json:"plugins"`
}

type Plugin struct {
	Repo    string `json:"repo,omitempty"`
	Version string `json:"version,omitempty"`
	Path    string `json:"path,omitempty"`
}

func New() Manifest {
	return Manifest{
		SchemaVersion: SchemaVersionCurrent,
		Plugins:       map[string]Plugin{},
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
	if m.SchemaVersion == "" {
		m.SchemaVersion = SchemaVersionLegacy
	}
	if m.SchemaVersion != SchemaVersionLegacy && m.SchemaVersion != SchemaVersionCurrent {
		return Manifest{}, fmt.Errorf("unsupported gdpm.json schemaVersion %q (expected %q or %q)", m.SchemaVersion, SchemaVersionLegacy, SchemaVersionCurrent)
	}
	if m.Plugins == nil {
		m.Plugins = map[string]Plugin{}
	}
	return m, nil
}

func Save(path string, m Manifest) error {
	if m.Plugins == nil {
		m.Plugins = map[string]Plugin{}
	}
	m.SchemaVersion = SchemaVersionCurrent
	out, err := json.MarshalIndent(m, "", "  ")
	if err != nil {
		return err
	}
	out = append(out, '\n')
	return fsutil.WriteFileAtomic(path, out, 0o644)
}

func HasPlugin(m Manifest, name string) bool {
	_, ok := m.Plugins[name]
	return ok
}

func UpsertPlugin(m Manifest, name string, plugin Plugin) Manifest {
	if m.Plugins == nil {
		m.Plugins = map[string]Plugin{}
	}
	m.Plugins[name] = plugin
	return m
}

func RemovePlugin(m Manifest, name string) Manifest {
	delete(m.Plugins, name)
	return m
}

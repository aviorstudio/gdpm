package manifest

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"

	"github.com/aviorstudio/gdpm/cli/internal/fsutil"
)

const SchemaVersion = "0.0.1"

type Manifest struct {
	SchemaVersion string            `json:"schemaVersion"`
	Plugins       map[string]Plugin `json:"plugins"`
}

type Plugin struct {
	Repo    string `json:"repo"`
	Version string `json:"version"`
}

func New() Manifest {
	return Manifest{
		SchemaVersion: SchemaVersion,
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
		m.SchemaVersion = SchemaVersion
	}
	if m.SchemaVersion != SchemaVersion {
		return Manifest{}, fmt.Errorf("unsupported gdpm.json schemaVersion %q (expected %q)", m.SchemaVersion, SchemaVersion)
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

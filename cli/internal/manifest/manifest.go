package manifest

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/aviorstudio/gdpm/cli/internal/fsutil"
)

type Manifest struct {
	Plugins map[string]Plugin `json:"plugins"`
}

type Plugin struct {
	Repo    string `json:"repo,omitempty"`
	Version string `json:"version,omitempty"`
	Link    *Link  `json:"link,omitempty"`
}

type Link struct {
	Enabled bool   `json:"enabled"`
	Path    string `json:"path,omitempty"`
}

func (l *Link) UnmarshalJSON(data []byte) error {
	data = bytes.TrimSpace(data)
	if len(data) == 0 || bytes.Equal(data, []byte("null")) {
		*l = Link{}
		return nil
	}
	if data[0] != '{' {
		return fmt.Errorf("link must be an object")
	}

	var raw map[string]json.RawMessage
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}
	for k := range raw {
		switch k {
		case "enabled", "path":
		default:
			return fmt.Errorf("unknown link field %q", k)
		}
	}

	enabledRaw, ok := raw["enabled"]
	if !ok {
		return fmt.Errorf("missing link.enabled")
	}
	var enabled bool
	if err := json.Unmarshal(enabledRaw, &enabled); err != nil {
		return err
	}

	var path string
	if pathRaw, ok := raw["path"]; ok {
		if err := json.Unmarshal(pathRaw, &path); err != nil {
			return err
		}
	}
	path = strings.TrimSpace(path)
	if enabled && path == "" {
		return fmt.Errorf("link is enabled but path is empty")
	}

	*l = Link{
		Enabled: enabled,
		Path:    path,
	}
	return nil
}

func (p *Plugin) UnmarshalJSON(data []byte) error {
	var raw map[string]json.RawMessage
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}
	for k := range raw {
		switch k {
		case "repo", "version", "link":
		default:
			return fmt.Errorf("unknown field %q", k)
		}
	}

	var tmp struct {
		Repo    string `json:"repo,omitempty"`
		Version string `json:"version,omitempty"`
		Link    *Link  `json:"link,omitempty"`
	}
	if err := json.Unmarshal(data, &tmp); err != nil {
		return err
	}

	*p = Plugin{
		Repo:    tmp.Repo,
		Version: tmp.Version,
		Link:    tmp.Link,
	}
	return nil
}

func New() Manifest {
	return Manifest{
		Plugins: map[string]Plugin{},
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

package manifest

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestLoadLegacySchemaVersion(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "gdpm.json")
	if err := os.WriteFile(p, []byte(`{"schemaVersion":"0.0.1","plugins":{"@user/plugin":{"repo":"https://example.com","version":"1.2.3"}}}`), 0o644); err != nil {
		t.Fatalf("write: %v", err)
	}

	m, err := Load(p)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if m.SchemaVersion != "0.0.1" {
		t.Fatalf("expected schemaVersion=0.0.1, got %q", m.SchemaVersion)
	}
	if got := m.Plugins["@user/plugin"].Version; got != "1.2.3" {
		t.Fatalf("expected version=1.2.3, got %q", got)
	}

	if err := Save(p, m); err != nil {
		t.Fatalf("Save: %v", err)
	}
	b, err := os.ReadFile(p)
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	if !strings.Contains(string(b), `"schemaVersion": "0.0.2"`) {
		t.Fatalf("expected saved file to upgrade schemaVersion to 0.0.2, got:\n%s", string(b))
	}
}

func TestLoadCurrentSchemaVersionWithPath(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "gdpm.json")
	if err := os.WriteFile(p, []byte(`{"schemaVersion":"0.0.2","plugins":{"@user/plugin":{"repo":"https://example.com","version":"1.2.3","path":"~/dev/plugin"}}}`), 0o644); err != nil {
		t.Fatalf("write: %v", err)
	}

	m, err := Load(p)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if got := m.Plugins["@user/plugin"].Path; got != "~/dev/plugin" {
		t.Fatalf("expected path=~/dev/plugin, got %q", got)
	}
}

func TestLoadUnsupportedSchemaVersion(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "gdpm.json")
	if err := os.WriteFile(p, []byte(`{"schemaVersion":"9.9.9","plugins":{}}`), 0o644); err != nil {
		t.Fatalf("write: %v", err)
	}

	if _, err := Load(p); err == nil {
		t.Fatalf("expected error")
	}
}

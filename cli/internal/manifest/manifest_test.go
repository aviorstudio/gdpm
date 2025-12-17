package manifest

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestSave_DoesNotWriteSchemaVersion(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "gdpm.json")

	m := New()
	m = UpsertPlugin(m, "@user/plugin", Plugin{
		Repo:    "https://example.com",
		Version: "1.2.3",
		Link: &Link{
			Enabled: true,
			Path:    "~/dev/plugin",
		},
	})

	if err := Save(p, m); err != nil {
		t.Fatalf("Save: %v", err)
	}
	b, err := os.ReadFile(p)
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	if strings.Contains(string(b), "schemaVersion") {
		t.Fatalf("expected saved file not to include schemaVersion, got:\n%s", string(b))
	}
}

func TestLoad_LinkObjectWithLink(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "gdpm.json")
	if err := os.WriteFile(p, []byte(`{"plugins":{"@user/plugin":{"repo":"https://example.com","version":"1.2.3","link":{"enabled":true,"path":"~/dev/plugin"}}}}`), 0o644); err != nil {
		t.Fatalf("write: %v", err)
	}

	m, err := Load(p)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if m.Plugins["@user/plugin"].Link == nil {
		t.Fatalf("expected link to be set")
	}
	if got := m.Plugins["@user/plugin"].Link.Path; got != "~/dev/plugin" {
		t.Fatalf("expected link.path=~/dev/plugin, got %q", got)
	}
	if got := m.Plugins["@user/plugin"].Link.Enabled; got != true {
		t.Fatalf("expected link.enabled=true, got %v", got)
	}
}

func TestLoad_RejectsSchemaVersion(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "gdpm.json")
	if err := os.WriteFile(p, []byte(`{"schemaVersion":"0.0.1","plugins":{}}`), 0o644); err != nil {
		t.Fatalf("write: %v", err)
	}

	if _, err := Load(p); err == nil {
		t.Fatalf("expected error")
	}
}

func TestLoad_RejectsLegacyLinkString(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "gdpm.json")
	if err := os.WriteFile(p, []byte(`{"plugins":{"@user/plugin":{"repo":"https://example.com","version":"1.2.3","link":"~/dev/plugin"}}}`), 0o644); err != nil {
		t.Fatalf("write: %v", err)
	}

	if _, err := Load(p); err == nil {
		t.Fatalf("expected error")
	}
}

func TestLoad_RejectsLegacyPathField(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "gdpm.json")
	if err := os.WriteFile(p, []byte(`{"plugins":{"@user/plugin":{"repo":"https://example.com","version":"1.2.3","path":"~/dev/plugin"}}}`), 0o644); err != nil {
		t.Fatalf("write: %v", err)
	}

	if _, err := Load(p); err == nil {
		t.Fatalf("expected error")
	}
}

func TestLoad_RejectsUnknownLinkField(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "gdpm.json")
	if err := os.WriteFile(p, []byte(`{"plugins":{"@user/plugin":{"repo":"https://example.com","version":"1.2.3","link":{"enabled":true,"path":"~/dev/plugin","extra":true}}}}`), 0o644); err != nil {
		t.Fatalf("write: %v", err)
	}

	if _, err := Load(p); err == nil {
		t.Fatalf("expected error")
	}
}

func TestLoad_RejectsLinkEnabledWithoutPath(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "gdpm.json")
	if err := os.WriteFile(p, []byte(`{"plugins":{"@user/plugin":{"repo":"https://example.com","version":"1.2.3","link":{"enabled":true}}}}`), 0o644); err != nil {
		t.Fatalf("write: %v", err)
	}

	if _, err := Load(p); err == nil {
		t.Fatalf("expected error")
	}
}

func TestLoad_RejectsLinkMissingEnabled(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "gdpm.json")
	if err := os.WriteFile(p, []byte(`{"plugins":{"@user/plugin":{"repo":"https://example.com","version":"1.2.3","link":{"path":"~/dev/plugin"}}}}`), 0o644); err != nil {
		t.Fatalf("write: %v", err)
	}

	if _, err := Load(p); err == nil {
		t.Fatalf("expected error")
	}
}

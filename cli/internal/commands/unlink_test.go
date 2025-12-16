package commands

import (
	"context"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	"github.com/aviorstudio/gdpm/cli/internal/manifest"
)

func TestUnlink_RemovesSymlinkWhenNoRepo(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("skipping on Windows (symlink/junction behavior varies by environment)")
	}

	projectDir := t.TempDir()

	pluginDir := filepath.Join(projectDir, "local_plugin")
	if err := os.MkdirAll(pluginDir, 0o755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	if err := os.WriteFile(filepath.Join(pluginDir, "plugin.cfg"), []byte("[plugin]\nname=\"Test\"\n"), 0o644); err != nil {
		t.Fatalf("write plugin.cfg: %v", err)
	}

	m := manifest.New()
	m = manifest.UpsertPlugin(m, "@user/plugin", manifest.Plugin{
		Link: &manifest.Link{
			Enabled: true,
			Path:    pluginDir,
		},
	})
	if err := manifest.Save(filepath.Join(projectDir, "gdpm.json"), m); err != nil {
		t.Fatalf("write gdpm.json: %v", err)
	}

	addonDirName, err := addonDirNameForPluginKey("@user/plugin")
	if err != nil {
		t.Fatalf("addonDirNameForPluginKey: %v", err)
	}
	dst := filepath.Join(projectDir, "addons", addonDirName)
	if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
		t.Fatalf("mkdir addons: %v", err)
	}
	if err := os.Symlink(pluginDir, dst); err != nil {
		t.Fatalf("symlink dst: %v", err)
	}

	projectGodotPath := filepath.Join(projectDir, "project.godot")
	in := "config_version=5\n\n[editor_plugins]\nenabled=PackedStringArray(\"res://addons/@user_plugin/plugin.cfg\")\n"
	if err := os.WriteFile(projectGodotPath, []byte(in), 0o644); err != nil {
		t.Fatalf("write project.godot: %v", err)
	}

	oldWd, err := os.Getwd()
	if err != nil {
		t.Fatalf("getwd: %v", err)
	}
	defer func() {
		_ = os.Chdir(oldWd)
	}()
	if err := os.Chdir(projectDir); err != nil {
		t.Fatalf("chdir: %v", err)
	}

	if err := Unlink(context.Background(), UnlinkOptions{
		Spec: "@user/plugin",
	}); err != nil {
		t.Fatalf("unlink: %v", err)
	}

	if _, err := os.Lstat(dst); err == nil {
		t.Fatalf("expected dst to be removed")
	} else if !os.IsNotExist(err) {
		t.Fatalf("lstat dst: %v", err)
	}

	outBytes, err := os.ReadFile(projectGodotPath)
	if err != nil {
		t.Fatalf("read project.godot: %v", err)
	}
	out := string(outBytes)
	if strings.Contains(out, "res://addons/@user_plugin/plugin.cfg") {
		t.Fatalf("expected plugin to be disabled in project.godot, got:\n%s", out)
	}

	m2, err := manifest.Load(filepath.Join(projectDir, "gdpm.json"))
	if err != nil {
		t.Fatalf("read gdpm.json: %v", err)
	}
	p, ok := m2.Plugins["@user/plugin"]
	if !ok {
		t.Fatalf("expected plugin to remain in gdpm.json")
	}
	if p.Link == nil {
		t.Fatalf("expected link to remain in gdpm.json")
	}
	if p.Link.Enabled {
		t.Fatalf("expected link.enabled=false, got true")
	}
	if got := p.Link.Path; got != pluginDir {
		t.Fatalf("expected link.path %q, got %q", pluginDir, got)
	}
}

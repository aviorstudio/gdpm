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

func TestLink_ReplacesLegacyEditorPluginEntryForSameLocalPath(t *testing.T) {
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
	m = manifest.UpsertPlugin(m, "@local_plugin", manifest.Plugin{Link: pluginDir})
	if err := manifest.Save(filepath.Join(projectDir, "gdpm.json"), m); err != nil {
		t.Fatalf("write gdpm.json: %v", err)
	}

	projectGodotPath := filepath.Join(projectDir, "project.godot")
	in := "config_version=5\n\n[editor_plugins]\nenabled=PackedStringArray(\"res://addons/@local_plugin/plugin.cfg\", \"res://addons/other/plugin.cfg\")\n"
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

	if err := Link(context.Background(), LinkOptions{
		Spec: "@user/plugin",
		Path: pluginDir,
	}); err != nil {
		t.Fatalf("link: %v", err)
	}

	outBytes, err := os.ReadFile(projectGodotPath)
	if err != nil {
		t.Fatalf("read project.godot: %v", err)
	}
	out := string(outBytes)

	if strings.Contains(out, "res://addons/@local_plugin/plugin.cfg") {
		t.Fatalf("expected legacy enabled entry removed, got:\n%s", out)
	}
	if !strings.Contains(out, "res://addons/other/plugin.cfg") {
		t.Fatalf("expected unrelated enabled entry retained, got:\n%s", out)
	}
	if !strings.Contains(out, "res://addons/@user_plugin/plugin.cfg") {
		t.Fatalf("expected new enabled entry added, got:\n%s", out)
	}
}

func TestLink_OverwritesExistingAddonsDirWhenNotInManifest(t *testing.T) {
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
	if err := manifest.Save(filepath.Join(projectDir, "gdpm.json"), m); err != nil {
		t.Fatalf("write gdpm.json: %v", err)
	}

	addonDirName, err := addonDirNameForPluginKey("@user/plugin")
	if err != nil {
		t.Fatalf("addonDirNameForPluginKey: %v", err)
	}
	dst := filepath.Join(projectDir, "addons", addonDirName)
	if err := os.MkdirAll(dst, 0o755); err != nil {
		t.Fatalf("mkdir existing addon dir: %v", err)
	}
	if err := os.WriteFile(filepath.Join(dst, "old.txt"), []byte("old"), 0o644); err != nil {
		t.Fatalf("write old file: %v", err)
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

	if err := Link(context.Background(), LinkOptions{
		Spec: "@user/plugin",
		Path: pluginDir,
	}); err != nil {
		t.Fatalf("link: %v", err)
	}

	if info, err := os.Lstat(dst); err != nil {
		t.Fatalf("lstat dst: %v", err)
	} else if info.Mode()&os.ModeSymlink == 0 {
		t.Fatalf("expected dst to be symlink, got mode %v", info.Mode())
	}

	m2, err := manifest.Load(filepath.Join(projectDir, "gdpm.json"))
	if err != nil {
		t.Fatalf("read gdpm.json: %v", err)
	}
	if got := m2.Plugins["@user/plugin"].Link; got != pluginDir {
		t.Fatalf("expected gdpm.json link %q, got %q", pluginDir, got)
	}
}

func TestLink_DisablesLegacyEditorPluginEntryDerivedFromPath(t *testing.T) {
	projectDir := t.TempDir()

	pluginDir := filepath.Join(projectDir, "gd-playwright-emitter")
	if err := os.MkdirAll(pluginDir, 0o755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	if err := os.WriteFile(filepath.Join(pluginDir, "plugin.cfg"), []byte("[plugin]\nname=\"Test\"\n"), 0o644); err != nil {
		t.Fatalf("write plugin.cfg: %v", err)
	}

	m := manifest.New()
	if err := manifest.Save(filepath.Join(projectDir, "gdpm.json"), m); err != nil {
		t.Fatalf("write gdpm.json: %v", err)
	}

	projectGodotPath := filepath.Join(projectDir, "project.godot")
	in := "config_version=5\n\n[editor_plugins]\nenabled=PackedStringArray(\"res://addons/@gd-playwright-emitter/plugin.cfg\")\n"
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

	if err := Link(context.Background(), LinkOptions{
		Spec: "@aviorstudio/gd-playwright",
		Path: pluginDir,
	}); err != nil {
		t.Fatalf("link: %v", err)
	}

	outBytes, err := os.ReadFile(projectGodotPath)
	if err != nil {
		t.Fatalf("read project.godot: %v", err)
	}
	out := string(outBytes)

	if strings.Contains(out, "res://addons/@gd-playwright-emitter/plugin.cfg") {
		t.Fatalf("expected legacy enabled entry removed, got:\n%s", out)
	}
	if !strings.Contains(out, "res://addons/@aviorstudio_gd-playwright/plugin.cfg") {
		t.Fatalf("expected new enabled entry added, got:\n%s", out)
	}
}

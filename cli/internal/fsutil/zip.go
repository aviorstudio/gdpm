package fsutil

import (
	"archive/zip"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

func ExtractZip(zipPath, destDir string) (string, error) {
	r, err := zip.OpenReader(zipPath)
	if err != nil {
		return "", err
	}
	defer r.Close()

	if err := os.MkdirAll(destDir, 0o755); err != nil {
		return "", err
	}

	roots := map[string]struct{}{}

	for _, f := range r.File {
		name := strings.TrimPrefix(f.Name, "/")
		if name == "" {
			continue
		}

		root := strings.SplitN(name, "/", 2)[0]
		roots[root] = struct{}{}

		if err := extractZipFile(f, destDir); err != nil {
			return "", err
		}
	}

	if len(roots) != 1 {
		return "", fmt.Errorf("unexpected zip layout (expected single root dir, got %d)", len(roots))
	}
	var rootName string
	for k := range roots {
		rootName = k
	}
	return filepath.Join(destDir, rootName), nil
}

func extractZipFile(f *zip.File, destDir string) error {
	if f.FileInfo().Mode()&os.ModeSymlink != 0 {
		return fmt.Errorf("refusing to extract symlink: %s", f.Name)
	}

	rel := filepath.FromSlash(strings.TrimPrefix(f.Name, "/"))
	rel = filepath.Clean(rel)
	if rel == "." || rel == string(filepath.Separator) || rel == "" {
		return nil
	}
	if strings.HasPrefix(rel, ".."+string(filepath.Separator)) || rel == ".." {
		return fmt.Errorf("invalid zip entry path: %s", f.Name)
	}

	destPath := filepath.Join(destDir, rel)
	destDirClean := filepath.Clean(destDir)
	destPathClean := filepath.Clean(destPath)
	if destPathClean != destDirClean && !strings.HasPrefix(destPathClean, destDirClean+string(filepath.Separator)) {
		return fmt.Errorf("invalid zip entry path: %s", f.Name)
	}

	if f.FileInfo().IsDir() {
		return os.MkdirAll(destPathClean, 0o755)
	}

	if err := os.MkdirAll(filepath.Dir(destPathClean), 0o755); err != nil {
		return err
	}
	in, err := f.Open()
	if err != nil {
		return err
	}
	defer in.Close()

	out, err := os.OpenFile(destPathClean, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, f.Mode().Perm())
	if err != nil {
		return err
	}
	defer out.Close()

	if _, err := io.Copy(out, in); err != nil {
		return err
	}
	return out.Close()
}

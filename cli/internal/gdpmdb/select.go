package gdpmdb

import (
	"strings"

	"github.com/aviorstudio/gdpm/cli/internal/semver"
)

func selectVersion(rows []versionRow, requested string) (versionRow, bool) {
	requested = strings.TrimSpace(requested)
	if requested != "" {
		reqNorm := normalizeVersion(requested)
		for _, row := range rows {
			if strings.TrimSpace(row.SHA) == "" || strings.TrimSpace(row.Version) == "" {
				continue
			}
			if normalizeVersion(row.Version) == reqNorm {
				return row, true
			}
		}
		return versionRow{}, false
	}

	var best versionRow
	var bestVer semver.Version
	var bestSet bool

	for _, row := range rows {
		if strings.TrimSpace(row.SHA) == "" || strings.TrimSpace(row.Version) == "" {
			continue
		}
		v, ok := semver.Parse(row.Version)
		if !ok {
			continue
		}
		if !bestSet || semver.Compare(v, bestVer) > 0 {
			best = row
			bestVer = v
			bestSet = true
		}
	}
	if bestSet {
		return best, true
	}

	for _, row := range rows {
		if strings.TrimSpace(row.SHA) == "" || strings.TrimSpace(row.Version) == "" {
			continue
		}
		return row, true
	}

	return versionRow{}, false
}

func normalizeVersion(v string) string {
	v = strings.TrimSpace(v)
	v = strings.TrimPrefix(v, "v")
	return v
}

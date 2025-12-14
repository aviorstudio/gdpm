package gdpmdb

import (
	"fmt"
	"net/url"
	"regexp"
	"strings"
)

var gitSSHRe = regexp.MustCompile(`^git@([^:]+):(.+)$`)

func NormalizeRepoURL(value string) string {
	repo := strings.TrimSpace(value)
	if repo == "" {
		return ""
	}

	if strings.HasPrefix(strings.ToLower(repo), "http://") || strings.HasPrefix(strings.ToLower(repo), "https://") {
		u, err := url.Parse(repo)
		if err != nil {
			return repo
		}
		normalizedPath := strings.TrimRight(u.Path, "/")
		normalizedPath = strings.TrimSuffix(normalizedPath, ".git")
		u.Path = normalizedPath
		u.RawQuery = ""
		u.Fragment = ""
		return strings.TrimRight(u.String(), "/")
	}

	if m := gitSSHRe.FindStringSubmatch(repo); m != nil {
		host := strings.TrimSpace(m[1])
		pathPart := strings.TrimSpace(m[2])
		pathPart = strings.TrimSuffix(pathPart, ".git")
		pathPart = strings.Trim(pathPart, "/")
		if pathPart == "" {
			return "https://" + host
		}
		return "https://" + host + "/" + pathPart
	}

	sanitized := strings.Trim(repo, "/")
	sanitized = strings.TrimSuffix(sanitized, ".git")
	if sanitized == "" {
		return ""
	}
	return "https://" + sanitized
}

func ParseGitHubOwnerRepo(repo string) (string, string, error) {
	repoURL := NormalizeRepoURL(repo)
	if repoURL == "" {
		return "", "", fmt.Errorf("empty repo url")
	}

	u, err := url.Parse(repoURL)
	if err != nil {
		return "", "", fmt.Errorf("invalid repo url: %w", err)
	}
	host := strings.ToLower(strings.TrimSpace(u.Hostname()))
	if !strings.HasSuffix(host, "github.com") {
		return "", "", fmt.Errorf("only github.com repos are supported (got %s)", host)
	}

	p := strings.Trim(u.Path, "/")
	p = strings.TrimSuffix(p, ".git")
	parts := strings.Split(p, "/")
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
		return "", "", fmt.Errorf("invalid github repo path (expected github.com/owner/repo): %s", repoURL)
	}
	return parts[0], parts[1], nil
}

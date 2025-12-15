package gdpmdb

import (
	"fmt"
	"net/url"
	"strings"
)

func GitHubTreeURL(owner, repo, ref string) string {
	return "https://github.com/" + owner + "/" + repo + "/tree/" + url.PathEscape(ref)
}

func ParseGitHubTreeURL(treeURL string) (string, string, string, error) {
	treeURL = strings.TrimSpace(treeURL)
	if treeURL == "" {
		return "", "", "", fmt.Errorf("empty tree url")
	}

	u, err := url.Parse(treeURL)
	if err != nil {
		return "", "", "", fmt.Errorf("invalid tree url: %w", err)
	}

	host := strings.ToLower(strings.TrimSpace(u.Hostname()))
	if !strings.HasSuffix(host, "github.com") {
		return "", "", "", fmt.Errorf("only github.com tree urls are supported (got %s)", host)
	}

	p := strings.Trim(u.Path, "/")
	parts := strings.Split(p, "/")
	if len(parts) < 4 || parts[0] == "" || parts[1] == "" || parts[2] != "tree" {
		return "", "", "", fmt.Errorf("invalid github tree url (expected github.com/owner/repo/tree/ref): %s", treeURL)
	}

	refPath := strings.Join(parts[3:], "/")
	ref, err := url.PathUnescape(refPath)
	if err != nil {
		return "", "", "", fmt.Errorf("invalid tree ref: %w", err)
	}
	return parts[0], parts[1], ref, nil
}

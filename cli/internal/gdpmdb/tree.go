package gdpmdb

import (
	"net/url"
)

func GitHubTreeURL(owner, repo, ref string) string {
	return "https://github.com/" + owner + "/" + repo + "/tree/" + url.PathEscape(ref)
}

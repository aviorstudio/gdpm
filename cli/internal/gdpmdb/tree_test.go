package gdpmdb

import "testing"

func TestParseGitHubTreeURL(t *testing.T) {
	owner, repo, ref, err := ParseGitHubTreeURL("https://github.com/aviorstudio/revik/tree/abc123")
	if err != nil {
		t.Fatalf("ParseGitHubTreeURL: %v", err)
	}
	if owner != "aviorstudio" || repo != "revik" || ref != "abc123" {
		t.Fatalf("unexpected result: %s/%s@%s", owner, repo, ref)
	}
}

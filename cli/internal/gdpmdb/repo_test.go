package gdpmdb

import "testing"

func TestParseGitHubOwnerRepo(t *testing.T) {
	tests := []struct {
		in    string
		owner string
		repo  string
	}{
		{"github.com/aviorstudio/revik", "aviorstudio", "revik"},
		{"https://github.com/aviorstudio/revik", "aviorstudio", "revik"},
		{"https://github.com/aviorstudio/revik.git", "aviorstudio", "revik"},
		{"git@github.com:aviorstudio/revik.git", "aviorstudio", "revik"},
	}

	for _, tt := range tests {
		owner, repo, err := ParseGitHubOwnerRepo(tt.in)
		if err != nil {
			t.Fatalf("ParseGitHubOwnerRepo(%q) error: %v", tt.in, err)
		}
		if owner != tt.owner || repo != tt.repo {
			t.Fatalf("ParseGitHubOwnerRepo(%q) = %s/%s, want %s/%s", tt.in, owner, repo, tt.owner, tt.repo)
		}
	}
}

package gdpmdb

import "testing"

func TestSelectVersionRequested(t *testing.T) {
	rows := []versionRow{
		{Version: "0.1.0", SHA: "aaa"},
		{Version: "0.2.0", SHA: "bbb"},
	}

	got, ok := selectVersion(rows, "0.2.0")
	if !ok {
		t.Fatalf("expected ok=true")
	}
	if got.SHA != "bbb" {
		t.Fatalf("expected sha=bbb, got %q", got.SHA)
	}
}

func TestSelectVersionLatestSemver(t *testing.T) {
	rows := []versionRow{
		{Version: "0.1.0", SHA: "aaa"},
		{Version: "0.2.0", SHA: "bbb"},
		{Version: "0.10.0", SHA: "ccc"},
	}

	got, ok := selectVersion(rows, "")
	if !ok {
		t.Fatalf("expected ok=true")
	}
	if got.SHA != "ccc" {
		t.Fatalf("expected sha=ccc, got %q", got.SHA)
	}
}

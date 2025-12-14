export const toRepoUrl = (value: string) => {
  const repo = value.trim();
  if (!repo) return '';

  if (/^https?:\/\//i.test(repo)) {
    try {
      const url = new URL(repo);
      const normalizedPath = url.pathname.replace(/\/+$/, '').replace(/\.git$/i, '');
      return `${url.origin}${normalizedPath}`;
    } catch {
      return repo;
    }
  }

  const gitSshMatch = repo.match(/^git@([^:]+):(.+)$/i);
  if (gitSshMatch) {
    const host = gitSshMatch[1];
    const path = gitSshMatch[2].replace(/\.git$/i, '').replace(/^\/+/, '').replace(/\/+$/, '');
    return path ? `https://${host}/${path}` : `https://${host}`;
  }

  const sanitized = repo.replace(/^\/+/, '').replace(/\/+$/, '').replace(/\.git$/i, '');
  return sanitized ? `https://${sanitized}` : '';
};

export const toGitHubTreeUrl = (repoUrl: string, sha: string) => {
  const repo = repoUrl.trim();
  const commitSha = sha.trim();
  if (!repo || !commitSha) return '';

  let url: URL;
  try {
    url = new URL(repo);
  } catch {
    return '';
  }

  const hostname = url.hostname.toLowerCase();
  if (!hostname.endsWith('github.com')) return '';

  const repoPath = url.pathname.replace(/\/+$/, '').replace(/\.git$/i, '');
  if (!repoPath || repoPath === '/') return '';

  return `${url.origin}${repoPath}/tree/${encodeURIComponent(commitSha)}`;
};

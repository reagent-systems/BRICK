export type CommitTile = {
	sha: string;
	shaShort: string;
	message: string;
	dateIso: string;
	dateDisplay: string;
	author: string;
	url: string;
};

type GitHubCommitApi = {
	sha: string;
	html_url: string;
	commit: {
		message: string;
		author: { name: string; date: string } | null;
		committer: { name: string; date: string } | null;
	};
};

export function getGithubRepoParts(): { owner: string; repo: string; full: string } {
	const raw =
		(import.meta.env.PUBLIC_GITHUB_REPO as string | undefined)?.trim() || 'reagent-systems/BRICK';
	const parts = raw.split('/');
	const owner = parts[0] || 'reagent-systems';
	const repo = parts[1] || 'BRICK';
	return { owner, repo, full: `${owner}/${repo}` };
}

export function commitsUrl(): string {
	const { owner, repo } = getGithubRepoParts();
	return `https://github.com/${owner}/${repo}/commits`;
}

function firstLine(message: string): string {
	const line = message.split('\n')[0]?.trim();
	return line || message.trim() || '(no message)';
}

export async function fetchRecentCommits(perPage = 24): Promise<CommitTile[]> {
	const { owner, repo } = getGithubRepoParts();
	const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?per_page=${perPage}`;

	const res = await fetch(url, {
		headers: {
			Accept: 'application/vnd.github+json',
			'X-GitHub-Api-Version': '2022-11-28'
		}
	});

	if (!res.ok) {
		const err = await res.text();
		throw new Error(res.status === 403 ? 'GitHub rate limit — try again soon.' : `GitHub ${res.status}: ${err.slice(0, 120)}`);
	}

	const data = (await res.json()) as GitHubCommitApi[];

	return data.map((item) => {
		const dateRaw = item.commit.committer?.date || item.commit.author?.date || '';
		const d = dateRaw ? new Date(dateRaw) : null;
		const dateDisplay = d
			? d.toLocaleDateString(undefined, {
					weekday: 'short',
					year: 'numeric',
					month: 'short',
					day: 'numeric'
				})
			: '—';

		return {
			sha: item.sha,
			shaShort: item.sha.slice(0, 7),
			message: firstLine(item.commit.message),
			dateIso: dateRaw,
			dateDisplay,
			author: item.commit.author?.name || item.commit.committer?.name || '—',
			url: item.html_url
		};
	});
}

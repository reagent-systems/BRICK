<script lang="ts">
	import { onMount } from 'svelte';
	import { fetchRecentCommits, commitsUrl, type CommitTile } from './githubCommits';

	let commits = $state<CommitTile[]>([]);
	let loadError = $state<string | null>(null);
	let loading = $state(true);
	let marquee: HTMLDivElement | undefined = $state(undefined);
	let paused = $state(false);

	onMount(() => {
		let cancelled = false;

		(async () => {
			try {
				const list = await fetchRecentCommits(28);
				if (!cancelled) commits = list;
			} catch (e) {
				if (!cancelled) loadError = e instanceof Error ? e.message : 'Could not load commits.';
			} finally {
				if (!cancelled) loading = false;
			}
		})();

		return () => {
			cancelled = true;
		};
	});

	$effect(() => {
		const el = marquee;
		if (!el || commits.length === 0) return;

		const applyDuration = () => {
			const halfPx = el.scrollWidth / 2;
			const pxPerSec = 44;
			const sec = Math.max(22, Math.min(100, halfPx / pxPerSec));
			el.style.setProperty('--marquee-seconds', `${sec}s`);
		};

		applyDuration();
		const ro = new ResizeObserver(applyDuration);
		ro.observe(el);
		return () => ro.disconnect();
	});
</script>

{#snippet commitTile(c: CommitTile)}
	<a class="commit-carousel__tile" href={c.url} rel="noopener noreferrer">
		<time class="commit-carousel__date" datetime={c.dateIso}>{c.dateDisplay}</time>
		<p class="commit-carousel__msg">{c.message}</p>
		<div class="commit-carousel__meta">
			<span class="commit-carousel__author">{c.author}</span>
			<span class="commit-carousel__sha">{c.shaShort}</span>
		</div>
	</a>
{/snippet}

<div class="commit-carousel" aria-busy={loading}>
	{#if loading}
		<div class="commit-carousel__viewport commit-carousel__viewport--placeholder" aria-hidden="true">
			<div class="commit-carousel__marquee commit-carousel__marquee--placeholder">
				{#each [1, 2, 3, 4, 5, 6] as i (i)}
					<div class="commit-carousel__tile commit-carousel__tile--skeleton"></div>
				{/each}
			</div>
		</div>
	{:else if loadError}
		<p class="commit-carousel__error">{loadError}</p>
		<p class="commit-carousel__fallback">
			<a href={commitsUrl()} class="commit-carousel__link" rel="noopener noreferrer">View commits on GitHub</a>
		</p>
	{:else if commits.length === 0}
		<p class="commit-carousel__error">No commits found.</p>
	{:else}
		<div
			class="commit-carousel__viewport"
			role="region"
			aria-label="Recent GitHub commits, auto-scrolling. Hover to pause."
			onpointerenter={() => (paused = true)}
			onpointerleave={() => (paused = false)}
		>
			<div
				class="commit-carousel__marquee"
				class:commit-carousel__marquee--paused={paused}
				bind:this={marquee}
			>
				{#each commits as c (c.sha)}
					{@render commitTile(c)}
				{/each}
				{#each commits as c (`dup-${c.sha}`)}
					{@render commitTile(c)}
				{/each}
			</div>
		</div>
	{/if}
</div>

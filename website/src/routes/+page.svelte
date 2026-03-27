<script lang="ts">
	import { onMount } from 'svelte';
	import LogoMark from '$lib/LogoMark.svelte';
	import { getReleaseDownloads } from '$lib/githubReleaseDownloads';
	import { commitsUrl } from '$lib/githubCommits';
	import { detectDownloadPlatform, type DownloadPlatform } from '$lib/detectDownloadPlatform';
	import GitHubCommitCarousel from '$lib/GitHubCommitCarousel.svelte';

	const CONTACT_EMAIL = 'brick@reagent-systems.com';

	const dl = getReleaseDownloads();

	const mailtoContact = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('BRICK — Contact')}&body=${encodeURIComponent(
		'Hi BRICK team,\n\n'
	)}`;

	const mcpConfigJson = `{
  "mcpServers": {
    "brick": {
      "url": "http://127.0.0.1:3777/sse"
    }
  }
}`;

	const ruleSnippet =
		'After meaningful code or product changes, call log_progress on the BRICK MCP server with a short dev update (under 120 characters) so drafting and context stay in sync with your repo.';

	let copyToastVisible = $state(false);
	let navOpen = $state(false);

	function closeNav() {
		navOpen = false;
	}

	function toggleNav() {
		navOpen = !navOpen;
	}

	$effect(() => {
		if (typeof window === 'undefined' || typeof document === 'undefined') return;
		const mq = window.matchMedia('(max-width: 767px)');
		const syncBodyScroll = () => {
			if (navOpen && mq.matches) {
				document.body.style.overflow = 'hidden';
			} else {
				document.body.style.overflow = '';
			}
		};
		syncBodyScroll();
		mq.addEventListener('change', syncBodyScroll);
		return () => {
			mq.removeEventListener('change', syncBodyScroll);
			document.body.style.overflow = '';
		};
	});

	$effect(() => {
		if (!navOpen || typeof window === 'undefined') return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') closeNav();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});

	let downloadPlatform = $state<DownloadPlatform | null>(null);

	onMount(() => {
		downloadPlatform = detectDownloadPlatform();
	});

	function downloadBtnClass(match: boolean): string {
		if (downloadPlatform === null) {
			return 'btn btn--ghost btn--block';
		}
		return match ? 'btn btn--primary btn--block' : 'btn btn--ghost btn--block';
	}

	let macDownloadHref = $derived(downloadPlatform === 'mac-intel' ? dl.macIntel : dl.mac);
	let macDownloadMatch = $derived(
		downloadPlatform === 'mac-arm' || downloadPlatform === 'mac-intel'
	);

	async function copyText(text: string) {
		try {
			await navigator.clipboard.writeText(text);
			copyToastVisible = true;
			setTimeout(() => {
				copyToastVisible = false;
			}, 2200);
		} catch {
			copyToastVisible = false;
		}
	}

</script>

<svelte:head>
	<title>BRICK — Download</title>
	<meta
		name="description"
		content="BRICK connects MCP, git, folder watching, and social feedback into one production workflow. Desktop & mobile. By Reagent Systems."
	/>
</svelte:head>

<div id="top" class="page-root">
	<header class="site-header">
		<a class="site-mark" href="#top" data-sveltekit-noscroll onclick={closeNav}>
			<span class="site-mark__icon">
				<LogoMark variant="nav" />
			</span>
			<span class="site-mark__word">BRICK</span>
		</a>
		<button
			type="button"
			class="site-header__menu-btn"
			aria-expanded={navOpen}
			aria-controls="primary-nav"
			aria-label={navOpen ? 'Close menu' : 'Open menu'}
			onclick={toggleNav}
		>
			<span class="site-header__menu-icon" aria-hidden="true">
				<span></span>
				<span></span>
				<span></span>
			</span>
		</button>
		<div
			class="site-nav-backdrop"
			class:site-nav-backdrop--visible={navOpen}
			onclick={closeNav}
			aria-hidden="true"
		></div>
		<nav
			id="primary-nav"
			class="site-nav"
			class:site-nav--open={navOpen}
			aria-label="Primary"
		>
			<a href="#use-cases" onclick={closeNav}>Use cases</a>
			<a href="#connect" onclick={closeNav}>Connect</a>
			<a href="#inbox" onclick={closeNav}>Inbox</a>
			<a href="#activity" onclick={closeNav}>Activity</a>
			<a href="#contact" onclick={closeNav}>Contact</a>
			<a href="#download" onclick={closeNav}>Download</a>
		</nav>
	</header>

	<section class="hero" aria-labelledby="hero-title">
		<div class="hero__split">
			<div class="hero__intro">
				<div class="hero__intro-inner">
					<div class="hero__brand">
						<div class="hero__frame" aria-hidden="true"></div>
						<div class="hero__logo" aria-hidden="true">
							<LogoMark variant="hero" />
						</div>
						<h1 id="hero-title">BRICK</h1>
						<div class="hero__rule" aria-hidden="true"></div>
						<p class="hero__tagline">Code. Share. Listen.</p>
					</div>
					<div class="hero__actions">
						<a class="btn btn--primary" href="#download">Get the app</a>
						<a class="btn btn--done" href={mailtoContact}>Contact</a>
					</div>
				</div>
			</div>

			<section id="activity" class="section section--commit-feed hero__activity" aria-labelledby="activity-title">
				<div class="section__head">
					<div>
						<p class="section__label">GitHub</p>
						<h2 id="activity-title" class="section__title">
							Recent commits
							<span aria-hidden="true"></span>
						</h2>
					</div>
					<a class="btn btn--ghost" href={commitsUrl()} rel="noopener noreferrer">View all</a>
				</div>
				<GitHubCommitCarousel />
			</section>

			<div id="use-cases" class="hero__workflow" aria-labelledby="use-cases-title">
				<p class="section__label hero__workflow-label">Use cases</p>
				<h2 id="use-cases-title" class="hero__workflow-title">
					Code. Share. Listen.
					<span aria-hidden="true"></span>
				</h2>
				<div class="feature-grid feature-grid--hero-col">
					<article class="feature-card feature-card--use-case">
						<p class="use-case__pillar">Code</p>
						<h3>Build signal you can ship from</h3>
						<p>
							Git, live folder watches, and your MCP-connected agent feed BRICK what changed and why—so drafts and
							summaries track the work you actually did, not a hand-wavy recap.
						</p>
					</article>
					<article class="feature-card feature-card--use-case">
						<p class="use-case__pillar">Share</p>
						<h3>Talk about the work in your voice</h3>
						<p>
							Turn that context into posts for X, Reddit, and other channels—written in the tone you calibrate in
							the app, so shipping updates sound like you, not a generic blurb.
						</p>
					</article>
					<article class="feature-card feature-card--use-case">
						<p class="use-case__pillar">Listen</p>
						<h3>Hear everyone in one inbox</h3>
						<p>
							Questions, bugs, requests, and praise from across platforms land in a single monospace inbox—tagged,
							filtered, and hard to ignore when it’s time to reply.
						</p>
					</article>
				</div>
			</div>
		</div>
	</section>

	<section id="connect" class="section" aria-labelledby="connect-title">
		<div class="section__head">
			<div>
				<p class="section__label">Developer setup</p>
				<h2 id="connect-title" class="section__title">
					Wire your coding agent
					<span aria-hidden="true"></span>
				</h2>
			</div>
		</div>

		<div class="panel">
			<div class="panel__head">
				<h3 class="panel__title">Connection config</h3>
				<button type="button" class="btn btn--ghost btn--icon" onclick={() => copyText(mcpConfigJson)}>
					Copy
				</button>
			</div>
			<div class="panel__body">
				<pre class="pre-block" aria-label="Example MCP JSON">{mcpConfigJson.trim()}</pre>
			</div>
			<p class="panel__footer-note">
				Add to ~/.cursor/mcp.json or &lt;project-root&gt;/.cursor/mcp.json · adjust host/port to match your BRICK
				instance
			</p>
		</div>

		<div class="panel">
			<div class="panel__head">
				<h3 class="panel__title">Rule / instruction</h3>
				<button type="button" class="btn btn--ghost btn--icon" onclick={() => copyText(ruleSnippet)}>
					Copy
				</button>
			</div>
			<div class="panel__body">
				<p class="rule-box">{ruleSnippet}</p>
			</div>
			<p class="panel__footer-note">Add to .cursorrules, Cursor Rules, or your agent’s instruction file</p>
		</div>
	</section>

	<section id="inbox" class="section" aria-labelledby="inbox-title">
		<div class="section__head">
			<div>
				<p class="section__label">Feedback</p>
				<h2 id="inbox-title" class="section__title">
					One inbox for the noise
					<span aria-hidden="true"></span>
				</h2>
			</div>
		</div>

		<p class="download-card__hint" style="margin-bottom: 1rem;">
			Filter questions, bugs, requests, and positive signal — same brutal focus as the app’s FEEDBACK tab.
		</p>

		<div class="feedback-demo">
			<div class="feedback-demo__header">
				<span>Feedback</span>
				<span style="color: var(--df-orange); font-size: 0.5rem;" aria-hidden="true">●</span>
			</div>
			<div class="feedback-demo__tabs" role="tablist">
				<button type="button" class="is-active" role="tab" aria-selected="true">ALLs</button>
				<button type="button" role="tab" aria-selected="false">QUESTIONs</button>
				<button type="button" role="tab" aria-selected="false">BUGs</button>
				<button type="button" role="tab" aria-selected="false">REQUESTs</button>
				<button type="button" role="tab" aria-selected="false">POSITIVEs</button>
			</div>
			<article class="feedback-item">
				<div class="feedback-item__top">
					<span class="feedback-item__user">@builder_ops</span>
					<time class="feedback-item__time" datetime="12:13">12:13 PM</time>
				</div>
				<p class="feedback-item__body">
					Refactoring the auth flow for speed — any gotchas for OAuth refresh on mobile?
				</p>
				<div class="feedback-item__tags">
					<span class="tag tag--neutral">General</span>
				</div>
			</article>
			<article class="feedback-item">
				<div class="feedback-item__top">
					<span class="feedback-item__user">@ship_daily</span>
					<time class="feedback-item__time" datetime="08:41">08:41 PM</time>
				</div>
				<p class="feedback-item__body">
					Loving the MCP integration — first time our changelog draft matched what we actually shipped.
				</p>
				<div class="feedback-item__tags">
					<span class="tag tag--positive">Positive</span>
				</div>
			</article>
			<article class="feedback-item">
				<div class="feedback-item__top">
					<span class="feedback-item__user">@qa_nightowl</span>
					<time class="feedback-item__time" datetime="07:12">07:12 PM</time>
				</div>
				<p class="feedback-item__body">
					Crash after linking second workspace — reproducible on cold start. @Reagent_Systems
				</p>
				<div class="feedback-item__tags">
					<span class="tag tag--bug">Bug</span>
				</div>
			</article>
		</div>
	</section>

	<section id="download" class="section" aria-labelledby="download-title">
		<div class="section__head">
			<div>
				<p class="section__label">Install</p>
				<h2 id="download-title" class="section__title">
					Download BRICK
					<span aria-hidden="true"></span>
				</h2>
			</div>
		</div>
		<div class="download-grid">
			<div class="download-card">
				<p class="download-card__platform">macOS</p>
				<p class="download-card__hint">Latest DMG for Mac.</p>
				<a class={downloadBtnClass(macDownloadMatch)} href={macDownloadHref} rel="noopener noreferrer"
					>Download for Mac</a
				>
				<p class="download-card__alt">
					<a href={dl.releasesIndex} rel="noopener noreferrer">View all releases</a>
				</p>
			</div>
			<div class="download-card">
				<p class="download-card__platform">Windows</p>
				<p class="download-card__hint">Latest Windows installer (.exe).</p>
				<a class={downloadBtnClass(downloadPlatform === 'windows')} href={dl.win} rel="noopener noreferrer"
					>Download for Windows</a
				>
				<p class="download-card__alt">
					<a href={dl.releasesIndex} rel="noopener noreferrer">View all releases</a>
				</p>
			</div>
			<div class="download-card">
				<p class="download-card__platform">iOS</p>
				<p class="download-card__hint">Latest IPA for iOS.</p>
				<a class={downloadBtnClass(downloadPlatform === 'ios')} href={dl.ios} rel="noopener noreferrer"
					>Download for iOS</a
				>
				<p class="download-card__alt">
					<a href={dl.releasesIndex} rel="noopener noreferrer">View all releases</a>
				</p>
			</div>
			<div class="download-card">
				<p class="download-card__platform">Android</p>
				<p class="download-card__hint">Latest APK for Android.</p>
				<a class={downloadBtnClass(downloadPlatform === 'android')} href={dl.android} rel="noopener noreferrer"
					>Download for Android</a
				>
				<p class="download-card__alt">
					<a href={dl.releasesIndex} rel="noopener noreferrer">View all releases</a>
				</p>
			</div>
		</div>
	</section>

	<footer class="site-footer">
		<section id="contact" class="site-footer__contact" aria-labelledby="contact-title">
			<div class="cta-band cta-band--footer">
				<h2 id="contact-title">Need Help?</h2>
				<div class="cta-band__actions">
					<a class="btn btn--done btn--block" href={mailtoContact}>Contact us</a>
				</div>
				<p class="site-footer__email">{CONTACT_EMAIL}</p>
			</div>
		</section>
		<div class="footer-legal">
			<p>
				© {new Date().getFullYear()}
				<strong>BRICK</strong>
				· Reagent Systems · Desktop & mobile
			</p>
		</div>
	</footer>
</div>

<div class="copy-toast" class:is-visible={copyToastVisible} role="status" aria-live="polite">
	Copied to clipboard
</div>

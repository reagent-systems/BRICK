/**
 * Resolves download URLs from GitHub Releases (latest).
 * Default asset names match electron-builder output for productName "BRICK".
 *
 * Bump PUBLIC_BRICK_RELEASE_VERSION on Vercel (or .env) when you tag a new release,
 * or override any URL with PUBLIC_DOWNLOAD_*.
 */
export function getReleaseDownloads() {
	const version =
		(import.meta.env.PUBLIC_BRICK_RELEASE_VERSION as string | undefined)?.trim() || '0.1.0';
	const repo =
		(import.meta.env.PUBLIC_GITHUB_REPO as string | undefined)?.trim() || 'reagent-systems/BRICK';
	const parts = repo.split('/');
	const owner = parts[0] || 'reagent-systems';
	const repoName = parts[1] || 'BRICK';

	const base = `https://github.com/${owner}/${repoName}/releases/latest/download`;
	const asset = (filename: string) => `${base}/${encodeURIComponent(filename)}`;

	const macArmDmg = `BRICK-${version}-arm64.dmg`;
	const macXDmg = `BRICK-${version}-x64.dmg`;
	const winNsis = `BRICK Setup ${version}.exe`;
	const iosIpa = `BRICK-${version}.ipa`;
	const androidApk = `BRICK-${version}.apk`;

	return {
		/** All tagged releases with versioned assets */
		releasesIndex: `https://github.com/${owner}/${repoName}/releases`,
		/** Latest release landing page (single version) */
		releasesLatest: `https://github.com/${owner}/${repoName}/releases/latest`,
		mac:
			(import.meta.env.PUBLIC_DOWNLOAD_MAC_URL as string | undefined)?.trim() || asset(macArmDmg),
		macIntel:
			(import.meta.env.PUBLIC_DOWNLOAD_MAC_X64_URL as string | undefined)?.trim() || asset(macXDmg),
		win:
			(import.meta.env.PUBLIC_DOWNLOAD_WIN_URL as string | undefined)?.trim() || asset(winNsis),
		ios:
			(import.meta.env.PUBLIC_DOWNLOAD_IOS_URL as string | undefined)?.trim() || asset(iosIpa),
		android:
			(import.meta.env.PUBLIC_DOWNLOAD_ANDROID_URL as string | undefined)?.trim() ||
			asset(androidApk)
	};
}

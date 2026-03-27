export type DownloadPlatform = 'mac-arm' | 'mac-intel' | 'windows' | 'ios' | 'android';

/**
 * Best-effort UA sniff for the download grid. Returns null for unknown (e.g. Linux).
 */
export function detectDownloadPlatform(): DownloadPlatform | null {
	if (typeof navigator === 'undefined') return null;

	const ua = navigator.userAgent;

	if (/iPhone|iPod/i.test(ua)) return 'ios';

	const iPad =
		/iPad/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
	if (iPad) return 'ios';

	if (/Android/i.test(ua)) return 'android';

	if (/Windows|Win32|Win64|WOW64/i.test(ua)) return 'windows';

	if (/Macintosh|Mac OS X/i.test(ua)) {
		if (/Intel Mac OS X/i.test(ua)) return 'mac-intel';
		return 'mac-arm';
	}

	return null;
}

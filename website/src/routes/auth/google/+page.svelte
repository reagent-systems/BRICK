<script lang="ts">
	import { onMount } from 'svelte';

	let status = $state('Starting Google sign-in...');

	function randomString(length = 40): string {
		const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
		const bytes = new Uint8Array(length);
		crypto.getRandomValues(bytes);
		let value = '';
		for (let i = 0; i < length; i += 1) value += chars[bytes[i] % chars.length];
		return value;
	}

	function toDesktopCallback(params: URLSearchParams, useHash = false) {
		const deepLink = new URL('brick://auth/google/callback');
		if (useHash) {
			const hash = params.toString();
			window.location.replace(`${deepLink.toString()}#${hash}`);
			return;
		}
		deepLink.search = params.toString();
		window.location.replace(deepLink.toString());
	}

	onMount(() => {
		const query = new URLSearchParams(window.location.search);
		const hash = new URLSearchParams(window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '');

		// If Google returned tokens on this URL, hand them to the desktop app.
		if (hash.has('id_token') || hash.has('access_token') || hash.has('error')) {
			const callbackParams = new URLSearchParams();
			const fields = ['id_token', 'access_token', 'token_type', 'expires_in', 'scope', 'state', 'error'];
			for (const field of fields) {
				const value = hash.get(field);
				if (value) callbackParams.set(field, value);
			}
			status = callbackParams.get('error')
				? 'Google sign-in failed, returning to BRICK...'
				: 'Google sign-in complete, returning to BRICK...';
			toDesktopCallback(callbackParams, true);
			return;
		}

		const clientId = query.get('client_id') || '';
		const state = query.get('state') || randomString();
		const scope = query.get('scope') || 'openid email profile';
		const prompt = query.get('prompt') || 'select_account';

		if (!clientId) {
			status = 'Missing client ID. Re-open Google sign-in from the BRICK app.';
			return;
		}

		const nonce = randomString();
		const googleUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
		googleUrl.searchParams.set('client_id', clientId);
		googleUrl.searchParams.set('redirect_uri', window.location.origin + window.location.pathname);
		googleUrl.searchParams.set('response_type', 'id_token token');
		googleUrl.searchParams.set('scope', scope);
		googleUrl.searchParams.set('state', state);
		googleUrl.searchParams.set('nonce', nonce);
		googleUrl.searchParams.set('prompt', prompt);

		window.location.replace(googleUrl.toString());
	});
</script>

<svelte:head>
	<title>BRICK — Google Sign In</title>
</svelte:head>

<main style="min-height: 100vh; display: grid; place-items: center; background: #0a0a0a; color: #f8f8f2;">
	<p style="font-family: 'JetBrains Mono', monospace; font-size: 0.9rem;">{status}</p>
</main>

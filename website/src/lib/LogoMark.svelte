<script lang="ts">
	/** Matches the universal BRICK mark: orange square with black center cutout. */
	let { variant = 'nav' as 'nav' | 'hero' }: { variant?: 'nav' | 'hero' } = $props();
</script>

<svg
	class="logo-mark"
	class:logo-mark--hero={variant === 'hero'}
	class:logo-mark--nav={variant === 'nav'}
	width={variant === 'hero' ? '100%' : 28}
	height={variant === 'hero' ? '100%' : 28}
	viewBox="0 0 24 24"
	aria-hidden="true"
	focusable="false"
>
	<rect x="2" y="2" width="20" height="20" fill="var(--brick-logo-orange)" />
	<rect x="8" y="8" width="8" height="8" fill="var(--df-black)" />
</svg>

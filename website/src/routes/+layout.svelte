<script lang="ts">
	import type { Snippet } from 'svelte';
	import '../app.css';

	let { children }: { children: Snippet } = $props();
</script>

<div class="landing">
	<div class="landing__watermark" aria-hidden="true">
		<span>BRICK</span>
	</div>
	<div class="landing__inner">
		{@render children()}
	</div>
</div>

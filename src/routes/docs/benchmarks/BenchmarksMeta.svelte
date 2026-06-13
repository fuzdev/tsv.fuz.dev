<script lang="ts">
	import type {BenchmarkBaseline} from './benchmark_data.js';

	const {
		baseline,
	}: {
		baseline: BenchmarkBaseline;
	} = $props();

	const formatted_date = $derived(
		new Date(baseline.timestamp).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
		}),
	);
</script>

<div class="meta">
	<div class="meta-section">
		<h4 class="mt_0 mb_sm">corpus</h4>
		<ul>
			{#each Object.entries(baseline.corpus) as [lang, count] (lang)}
				<li>{lang}: {count} file{count !== 1 ? 's' : ''}</li>
			{/each}
		</ul>
	</div>
	<div class="meta-section">
		<h4 class="mt_0 mb_sm">versions</h4>
		<ul>
			<li>svelte {baseline.versions.svelte}</li>
			<li>acorn {baseline.versions.acorn}</li>
			<li>acorn-typescript {baseline.versions.acorn_ts}</li>
			<li>prettier {baseline.versions.prettier}</li>
			<li>prettier-plugin-svelte {baseline.versions.prettier_svelte}</li>
			<li>oxc-parser {baseline.versions.oxc_parser}</li>
			<li>oxfmt {baseline.versions.oxfmt}</li>
			<li>biome {baseline.versions.biome}</li>
		</ul>
	</div>
	<div class="meta-section">
		<h4 class="mt_0 mb_sm">run</h4>
		<ul>
			<li>{formatted_date}</li>
			<li>
				<code>{baseline.git_commit}</code>
			</li>
		</ul>
	</div>
</div>

<style>
	.meta {
		display: flex;
		gap: var(--space_xl);
		flex-wrap: wrap;
		font-size: var(--font_size_sm);
		opacity: 0.7;
	}
	ul {
		list-style: none;
		padding: 0;
		margin: 0;
	}
</style>

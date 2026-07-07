<script lang="ts">
	import {site_context} from '@fuzdev/fuz_ui/site.svelte.ts';

	import {type BenchmarkBaseline, derive_corpus_repos} from './benchmark_data.ts';

	const {
		baseline,
	}: {
		baseline: BenchmarkBaseline;
	} = $props();

	const site = site_context.get();

	const corpus_repos = $derived(derive_corpus_repos(baseline.corpus_sources));

	const formatted_date = $derived(
		new Date(baseline.timestamp).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
		}),
	);

	// GitHub resolves abbreviated SHAs, so the short `git_commit` links directly.
	const commit_url = $derived(`${site.repo_url}/commit/${baseline.git_commit}`);
</script>

<div class="meta">
	<div class="meta-section">
		<h4 class="mt_0 mb_sm">corpus stats</h4>
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
			{#if baseline.versions.oxc_parser}
				<li>oxc-parser {baseline.versions.oxc_parser}</li>
			{/if}
			{#if baseline.versions.oxfmt}
				<li>oxfmt {baseline.versions.oxfmt}</li>
			{/if}
			{#if baseline.versions.biome}
				<li>biome {baseline.versions.biome}</li>
			{/if}
		</ul>
	</div>
	<div class="meta-section">
		<h4 class="mt_0 mb_sm">run</h4>
		<ul>
			<li>{formatted_date}</li>
			{#if baseline.runtime}
				<li>runtime: {baseline.runtime}</li>
			{/if}
			{#if baseline.versions.tsv}
				<li>tsv {baseline.versions.tsv}</li>
			{/if}
			<li>
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
				<a href={commit_url}>{baseline.git_commit}</a>
			</li>
		</ul>
	</div>
	{#if baseline.machine}
		<div class="meta-section">
			<h4 class="mt_0 mb_sm">environment</h4>
			<ul>
				<li>{baseline.machine.cpu_model}</li>
				<li>{baseline.machine.os}/{baseline.machine.arch}</li>
				{#if baseline.runtime}
					<li>{baseline.runtime} {baseline.machine.runtime_version}</li>
				{:else}
					<li>{baseline.machine.runtime_version}</li>
				{/if}
			</ul>
		</div>
	{/if}
	{#if corpus_repos.length}
		<div class="meta-section corpus-repos">
			<h4 class="mt_0 mb_sm">corpus repos</h4>
			<ul class="repos">
				{#each corpus_repos as repo (repo.url)}
					<li>
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
						<a href={repo.url}>{repo.label}</a>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
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
	/* the repos list spans its own row below the compact stat columns and wraps horizontally */
	.corpus-repos {
		flex-basis: 100%;
	}
	.repos {
		display: flex;
		flex-wrap: wrap;
		column-gap: var(--space_lg);
		row-gap: var(--space_xs);
	}
</style>

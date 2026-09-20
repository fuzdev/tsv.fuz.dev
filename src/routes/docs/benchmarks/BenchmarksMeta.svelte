<script lang="ts">
	import { site_context } from '@fuzdev/fuz_ui/site.svelte.ts';

	import {
		type BenchmarkBaseline,
		corpus_repo_ref_url,
		derive_corpus_repos
	} from './benchmark_data.ts';
	import { format_count, format_version_label } from './benchmark_display.ts';

	const {
		baseline
	}: {
		baseline: BenchmarkBaseline;
	} = $props();

	const site = site_context.get();

	const corpus_repos = $derived(derive_corpus_repos(baseline.corpus_sources));

	// every tool version the report carries, in report order, so a tool added
	// upstream appears without a site edit — tsv itself renders under "run"
	const versions = $derived(Object.entries(baseline.versions).filter(([key]) => key !== 'tsv'));

	const formatted_date = $derived(
		new Date(baseline.timestamp).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			// prerendered: pin the zone so the build box's doesn't pick the day
			timeZone: 'UTC'
		})
	);

	// GitHub resolves abbreviated SHAs, so the short `git_commit` links directly.
	const commit_url = $derived(`${site.repo_url}/commit/${baseline.git_commit}`);
</script>

<div class="meta">
	<div>
		<h4 class="mt_0 mb_sm">corpus stats</h4>
		<ul class="unstyled">
			{#each Object.entries(baseline.corpus) as [lang, count] (lang)}
				<li>{lang}: {format_count(count)} file{count !== 1 ? 's' : ''}</li>
			{/each}
		</ul>
	</div>
	<div>
		<h4 class="mt_0 mb_sm">versions</h4>
		<ul class="unstyled">
			{#each versions as [key, version] (key)}
				<li>{format_version_label(key)} {version}</li>
			{/each}
		</ul>
	</div>
	<div>
		<h4 class="mt_0 mb_sm">run</h4>
		<ul class="unstyled">
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
		<div>
			<h4 class="mt_0 mb_sm">environment</h4>
			<ul class="unstyled">
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
		<div class="corpus-repos">
			<h4 class="mt_0 mb_sm">corpus repos</h4>
			{#if baseline.corpus_snapshot}
				<p class="mt_0 mb_sm">
					snapshot
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
					<a href={corpus_repo_ref_url(baseline.corpus_snapshot)}>
						{baseline.corpus_snapshot.slug}@{baseline.corpus_snapshot.commit.slice(0, 9)}
					</a>
				</p>
			{/if}
			<ul class="unstyled repos">
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

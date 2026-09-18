<script lang="ts">
	import type { BaselineRow } from './benchmark_baseline.ts';
	import type { BenchmarkGroup } from './benchmark_data.ts';
	import { format_count, format_language, format_ns } from './benchmark_display.ts';
	import BenchmarksBaselineGroup from './BenchmarksBaselineGroup.svelte';

	const {
		group,
		corpus
	}: {
		group: BenchmarkGroup;
		corpus: Record<string, number>;
	} = $props();

	const total = $derived(corpus[group.language] ?? 0);
	// the count of files actually benchmarked (`files_iterated`), falling back to the
	// corpus total on older baselines (< version 4)
	const count_label = $derived(format_count(group.files_iterated ?? total));

	// a coverage-only row's accept rate is its entire measurement, so it renders as
	// the row's annotation; siblings get an empty one so the grid's column template
	// stays uniform across the group (same trick as BenchmarksSizes' gzip fallback)
	const has_coverage_only = $derived(group.entries.some((e) => e.coverage_only));

	const rows: Array<BaselineRow> = $derived(
		group.entries.map((e) => ({
			key: e.name,
			label: e.name,
			category: e.category,
			bar_fraction: e.bar_fraction,
			// the whole-sweep mean — total time to process the group's iterated corpus
			// once, which is also what the ratios derive from via `raw`
			value: format_ns(e.mean_ns),
			raw: e.mean_ns,
			annotation: has_coverage_only
				? e.coverage_only && e.files_processed != null && e.files_total != null
					? `${format_count(e.files_processed)}/${format_count(e.files_total)} files`
					: ''
				: undefined,
			disabled: e.disabled ?? false,
			coverage_only: e.coverage_only ?? false
		}))
	);
</script>

<div class="mb_xl5">
	<p class="row justify-content:space-between">
		<span>
			{group.operation === 'format' ? 'Formatting' : 'Parsing'}
			{count_label}
			{format_language(group.language)} files
		</span>
		<span class="text_40">total time &nbsp;&middot;&nbsp; speed</span>
	</p>
	<BenchmarksBaselineGroup
		{rows}
		direction="speed"
		label="{group.operation === 'format' ? 'Format' : 'Parse'} {format_language(group.language)}"
	/>
</div>

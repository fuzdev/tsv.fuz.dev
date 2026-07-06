<script lang="ts">
	import {
		format_coverage,
		format_ns,
		type BaselineRow,
		type BenchmarkGroup,
	} from './benchmark_data.ts';
	import BenchmarksBaselineGroup from './BenchmarksBaselineGroup.svelte';

	const {
		group,
		corpus,
	}: {
		group: BenchmarkGroup;
		corpus: Record<string, number>;
	} = $props();

	// coverage annotations only appear on baselines that carry them (version 3+)
	const has_coverage = $derived(group.entries.some((e) => e.files_total != null));

	const total = $derived(corpus[group.language] ?? 0);
	// the timed benchmark runs on the per-group intersection (`files_iterated`), a
	// subset of the discovered corpus; show "<timed> of <total>" when we have it,
	// falling back to the corpus total on older baselines (< version 4)
	const count_label = $derived(
		group.files_iterated != null
			? `${group.files_iterated.toLocaleString('en-US')} of ${total.toLocaleString('en-US')}`
			: total.toLocaleString('en-US'),
	);

	const rows: Array<BaselineRow> = $derived(
		group.entries.map((e) => ({
			key: e.name,
			label: e.name,
			category: e.category,
			bar_fraction: e.bar_fraction,
			// per-file mean when the baseline carries it (version 4+), falling back to
			// the whole-sweep mean; ratios stay on the sweep mean via `raw`
			value: format_ns(e.mean_per_file_ns ?? e.mean_ns),
			raw: e.mean_ns,
			annotation: e.disabled
				? has_coverage
					? 'n/a'
					: undefined
				: format_coverage(e.files_processed, e.files_total),
			disabled: e.disabled ?? false,
		})),
	);
</script>

<div class="mb_xl5">
	<p style:display="flex" style:justify-content="space-between">
		<span>
			{group.operation === 'format' ? 'Formatting' : 'Parsing'}
			{count_label}
			{group.language} files</span
		>
		{#if has_coverage}<span class="text_40" style:text-align="right"
				>files handled / total &nbsp;&middot;&nbsp; avg per file &nbsp;&middot;&nbsp; speed</span
			>{/if}
	</p>
	<BenchmarksBaselineGroup {rows} direction="speed" />
</div>

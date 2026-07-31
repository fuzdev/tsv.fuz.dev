<script lang="ts">
	import { format_ns, type BaselineRow, type BenchmarkGroup } from './benchmark_data.ts';
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
	const count_label = $derived((group.files_iterated ?? total).toLocaleString('en-US'));

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
			annotation: undefined,
			disabled: e.disabled ?? false,
			coverage_only: e.coverage_only ?? false
		}))
	);
</script>

<div class="mb_xl5">
	<p style:display="flex" style:justify-content="space-between">
		<span>
			{group.operation === 'format' ? 'Formatting' : 'Parsing'}
			{count_label}
			{group.language} files
		</span>
		<span class="text_40" style:text-align="right">total time &nbsp;&middot;&nbsp; speed</span>
	</p>
	<BenchmarksBaselineGroup {rows} direction="speed" />
</div>

<script lang="ts">
	import type { BaselineRow } from './benchmark_baseline.ts';
	import type { BenchmarkGroup } from './benchmark_data.ts';
	import {
		format_count,
		format_group_label,
		format_language,
		format_ns,
		format_percent
	} from './benchmark_display.ts';
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

	// every row is timed on the files ALL of them process, so a file one tool fails
	// leaves everyone's set — bytes lead, since one large file is a bigger share of
	// the work than its count suggests
	// `by_tool` counts are per row and `omitted_files` is their union, so two rows failing
	// one file sum past it — the copy says "by row" and flags the overlap when there is one
	const omitted = $derived(
		group.omissions
			? {
					is_one: group.omissions.omitted_files === 1,
					files: format_count(group.omissions.omitted_files),
					files_total: format_count(group.omissions.files_total),
					bytes_percent: format_percent(group.omissions.omitted_bytes, group.omissions.bytes_total),
					tools: group.omissions.by_tool
						.map((t) => `${t.name} ${format_count(t.files)}`)
						.join(', '),
					overlaps: group.omissions.by_tool.length > 1
				}
			: null
	);

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
	<h3>
		{group.operation === 'format' ? 'Formatting' : 'Parsing'}
		{count_label}
		{format_language(group.language)} files
	</h3>
	<BenchmarksBaselineGroup {rows} label={format_group_label(group.operation, group.language)} />
	{#if omitted}
		<p>
			<small>
				{omitted.files} of {omitted.files_total} {omitted.is_one ? 'file' : 'files'}
				({omitted.bytes_percent} of this group's bytes) left out of every row's timed set, because a
				row here fails {omitted.is_one ? 'it' : 'them'} in this harness — files failed, by
				row{omitted.overlaps ? ' (rows can overlap)' : ''}: {omitted.tools}
			</small>
		</p>
	{/if}
</div>

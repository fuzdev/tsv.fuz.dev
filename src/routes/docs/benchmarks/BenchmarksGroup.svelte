<script lang="ts">
	import {
		format_coverage,
		format_ns,
		format_speedup,
		speedup_color,
		type BenchmarkGroup,
	} from './benchmark_data.js';
	import BenchmarksBar from './BenchmarksBar.svelte';

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
		group.files_iterated != null ? `${group.files_iterated} of ${total}` : `${total}`,
	);
</script>

<div class="mb_xl5">
	<p>
		{group.operation === 'format' ? 'Formatting' : 'Parsing'}
		{count_label}
		{group.language} files:{#if has_coverage}<span class="text_40"
				>&nbsp;&middot; annotation = files handled / total</span
			>{/if}
	</p>
	<div class="column gap_xs">
		{#each group.entries as entry (entry.name)}
			<BenchmarksBar
				label={entry.name}
				bar_fraction={entry.bar_fraction}
				category={entry.category}
				value={format_ns(entry.mean_ns)}
				ratio_text={entry.speedup_vs_canonical != null
					? format_speedup(entry.speedup_vs_canonical)
					: '1.0x'}
				ratio_color={entry.speedup_vs_canonical != null
					? speedup_color(entry.speedup_vs_canonical)
					: 'var(--text_40)'}
				annotation={format_coverage(entry.files_processed, entry.files_total)}
			/>
		{/each}
	</div>
</div>

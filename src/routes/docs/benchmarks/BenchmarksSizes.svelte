<script lang="ts">
	import {
		format_bytes,
		format_gzip_size,
		size_ratio_color,
		derive_size_groups,
		type BinarySize,
	} from './benchmark_data.ts';
	import BenchmarksBar from './BenchmarksBar.svelte';

	const {
		sizes,
	}: {
		sizes: Array<BinarySize>;
	} = $props();

	// grouped by capability (full toolchain / formatter / parser) so each build
	// sits beside its closest competitor; wasm and native mix within a group,
	// distinguished by the per-entry kind badge
	const size_groups = $derived(derive_size_groups(sizes));
</script>

{#each size_groups as group (group.capability)}
	<div class="size-group">
		<h3>{group.heading}</h3>
		<div class="column gap_xs">
			{#each group.entries as s (s.label)}
				<BenchmarksBar
					label={s.label}
					badge={s.kind}
					bar_fraction={s.bar_fraction}
					category={s.category}
					value={format_bytes(s.bytes)}
					ratio_text={s.ratio_vs_tsv != null ? `${s.ratio_vs_tsv.toFixed(1)}x` : '1.0x'}
					ratio_color={s.ratio_vs_tsv != null ? size_ratio_color(s.ratio_vs_tsv) : 'var(--text_40)'}
					annotation={format_gzip_size(s.gzip_bytes)}
				/>
			{/each}
		</div>
	</div>
{/each}

<style>
	.size-group {
		margin-bottom: var(--space_lg);
	}
</style>

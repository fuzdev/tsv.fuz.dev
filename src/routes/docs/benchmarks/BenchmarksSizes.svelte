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
	// sits beside its closest competitor; wasm and native mix within a group
	const size_groups = $derived(derive_size_groups(sizes));

	// a disabled placeholder (e.g. oxfmt's absent wasm build) has no gzip size of its
	// own; when its group's other entries do carry one, fall back to 'n/a' rather than
	// omitting the annotation entirely - otherwise that row drops the annotation
	// column and its bar-track renders wider than its siblings'
	const has_gzip = (entries: ReadonlyArray<{gzip_bytes: number | null}>) =>
		entries.some((e) => e.gzip_bytes != null);
</script>

{#each size_groups as group (group.capability)}
	{@const group_has_gzip = has_gzip(group.entries)}
	<div class="size-group">
		<h3>{group.heading}</h3>
		<div class="column gap_xs">
			{#each group.entries as s (s.label)}
				<BenchmarksBar
					label={s.label}
					bar_fraction={s.bar_fraction}
					category={s.category}
					value={format_bytes(s.bytes)}
					ratio_text={s.ratio_vs_min != null ? `${s.ratio_vs_min.toFixed(1)}x` : '1.0x'}
					ratio_color={s.ratio_vs_min != null ? size_ratio_color(s.ratio_vs_min) : 'var(--text_40)'}
					annotation={s.disabled
						? group_has_gzip
							? 'n/a'
							: undefined
						: format_gzip_size(s.gzip_bytes)}
					disabled={s.disabled}
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

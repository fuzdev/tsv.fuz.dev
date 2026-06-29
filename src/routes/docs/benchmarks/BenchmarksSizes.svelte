<script lang="ts">
	import {
		format_bytes,
		format_gzip_size,
		categorize_size,
		size_ratio_color,
		type BinarySize,
	} from './benchmark_data.ts';
	import BenchmarksBar from './BenchmarksBar.svelte';

	const {
		sizes,
	}: {
		sizes: Array<BinarySize>;
	} = $props();

	const wasm_sizes = $derived(sizes.filter((s) => s.kind === 'wasm'));
	const native_sizes = $derived(sizes.filter((s) => s.kind === 'native'));

	const make_display = (items: Array<BinarySize>) => {
		const sorted = items.toSorted((a, b) => a.bytes - b.bytes);
		const max = Math.max(0, ...items.map((s) => s.bytes));
		// anchor "vs tsv" ratios on the headline build per kind - `tsv_wasm` (the
		// flagship full build the bench executes) for wasm, `tsv (napi)` for native
		// (the N-API addon, the flagship's native path) — matching the node report's
		// own anchor; `tsv_format_wasm` covers reports generated before shape v2 added
		// the third build, then any tsv-prefixed label. Without this the wasm group
		// anchors on whatever sorts largest and every ratio disagrees with the report.
		const tsv =
			sorted.find((s) => s.label === 'tsv_wasm' || s.label === 'tsv (napi)') ??
			sorted.find((s) => s.label === 'tsv_format_wasm') ??
			sorted.find((s) => s.label.startsWith('tsv'));
		return sorted.map((s) => ({
			...s,
			bar_fraction: max > 0 ? s.bytes / max : 0,
			ratio_vs_tsv: tsv && s !== tsv ? s.bytes / tsv.bytes : undefined,
			category: categorize_size(s.label),
		}));
	};

	const wasm_display = $derived(make_display(wasm_sizes));
	const native_display = $derived(make_display(native_sizes));
</script>

{#if wasm_display.length > 0}
	<div class="size-group">
		<h3>wasm</h3>
		<div class="column gap_xs">
			{#each wasm_display as s (s.label)}
				<BenchmarksBar
					label={s.label}
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
{/if}

{#if native_display.length > 0}
	<div class="size-group">
		<h3>native</h3>
		<div class="column gap_xs">
			{#each native_display as s (s.label)}
				<BenchmarksBar
					label={s.label}
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
{/if}

<style>
	.size-group {
		margin-bottom: var(--space_lg);
	}
</style>

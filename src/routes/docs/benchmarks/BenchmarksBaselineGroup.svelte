<script lang="ts">
	import {
		baseline_ratio_color,
		compute_baseline_ratio,
		format_baseline_ratio,
		type BaselineDirection,
		type BaselineRow,
	} from './benchmark_data.ts';
	import BenchmarksBar from './BenchmarksBar.svelte';

	const {
		rows,
		default_anchor_key,
		direction,
	}: {
		rows: Array<BaselineRow>;
		// key of the row that anchors the ratios by default; hovering an enabled row
		// overrides it, leaving the group restores it
		default_anchor_key: string | undefined;
		direction: BaselineDirection;
	} = $props();

	// the row currently acting as the baseline: the hovered row while the pointer is
	// over an enabled row, otherwise the group default. Each group instance owns its
	// own state, so the three groups in a section re-baseline independently.
	let hovered_key: string | undefined = $state(undefined);
	const anchor_key = $derived(hovered_key ?? default_anchor_key);
	const anchor_row = $derived(rows.find((r) => r.key === anchor_key));
</script>

<div class="column">
	{#each rows as row (row.key)}
		{@const ratio =
			!row.disabled && anchor_row && row.key !== anchor_key
				? compute_baseline_ratio(direction, row.raw, anchor_row.raw)
				: undefined}
		<BenchmarksBar
			label={row.label}
			bar_fraction={row.bar_fraction}
			category={row.category}
			value={row.value}
			annotation={row.annotation}
			disabled={row.disabled}
			ratio_text={ratio != null ? format_baseline_ratio(direction, ratio) : '1.0x'}
			ratio_color={ratio != null ? baseline_ratio_color(direction, ratio) : 'var(--text_40)'}
			on_enter={row.disabled ? undefined : () => (hovered_key = row.key)}
			on_leave={() => (hovered_key = undefined)}
		/>
	{/each}
</div>

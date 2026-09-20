<script lang="ts">
	import {
		baseline_ratio_color,
		compute_baseline_ratio,
		format_baseline_ratio,
		type BaselineDirection,
		type BaselineRow
	} from './benchmark_baseline.ts';
	import BenchmarksBar from './BenchmarksBar.svelte';

	const {
		rows,
		direction,
		label
	}: {
		// ordered so the first enabled row is the default baseline (callers lead with
		// the canonical reference for speed, the smallest build for size)
		rows: Array<BaselineRow>;
		direction: BaselineDirection;
		// names the group to assistive tech, which reads the bars as a table
		label: string;
	} = $props();

	// the row currently acting as the baseline: the hovered row while the pointer is
	// over an enabled row, otherwise the group default (its first enabled row). Each
	// group instance owns its own state, so the three groups in a section re-baseline
	// independently.
	let hovered_key: string | undefined = $state(undefined);
	const default_anchor_key = $derived(rows.find((r) => !r.disabled)?.key);
	const anchor_key = $derived(hovered_key ?? default_anchor_key);
	const anchor_row = $derived(rows.find((r) => r.key === anchor_key));

	// Hover is handled here rather than per row: the anchor is the GROUP's state, so
	// the group is where the pointer belongs, and one delegated listener serves a
	// group where 74 rows across the page would each have carried their own. A
	// disabled row publishes no key, so it can never become the anchor.
	// Pointer rather than mouse events: `pointerover` bubbles to here as `mouseenter`
	// wouldn't, and it brings pen and touch along, where a tap re-baselines the row
	// it lands on and the lift restores the default.
	const to_hovered_key = (event: PointerEvent): string | undefined => {
		const row = (event.target as Element | null)?.closest<HTMLElement>('[data-baseline-key]');
		return row?.dataset.baselineKey;
	};
</script>

<!-- A table to assistive tech, since the bar rows are a grid of spans rather than
	a `<table>` (the bars want a fluid track column the table layout would fight).
	`pointerleave` on the container restores the default anchor when the pointer
	leaves the group entirely. The rows carry no focus path: re-baselining is a
	non-essential pointer affordance over data that is fully visible regardless,
	with the default anchor serving keyboard and no-pointer readers. -->
<div
	class="column"
	role="table"
	aria-label={label}
	onpointerover={(event) => (hovered_key = to_hovered_key(event))}
	onpointerleave={() => (hovered_key = undefined)}
>
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
			coverage_only={row.coverage_only}
			ratio_text={format_baseline_ratio(direction, ratio ?? 1)}
			ratio_color={ratio != null ? baseline_ratio_color(direction, ratio) : 'var(--text_40)'}
			baseline_key={row.disabled ? undefined : row.key}
		/>
	{/each}
</div>

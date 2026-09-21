<script lang="ts">
	import type { ImplementationCategory } from './benchmark_data.ts';
	import { category_color, format_label, type FormattedUnit } from './benchmark_display.ts';

	const {
		label,
		bar_fraction,
		category,
		value,
		ratio_text,
		ratio_color,
		annotation,
		disabled = false,
		coverage_only = false,
		baseline_key,
		anchor = false
	}: {
		label: string;
		bar_fraction: number;
		category: ImplementationCategory;
		value: FormattedUnit;
		ratio_text: string;
		ratio_color: string | undefined;
		// optional extra context: a column of its own between value and ratio (gzipped
		// size in the binary-size groups), or, on a coverage-only row, the accept rate
		// shown beside `not timed`; omitted when absent
		annotation?: string | undefined;
		// a grayed-out, inert placeholder (a tool that doesn't run in this group) —
		// no bar, no value, no ratio, just the label held in its shared slot
		disabled?: boolean;
		// inert for a different reason: the tool DID run over the whole corpus but
		// was deliberately never timed (no in-process API, so a per-file row would
		// have measured process spawn). Reads `not timed` rather than `n/a`, since
		// "we chose not to measure this" and "this tool wasn't here" are different
		// claims and the gray alone can't tell them apart
		coverage_only?: boolean;
		// hover-to-rebaseline: the key the group's delegated `pointerover` reads off
		// this row to adopt it as the ratio anchor. Omitted on inert placeholders,
		// which publish no key and so can never become the anchor.
		baseline_key?: string | undefined;
		// the row every ratio in the group is currently taken against
		anchor?: boolean;
	} = $props();

	// the parenthesized binding suffix (`(wasm)`/`(node napi)`) describes how the
	// tool actually ran in this (Node) report - meaningless for biome's disabled
	// placeholder, since it ships only a wasm build here and there's no ambiguity to
	// lose. oxc-parser keeps its suffix even when disabled since it has two
	// placeholder rows (napi and wasm) that would otherwise become indistinguishable.
	const display_label = $derived(
		disabled && category === 'biome'
			? format_label(label).replace(/ \([^)]*\)$/, '')
			: format_label(label)
	);
</script>

<!-- the grid is a table to assistive tech (its parent is the `role="table"`):
	each row is one tool, its cells the label, measurement, annotation, and ratio;
	the bar itself only repeats the measurement visually, so it is hidden. Hover is
	handled by the group, which reads `data-baseline-key` off whichever row the
	pointer is over — see `BenchmarksBaselineGroup` -->
<div
	class="bar-row"
	class:has-annotation={annotation != null && !coverage_only}
	class:disabled
	class:anchor
	role="row"
	data-baseline-key={baseline_key}
>
	<span class="bar-label" role="rowheader">{display_label}</span>
	{#if coverage_only}
		<!-- no bar to draw, so the cell takes the track's room for its accept rate -->
		<span class="bar-value coverage" role="cell">
			not timed{annotation ? ` (${annotation})` : ''}
		</span>
	{:else}
		<div class="bar-track" role="cell" aria-hidden="true">
			{#if !disabled}
				<div
					class="bar-fill"
					style:width="{bar_fraction * 100}%"
					style:background={category_color(category)}
				></div>
			{/if}
		</div>
		<span class="bar-value" role="cell">
			{#if disabled}n/a{:else}{value.value} {value.unit}{/if}
		</span>
		{#if annotation != null}
			<small class="bar-annotation" role="cell">{annotation}</small>
		{/if}
	{/if}
	<span class="bar-ratio" role="cell" style:color={ratio_color}>
		{#if !disabled}{ratio_text}{/if}
	</span>
</div>

<style>
	.bar-row {
		display: grid;
		grid-template-columns: 18rem 1fr 7.4rem 4.4rem;
		align-items: center;
		gap: var(--space_sm);
		/* rows sit flush (no inter-row gap) with a little padding, so the anchor
		 * highlight reads as one contiguous, full-height band per row */
		padding-block: var(--space_xs);
		padding-right: var(--space_xs);
	}
	.bar-row.has-annotation {
		grid-template-columns: 18rem 1fr 7.4rem 6.4rem 4.4rem;
	}
	.bar-row.disabled {
		opacity: 0.6;
	}
	/* the row every ratio in the group is currently taken against — the default, or
	 * whichever enabled row is hovered (driven in JS) — marked as the CLI tables mark
	 * theirs */
	.bar-row.anchor {
		background-color: var(--fg_05);
		box-shadow: inset var(--border_width_3) 0 0 var(--fg_50);
	}
	.bar-annotation {
		text-align: right;
		white-space: nowrap;
	}
	.bar-label {
		text-align: right;
		white-space: nowrap;
	}
	.bar-track {
		height: 1.2rem;
		border-radius: var(--border_radius_xs);
		background: var(--fg_05);
	}
	.bar-fill {
		height: 100%;
		border-radius: var(--border_radius_xs);
		min-width: 2px;
		transition: width 0.3s ease;
	}
	.bar-value {
		text-align: right;
		white-space: nowrap;
	}
	.bar-value.coverage {
		grid-column: span 2;
	}
	.bar-ratio {
		font-weight: 700;
		text-align: right;
	}
</style>

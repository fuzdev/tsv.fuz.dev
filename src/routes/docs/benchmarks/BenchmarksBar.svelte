<script lang="ts">
	import {
		category_color,
		format_label,
		type FormattedUnit,
		type ImplementationCategory,
	} from './benchmark_data.js';

	const {
		label,
		bar_fraction,
		category,
		value,
		ratio_text,
		ratio_color,
		annotation,
	}: {
		label: string;
		bar_fraction: number;
		category: ImplementationCategory;
		value: FormattedUnit;
		ratio_text: string;
		ratio_color: string | undefined;
		// optional extra context shown between value and ratio (corpus coverage in
		// benchmark groups, gzipped size in binary-size groups); omitted when absent
		annotation?: string | undefined;
	} = $props();
</script>

<div class="bar-row" class:has-annotation={annotation != null}>
	<span class="bar-label">{format_label(label)}</span>
	<div class="bar-track">
		<div
			class="bar-fill"
			style:width="{bar_fraction * 100}%"
			style:background={category_color(category)}
		></div>
	</div>
	<span class="bar-value">{value.value} <span class="text_50">{value.unit}</span></span>
	{#if annotation != null}
		<span class="bar-annotation text_50">{annotation}</span>
	{/if}
	<span class="bar-ratio" style:color={ratio_color}>{ratio_text}</span>
</div>

<style>
	.bar-row {
		display: grid;
		grid-template-columns: 12rem 1fr 5.6rem 3.4rem;
		align-items: center;
		gap: var(--space_sm);
		height: 2rem;
	}
	.bar-row.has-annotation {
		grid-template-columns: 12rem 1fr 5.6rem 6rem 3.4rem;
	}
	.bar-annotation {
		font-size: var(--font_size_xs);
		text-align: right;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.bar-label {
		font-size: var(--font_size_sm);
		text-align: right;
		overflow: hidden;
		text-overflow: ellipsis;
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
		font-size: var(--font_size_sm);
		text-align: right;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.bar-ratio {
		font-size: var(--font_size_sm);
		font-weight: 700;
		text-align: right;
	}
</style>

<script lang="ts">
	import {
		category_color,
		format_label,
		type FormattedUnit,
		type ImplementationCategory,
	} from './benchmark_data.ts';

	const {
		label,
		bar_fraction,
		category,
		value,
		ratio_text,
		ratio_color,
		annotation,
		disabled = false,
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
		// a grayed-out, inert placeholder (a tool that doesn't run in this group) —
		// no bar, no value, no ratio, just the label held in its shared slot
		disabled?: boolean;
	} = $props();

	// the parenthesized binding suffix (`(wasm)`/`(napi)`) describes how the tool
	// actually ran - meaningless for biome's disabled placeholder (its only variant
	// is wasm, so there's no ambiguity to lose). oxc-parser keeps its suffix even
	// when disabled since it has two placeholder rows (napi and wasm) that would
	// otherwise become indistinguishable.
	const display_label = $derived(
		disabled && category === 'biome'
			? format_label(label).replace(/ \([^)]*\)$/, '')
			: format_label(label),
	);
</script>

<div class="bar-row" class:has-annotation={annotation != null} class:disabled>
	<span class="bar-label">{display_label}</span>
	<div class="bar-track">
		{#if !disabled}
			<div
				class="bar-fill"
				style:width="{bar_fraction * 100}%"
				style:background={category_color(category)}
			></div>
		{/if}
	</div>
	<span class="bar-value">
		{#if disabled}
			<span class="text_40">—</span>
		{:else}
			{value.value} <span class="text_50">{value.unit}</span>
		{/if}
	</span>
	{#if annotation != null}
		<span class="bar-annotation text_50">{annotation}</span>
	{/if}
	<span class="bar-ratio" style:color={ratio_color}
		>{#if !disabled}{ratio_text}{/if}</span
	>
</div>

<style>
	.bar-row {
		display: grid;
		grid-template-columns: 16rem 1fr 5.6rem 3.4rem;
		align-items: center;
		gap: var(--space_sm);
		height: 2rem;
	}
	.bar-row.has-annotation {
		grid-template-columns: 16rem 1fr 5.6rem 6rem 3.4rem;
	}
	.bar-row.disabled {
		opacity: 0.6;
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

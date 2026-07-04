<script lang="ts">
	import {
		category_color,
		format_coverage_percent,
		type ConformanceGroup,
	} from './benchmark_data.ts';

	const {
		groups,
	}: {
		groups: Array<ConformanceGroup>;
	} = $props();

	const LANGUAGE_LABELS: Record<string, string> = {
		svelte: 'Svelte',
		typescript: 'TypeScript',
		css: 'CSS',
	};
</script>

{#each groups as group (group.language)}
	<div class="mb_xl5">
		<p style:display="flex" style:justify-content="space-between">
			<span>
				Parsing {group.files_total.toLocaleString('en-US')}
				{LANGUAGE_LABELS[group.language] ?? group.language} files
			</span>
			<span class="text_40" style:text-align="right"
				>files accepted &nbsp;&middot;&nbsp; coverage</span
			>
		</p>
		{#each group.rows as row (row.name)}
			<div class="coverage-row">
				<span class="coverage-label">{row.name}</span>
				<div class="coverage-track">
					<div
						class="coverage-fill"
						style:width="{row.coverage_fraction * 100}%"
						style:background={category_color(row.category)}
					></div>
				</div>
				<span class="coverage-count"
					>{row.files_processed.toLocaleString('en-US')}/{row.files_total.toLocaleString(
						'en-US',
					)}</span
				>
				<span class="coverage-percent">{format_coverage_percent(row.coverage_fraction)}</span>
			</div>
		{/each}
	</div>
{/each}

<style>
	.coverage-row {
		display: grid;
		grid-template-columns: 16rem 1fr 9rem 5.4rem;
		align-items: center;
		gap: var(--space_sm);
		padding-block: var(--space_xs);
		border-radius: var(--border_radius_xs);
	}
	.coverage-label {
		font-size: var(--font_size_sm);
		text-align: right;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.coverage-track {
		height: 1.2rem;
		border-radius: var(--border_radius_xs);
		background: var(--fg_05);
	}
	.coverage-fill {
		height: 100%;
		border-radius: var(--border_radius_xs);
		min-width: 2px;
		transition: width 0.3s ease;
	}
	.coverage-count {
		font-size: var(--font_size_xs);
		text-align: right;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.coverage-percent {
		font-size: var(--font_size_sm);
		font-weight: 700;
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
</style>

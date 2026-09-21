<!--
	TODO: show per-corpus-source coverage, not just the per-language aggregate.

	Each group's aggregate blends corpora that answer different questions, so the
	single percentage below is a summary rather than the finding. `parse/typescript`
	is mostly test262 — ECMAScript, not TypeScript — so a real TS gap moves the
	number by tenths of a point and reads as noise. And on the corpus a tool's own
	parser selected, that tool scores 100% BY CONSTRUCTION rather than by
	achievement (tsc on the tsc corpus, svelte/compiler on the Svelte set), which
	the aggregate presents as if it were a result.

	The data is already here: the report carries `coverage_by_source`
	(`group → source → impl → {processed, total}`) from `version` 8 on — the
	machine-readable half of the per-source tables in tsv's own markdown report,
	which splits exactly this way and for exactly this reason. `benchmark_data.ts`'s
	`derive_conformance_slice` already reads it for the page's by-slice prose; what's
	missing here is a nested table or a per-source breakdown under each group.
-->
<script lang="ts">
	import { format_coverage_percent, type ConformanceGroup } from './benchmark_conformance.ts';
	import { format_count, format_language } from './benchmark_display.ts';

	const {
		groups
	}: {
		groups: Array<ConformanceGroup>;
	} = $props();
</script>

{#each groups as group (group.language)}
	<div class="mb_xl5">
		<p class="mb_xs">
			Parsing {format_count(group.files_total)}
			{format_language(group.language)} files
		</p>
		<table class="benchmarks-table">
			<thead>
				<tr>
					<th scope="col">parser</th>
					<th scope="col" class="benchmarks-num">files accepted</th>
					<th scope="col" class="benchmarks-num">coverage</th>
				</tr>
			</thead>
			<tbody>
				{#each group.rows as row (row.name)}
					<tr>
						<th scope="row">
							{row.name}{#if row.note}
								<small class="text_40">({row.note})</small>
							{/if}
						</th>
						<td class="benchmarks-num">
							{format_count(row.files_processed)} /
							{format_count(row.files_total)}
						</td>
						<td class="benchmarks-num percent">{format_coverage_percent(row.coverage_fraction)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/each}

<style>
	table {
		max-width: 40rem;
	}
	thead th {
		font-weight: 400;
		font-size: var(--font_size_sm);
		color: var(--text_40);
		padding-block: var(--space_xs);
	}
	tbody th,
	td {
		padding-block: var(--space_xs);
	}
	/* darker row separators than the base style's */
	tr {
		border-bottom-color: var(--border_color);
	}
	.percent {
		font-weight: 700;
	}
</style>

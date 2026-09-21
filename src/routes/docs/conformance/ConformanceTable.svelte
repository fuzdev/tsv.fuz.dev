<script lang="ts">
	import type { ConformanceCell, ConformanceMatrix } from './conformance_data.ts';
	import {
		format_count,
		format_coverage_percent,
		format_language,
		format_percent
	} from '../benchmarks/benchmark_display.ts';

	const {
		matrices
	}: {
		matrices: Array<ConformanceMatrix>;
	} = $props();
</script>

<!-- a percentage this close to 100% compresses the gap, so the rejected count rides
	beside it; a cell whose engine selected the source shows no number at all -->
{#snippet coverage_cell(cell: ConformanceCell | undefined)}
	<td class="coverage-num">
		{#if !cell}
			—
		{:else if cell.selected}
			<span class="text_40">selected</span>
		{:else}
			{format_coverage_percent(cell.coverage_fraction)}
			<small class="text_40">
				{#if cell.rejected > 0}−{format_count(cell.rejected)}{/if}
			</small>
		{/if}
	</td>
{/snippet}

{#each matrices as matrix (matrix.language)}
	<div class="mb_xl5">
		<h3>
			Parsing {format_count(matrix.files_total)}
			{format_language(matrix.language)} files
		</h3>
		<div class="benchmarks-table-scroll">
			<table class="benchmarks-table">
				<thead>
					<tr>
						<th scope="col">source</th>
						<th scope="col" colspan="2">files</th>
						{#each matrix.engines as engine (engine.name)}
							<th scope="col" class="coverage-num">
								{engine.name}
								{#if engine.note}<small>({engine.note})</small>{/if}
							</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					<!-- the whole group leads as the sum the source rows break down: it blends
						sources that answer different questions, so the rows under it are the finding -->
					<tr>
						<th scope="row">all sources</th>
						<td class="coverage-num">{format_count(matrix.files_total)}</td>
						<td></td>
						{#each matrix.aggregate as cell, i (matrix.engines[i]?.name)}
							{@render coverage_cell(cell)}
						{/each}
					</tr>
					{#each matrix.sources as source (source.origins[0]?.path)}
						<tr>
							<th scope="row">
								{#each source.origins as origin, i (origin.path)}
									{i > 0 ? ', ' : ''}
									{#if origin.url}
										<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
										<a href={origin.url} rel="external">
											{#if origin.label}{origin.label}{:else}<code>{origin.path}</code>{/if}
										</a>
									{:else if origin.label}
										{origin.label}
									{:else}
										<code>{origin.path}</code>
									{/if}
								{/each}
								{#if source.folded}<small>(all accepted by every parser)</small>{/if}
							</th>
							<td class="coverage-num">{format_count(source.files)}</td>
							<td class="coverage-num text_40">
								{format_percent(source.files, matrix.files_total)}
							</td>
							{#each source.cells as cell, i (matrix.engines[i]?.name)}
								{@render coverage_cell(cell)}
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
{/each}

<style>
	/* left-aligned like the text cells they sit among (`selected`, the source names),
	   where the cross-runtime tables' `.benchmarks-num` aligns pure numbers right */
	.coverage-num {
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}
</style>

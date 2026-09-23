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
	beside it; a cell whose engine selected the source is full by construction, so it
	reads a greyed `100%` without the decimals a result carries -->
{#snippet coverage_cell(cell: ConformanceCell | undefined)}
	<td class="coverage-num">
		{#if !cell}
			—
		{:else if cell.selected}
			<span class="text_40">100%<span class="visually-hidden">by construction</span></span>
		{:else}
			{format_coverage_percent(cell.coverage_fraction)}
			{#if cell.rejected > 0}
				<small class="text_40">−{format_count(cell.rejected)}</small>
			{/if}
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
						<th scope="colgroup" colspan="2">files</th>
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
	/* left-aligned like the source names they sit among, where `.benchmarks-num`
	   aligns pure numbers right */
	.coverage-num {
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}
	/* read out, not shown: the greyed `100%` says it by sight alone */
	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
</style>

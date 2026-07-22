<script lang="ts">
	import { format_coverage_percent, type ConformanceGroup } from './benchmark_data.ts';

	const {
		groups
	}: {
		groups: Array<ConformanceGroup>;
	} = $props();

	const LANGUAGE_LABELS: Record<string, string> = {
		svelte: 'Svelte',
		typescript: 'TypeScript',
		css: 'CSS'
	};
</script>

{#each groups as group (group.language)}
	<div class="mb_xl5">
		<p class="heading">
			Parsing {group.files_total.toLocaleString('en-US')}
			{LANGUAGE_LABELS[group.language] ?? group.language} files
		</p>
		<table>
			<thead>
				<tr>
					<th></th>
					<th class="num">files accepted</th>
					<th class="num">coverage</th>
				</tr>
			</thead>
			<tbody>
				{#each group.rows as row (row.name)}
					<tr>
						<td>{row.name}</td>
						<td class="num"
							>{row.files_processed.toLocaleString('en-US')} / {row.files_total.toLocaleString(
								'en-US'
							)}</td
						>
						<td class="num percent">{format_coverage_percent(row.coverage_fraction)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/each}

<style>
	.heading {
		margin-bottom: var(--space_xs);
	}
	table {
		width: 100%;
		max-width: 40rem;
		border-collapse: collapse;
	}
	th {
		font-weight: 400;
		font-size: var(--font_size_sm);
		color: var(--text_40);
		text-align: left;
		padding-block: var(--space_xs);
	}
	td {
		padding-block: var(--space_xs);
		border-top: var(--border_width) solid var(--border_color);
	}
	.num {
		text-align: right;
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}
	.percent {
		font-weight: 700;
	}
</style>

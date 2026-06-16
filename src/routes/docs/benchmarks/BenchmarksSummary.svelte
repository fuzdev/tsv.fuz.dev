<script lang="ts">
	import {format_speedup, type BenchmarkGroup, type SpeedupRow} from './benchmark_data.ts';

	const {
		rows,
		groups,
		corpus,
	}: {
		rows: Array<SpeedupRow>;
		groups: Array<BenchmarkGroup>;
		corpus: Record<string, number>;
	} = $props();

	// the speedups are measured on the per-group intersection (`files_iterated`),
	// not the full discovered corpus — label the columns with the timed set,
	// falling back to the corpus total on older baselines (< version 4)
	const count_label = (language: string): string => {
		const group = groups.find((g) => g.operation === 'format' && g.language === language);
		const total = corpus[language] ?? 0;
		return group?.files_iterated != null ? `${group.files_iterated} of ${total}` : `${total}`;
	};
</script>

<p>
	tsv is heavily inspired by and borrows architectural patterns from <a href="https://prettier.io/"
		>Prettier</a
	>. We're very grateful for the hard work of its
	<a href="https://github.com/prettier/prettier/graphs/contributors">contributors</a>. tsv offers a
	speedup over Prettier:
</p>
<table>
	<thead>
		<tr>
			<th></th>
			<th class="color_h_50">Svelte<br /><small>{count_label('svelte')} files</small></th>
			<th class="color_i_50">TypeScript<br /><small>{count_label('typescript')} files</small></th>
			<th class="color_a_50">CSS<br /><small>{count_label('css')} files</small></th>
		</tr>
	</thead>
	<tbody>
		{#each rows as row (row.variant)}
			{@const cells = [row.format_svelte, row.format_typescript, row.format_css]}
			<tr>
				<td class="variant">{row.variant}</td>
				{#each cells as value, i (i)}
					<td class="speedup">{value != null ? format_speedup(value) : '-'}</td>
				{/each}
			</tr>
		{/each}
	</tbody>
</table>

<style>
	table {
		width: 100%;
	}
	thead th {
		padding: var(--space_xs) var(--space_sm);
		font-size: var(--font_size_sm);
	}
	thead th small {
		font-weight: 400;
		opacity: 0.7;
	}
	tbody td {
		padding: var(--space_xs) var(--space_sm);
	}
	.variant {
		text-align: left;
		font-weight: 600;
	}
	.speedup {
		font-size: var(--font_size_xl);
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
</style>

<script lang="ts">
	import type { SpeedupRow } from './benchmark_data.ts';
	import { format_speedup } from './benchmark_display.ts';

	const {
		rows
	}: {
		rows: Array<SpeedupRow>;
	} = $props();
</script>

<p>
	tsv's formatter is inspired by and borrows architectural patterns from
	<a href="https://prettier.io/">Prettier</a>, and we're grateful for the hard work of its
	<a href="https://github.com/prettier/prettier/graphs/contributors">contributors</a>.
	Single-threaded on the benchmarked corpus, tsv is this much faster than Prettier:
</p>
<table class="benchmarks-table">
	<thead>
		<tr>
			<th scope="col">build</th>
			<th scope="col">Svelte</th>
			<th scope="col">TypeScript</th>
			<th scope="col">CSS</th>
		</tr>
	</thead>
	<tbody>
		{#each rows as row (row.variant)}
			{@const cells = [
				['svelte', row.format_svelte],
				['typescript', row.format_typescript],
				['css', row.format_css]
			] as const}
			<tr>
				<th scope="row">{row.variant}</th>
				{#each cells as [language, value] (language)}
					<td class="speedup">{value != null ? format_speedup(value) : '—'}</td>
				{/each}
			</tr>
		{/each}
	</tbody>
</table>

<style>
	.speedup {
		font-size: var(--font_size_xl);
		font-weight: 700;
	}
</style>

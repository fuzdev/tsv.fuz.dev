<script lang="ts">
	import { SPEEDUP_LANGUAGES, type SpeedupRow } from './benchmark_data.ts';
	import { format_language, format_speedup } from './benchmark_display.ts';

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
			{#each SPEEDUP_LANGUAGES as language (language)}
				<th scope="col">{format_language(language)}</th>
			{/each}
		</tr>
	</thead>
	<tbody>
		{#each rows as row (row.variant)}
			<tr>
				<th scope="row">{row.variant}</th>
				{#each row.cells as { language, speedup } (language)}
					<td class="speedup">{speedup != null ? format_speedup(speedup) : '—'}</td>
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

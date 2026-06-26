<script lang="ts">
	import {
		category_color,
		cross_runtime_ratio_background,
		derive_cross_runtime_groups,
		format_label,
		format_speedup,
		type BenchmarkRuntime,
		type CrossRuntimeReport,
	} from './benchmark_data.ts';

	const {
		report,
	}: {
		report: CrossRuntimeReport;
	} = $props();

	// Lead with node (the flagship N-API runtime), then deno, then bun; ratios anchor
	// on the first present (node). The combined report stores runtimes deno-first
	// (matching the bench's report.md); the site presents them node-first.
	const DISPLAY_ORDER: Array<BenchmarkRuntime> = ['node', 'deno', 'bun'];
	const runtimes = $derived(DISPLAY_ORDER.filter((r) => report.runtimes.includes(r)));
	const base = $derived(runtimes[0]);
	// ratio columns compare every other runtime against the base (node)
	const others = $derived(runtimes.filter((r) => r !== base));

	const groups = $derived(derive_cross_runtime_groups({...report, runtimes}));

	const format_ops = (n: number | undefined): string => (n == null ? 'fail' : n.toFixed(2));

	const group_label = (operation: string, language: string): string =>
		`${operation === 'format' ? 'Format' : 'Parse'} ${language}`;
</script>

<div class="cross-runtime">
	{#each groups as group (group.group)}
		<div class="group">
			<h4 class="mt_0 mb_sm">{group_label(group.operation, group.language)}</h4>
			<table>
				<thead>
					<tr>
						<th></th>
						{#each runtimes as runtime (runtime)}
							<th class="num">{runtime}</th>
						{/each}
						{#each others as runtime (runtime)}
							<th class="num">{runtime}/{base}</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each group.rows as row (row.name)}
						<tr>
							<td>
								<i class="swatch" style:background={category_color(row.category)}></i>
								{format_label(row.name)}
							</td>
							{#each runtimes as runtime (runtime)}
								<td class="num">{format_ops(row.ops_per_second[runtime])}</td>
							{/each}
							{#each others as runtime (runtime)}
								{@const ratio = row.ratio_vs_base[runtime]}
								<td
									class="num ratio"
									style:background={ratio != null
										? cross_runtime_ratio_background(ratio)
										: undefined}
								>
									{ratio != null ? format_speedup(ratio) : 'fail'}
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/each}
	<p class="text_40">
		ops/sec (higher is faster); ratios are vs <code>{base}</code> (&gt; 1 = faster than {base}). A
		<code>fail</code> is an implementation that runtime can't load (see notes above).
	</p>
</div>

<style>
	.group {
		margin-bottom: var(--space_xl4);
	}
	table {
		width: 100%;
	}
	.num {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	.ratio {
		font-weight: 700;
	}
	td .swatch {
		display: inline-block;
		width: 1.2rem;
		height: 1.2rem;
		border-radius: var(--border_radius_xs);
		vertical-align: middle;
	}
</style>

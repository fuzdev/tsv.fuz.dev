<script lang="ts">
	import {
		category_color,
		cross_runtime_ratio_background,
		derive_cross_runtime_groups,
		format_label,
		format_speedup,
		order_cross_runtime_runtimes,
		type CrossRuntimeReport,
	} from './benchmark_data.ts';

	const {
		report,
	}: {
		report: CrossRuntimeReport;
	} = $props();

	// Node-first (the flagship N-API runtime), then deno, then bun — the same
	// display order `derive_cross_runtime_groups` anchors its ratios on.
	const runtimes = $derived(order_cross_runtime_runtimes(report.runtimes));
	const base = $derived(runtimes[0]);
	// ratio columns compare every other runtime against the base (node)
	const others = $derived(runtimes.filter((r) => r !== base));

	const groups = $derived(derive_cross_runtime_groups(report));

	const format_ops = (n: number | undefined): string => (n == null ? 'fail' : n.toFixed(2));

	const group_label = (operation: string, language: string): string =>
		`${operation === 'format' ? 'Format' : 'Parse'} ${language}`;
</script>

<div class="cross-runtime">
	{#if report.mixed_vintage}
		<aside class="mixed-vintage">
			⚠ The per-runtime reports backing these tables come from different commits/versions, so the
			ratios are unreliable until every runtime is re-run.
		</aside>
	{/if}
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
		sweeps/sec — one sweep is a full pass over the group's timed file set (higher is faster); ratios
		are vs <code>{base}</code> (&gt; 1 = faster than {base}). A
		<code>fail</code> is an implementation that runtime can't load (see notes above).
	</p>
</div>

<style>
	/* the warning red tint over fuz_css's base aside styling */
	.mixed-vintage {
		border-left-color: var(--color_c_50);
	}
	.group {
		margin-bottom: var(--space_xl4);
	}
	table {
		width: 100%;
	}
	.num {
		text-align: right;
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

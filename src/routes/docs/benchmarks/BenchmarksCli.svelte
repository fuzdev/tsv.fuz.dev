<script lang="ts">
	import { format_speedup } from './benchmark_display.ts';
	import {
		cli_label_is_tsv,
		cli_ratio_vs_tsv,
		CLI_TSV_LABEL,
		type BenchmarksCliReport,
		type CliScenario,
		type CliFormatterResult,
		type CliMetric
	} from './benchmarks_cli.ts';

	const {
		report
	}: {
		report: BenchmarksCliReport;
	} = $props();

	// listed as the harness reported them, so a formatter added or dropped upstream
	// shows up here instead of silently rendering `undefined` for a fixed key
	const versions = $derived(
		Object.entries(report.versions)
			.map(([name, version]) => `${name} ${version}`)
			.join(', ')
	);

	const format_time = (ms: number): string =>
		ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;

	// tsv is the reference row; every ratio is `other / tsv` (>1 = tsv is that many
	// times faster / lighter), shared with the page's prose via `cli_ratio_vs_tsv`.
	// `undefined` on the tsv row itself and wherever a side wasn't measured. A
	// scenario with no tsv row has nothing to anchor on and renders no table.
	interface Row {
		result: CliFormatterResult;
		is_tsv: boolean;
		/** tsv through another distribution, beside other tools — a second tsv row, set apart from them. */
		is_tsv_distribution: boolean;
		wall_ratio: number | undefined;
		cpu_ratio: number | undefined;
		memory_ratio: number | undefined;
	}
	const to_rows = (scenario: CliScenario): Array<Row> => {
		if (!scenario.results.some((r) => r.label === CLI_TSV_LABEL)) return [];
		return scenario.results.map((result) => {
			const is_tsv = result.label === CLI_TSV_LABEL;
			const ratio = (metric: CliMetric) =>
				is_tsv ? undefined : cli_ratio_vs_tsv(scenario.results, result.label, metric);
			return {
				result,
				is_tsv,
				is_tsv_distribution: !is_tsv && !scenario.tsv_only && cli_label_is_tsv(result.label),
				wall_ratio: ratio('wall_ms'),
				cpu_ratio: ratio('cpu_ms'),
				memory_ratio: ratio('memory_mb')
			};
		});
	};
</script>

{#each report.scenarios as scenario (scenario.key)}
	{@const rows = to_rows(scenario)}
	<div class="mb_xl2">
		<h3>{scenario.heading}: {scenario.target}</h3>
		<p>{scenario.description}</p>
		{#if rows.length > 0}
			<div class="table-scroll">
				<table>
					<thead>
						<tr>
							<th class="formatter">formatter</th>
							<th>time</th>
							<th>vs tsv</th>
							<th>vs tsv (CPU work)</th>
							<th>peak RSS</th>
							<th>vs tsv</th>
						</tr>
					</thead>
					<tbody>
						{#each rows as row (row.result.label)}
							<tr class:tsv={row.is_tsv} class:tsv-distribution={row.is_tsv_distribution}>
								<td class="formatter">{row.result.label}</td>
								<td>{format_time(row.result.wall_ms)}</td>
								<td class="speedup">
									{row.wall_ratio == null ? '—' : format_speedup(row.wall_ratio)}
								</td>
								<td class="speedup">
									{row.cpu_ratio == null ? '—' : format_speedup(row.cpu_ratio)}
								</td>
								<td>
									{row.result.memory_mb == null ? '—' : `${Math.round(row.result.memory_mb)} MB`}
								</td>
								<td class="speedup">
									{row.memory_ratio == null ? '—' : format_speedup(row.memory_ratio)}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
		{#if scenario.unshimmed}
			<p class="aborted">{scenario.unshimmed}</p>
		{/if}
		{#if scenario.aborted}
			<p class="aborted">
				{scenario.aborted} The harness aborts a scenario rather than publish numbers its formatters
				didn't earn on the same work, and this page shows the abort rather than dropping it.
			</p>
		{/if}
	</div>
{/each}

<p class="versions">
	Measured on {report.machine} — {versions}. Wall-clock ratios scale with core count; "vs tsv (CPU
	work)" is the parallelism-neutral view.
</p>

<style>
	/* wide table scrolls in its own container so the page body never scrolls sideways */
	.table-scroll {
		overflow-x: auto;
	}
	table {
		width: 100%;
	}
	th,
	td {
		padding-block: var(--space_xs);
		text-align: right;
		white-space: nowrap;
	}
	.formatter {
		text-align: left;
	}
	.speedup {
		font-weight: 600;
	}
	.aborted {
		font-style: italic;
		opacity: 0.8;
	}
	tr.tsv {
		font-weight: 700;
		background-color: var(--fg_10);
	}
	tr.tsv-distribution {
		background-color: var(--fg_05);
	}
	.versions {
		font-size: var(--font_size_sm);
		opacity: 0.7;
	}
</style>

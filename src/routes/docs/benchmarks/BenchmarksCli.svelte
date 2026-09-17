<script lang="ts">
	import { format_memory_ratio, format_speedup } from './benchmark_display.ts';
	import {
		cli_default_anchor_label,
		cli_label_is_tsv,
		cli_ratio_between,
		CLI_TSV_LABEL,
		CLI_TSV_NPM_LABEL,
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

	// the row the pointer is over re-baselines its own table, as the format, parse,
	// and size groups do; only one row is ever hovered, so one slot serves every table
	let hovered: { key: string; label: string } | undefined = $state(undefined);

	// Every ratio is `row / anchor` (>1 = the anchor is that many times faster /
	// lighter), the same `cli_ratio_between` the page's prose quotes. The anchor is
	// the hovered row, else the scenario's default (`cli_default_anchor_label`: the
	// dispatcher row facing other tools, native tsv in the tsv-only table).
	// `undefined` on the anchor row itself and wherever a side wasn't measured. A
	// scenario with no tsv row has nothing to anchor on and renders no table.
	interface Row {
		result: CliFormatterResult;
		is_tsv: boolean;
		/** tsv through another distribution, beside other tools — a second tsv row, set apart from them. */
		is_tsv_distribution: boolean;
		is_anchor: boolean;
		wall_ratio: number | undefined;
		cpu_ratio: number | undefined;
		memory_ratio: number | undefined;
	}
	const to_anchor_label = (scenario: CliScenario): string | undefined =>
		hovered?.key === scenario.key ? hovered.label : cli_default_anchor_label(scenario);
	const to_rows = (scenario: CliScenario, anchor_label: string | undefined): Array<Row> => {
		if (anchor_label === undefined) return [];
		return scenario.results.map((result) => {
			const is_tsv = result.label === CLI_TSV_LABEL;
			const is_anchor = result.label === anchor_label;
			const ratio = (metric: CliMetric) =>
				is_anchor
					? undefined
					: cli_ratio_between(scenario.results, result.label, anchor_label, metric);
			return {
				result,
				is_tsv,
				is_tsv_distribution: !is_tsv && !scenario.tsv_only && cli_label_is_tsv(result.label),
				is_anchor,
				wall_ratio: ratio('wall_ms'),
				cpu_ratio: ratio('cpu_ms'),
				memory_ratio: ratio('memory_mb')
			};
		});
	};
	// The harness's peak RSS is the largest single process in a command's tree, and
	// for the dispatcher row that is Node, not the binary under it — which the
	// default anchor's memory column would otherwise leave a reader to guess.
	const has_dispatcher_memory = (scenario: CliScenario): boolean =>
		scenario.results.some((r) => r.label === CLI_TSV_NPM_LABEL && r.memory_mb != null);

	// the anchor's own cells read as the unit they are; an unmeasured side stays a dash
	const format_cell = (
		row: Row,
		ratio: number | undefined,
		measured: boolean,
		format: (ratio: number) => string = format_speedup
	): string => (ratio != null ? format(ratio) : row.is_anchor && measured ? format(1) : '—');
</script>

{#each report.scenarios as scenario (scenario.key)}
	{@const anchor_label = to_anchor_label(scenario)}
	{@const rows = to_rows(scenario, anchor_label)}
	<div class="mb_xl2">
		<h3>{scenario.heading}: {scenario.target}</h3>
		<p>{scenario.description}</p>
		{#if rows.length > 0}
			<p class="versions">
				Ratios are against <strong>{anchor_label}</strong> — hover a row to re-baseline on it.
			</p>
			<div class="table-scroll">
				<table>
					<thead>
						<tr>
							<th class="formatter">formatter</th>
							<th>time</th>
							<th>vs baseline</th>
							<th>vs baseline (CPU work)</th>
							<th>peak RSS</th>
							<th>vs baseline</th>
						</tr>
					</thead>
					<tbody>
						{#each rows as row (row.result.label)}
							<tr
								class:tsv={row.is_tsv}
								class:tsv-distribution={row.is_tsv_distribution}
								class:anchor={row.is_anchor}
								onmouseenter={() => (hovered = { key: scenario.key, label: row.result.label })}
								onmouseleave={() => (hovered = undefined)}
							>
								<td class="formatter">{row.result.label}</td>
								<td>{format_time(row.result.wall_ms)}</td>
								<td class="speedup">
									{format_cell(row, row.wall_ratio, true)}
								</td>
								<td class="speedup">
									{format_cell(row, row.cpu_ratio, true)}
								</td>
								<td>
									{row.result.memory_mb == null ? '—' : `${Math.round(row.result.memory_mb)} MB`}
								</td>
								<td class="speedup">
									{format_cell(
										row,
										row.memory_ratio,
										row.result.memory_mb != null,
										format_memory_ratio
									)}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			{#if scenario.benchmark_runs > 0}
				<p class="versions">
					Each time is the mean of {scenario.benchmark_runs} runs, after {scenario.warmup_runs}
					untimed warmup runs.
				</p>
			{/if}
			{#if has_dispatcher_memory(scenario)}
				<p class="versions">
					The peak RSS of <strong>{CLI_TSV_NPM_LABEL}</strong> is its Node launcher's, not the
					binary's.
				</p>
			{/if}
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
	Measured on {report.machine} — {versions}. Wall-clock ratios scale with core count; "vs baseline
	(CPU work)" is the parallelism-neutral view.
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
	/* the row every ratio in the table is currently taken against */
	tr.anchor .formatter {
		box-shadow: inset var(--border_width_3) 0 0 var(--color_a_50);
	}
	tr.anchor .speedup {
		opacity: 0.5;
	}
	.versions {
		font-size: var(--font_size_sm);
		opacity: 0.7;
	}
</style>

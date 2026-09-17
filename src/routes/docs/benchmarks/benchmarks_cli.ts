// The independent end-to-end CLI benchmark — a fork of Oxc's own
// `bench-formatter` that adds tsv (https://github.com/ryanatkn/oxc-bench-formatter,
// forked from https://github.com/oxc-project/bench-formatter — `tsv` is the fork's
// DEFAULT branch, so the bare fork URL already lands on it; upstream carries
// neither tsv nor this analysis). Unlike the in-process, single-threaded numbers
// elsewhere on this page, it measures the WHOLE CLI: process spawn, file
// discovery, I/O, and each tool's default multi-file parallelism. tsv, oxfmt, and
// biome parallelize across files while prettier formats them one at a time, so the
// wall-clock ratios scale with core count and are machine-dependent — the
// parallelism-neutral view is CPU work (hyperfine's `User` + `System` time). tsv runs only in
// the JSX-free scenarios (it has no JSX/TSX parser); the Svelte scenario benches
// it against rsvelte-fmt (`@rsvelte/fmt`), the other Rust Svelte-native formatter,
// and the delivery scenario benches tsv against itself — the native binary, the
// same binary through `@fuzdev/tsv`'s Node dispatcher, and `@fuzdev/tsv-wasm`.
// The dispatcher row also runs beside native tsv in every scenario that faces
// another tool: Prettier, Biome, Oxfmt, and rsvelte-fmt are all timed through
// their npm bins, which start Node first, so it is tsv on the same footing — a
// second tsv row, not a competitor, and the one the page's headline ratios quote.
// tsv is non-configurable, so in every scenario it appears in, the formatters it
// is compared against are pinned to its fixed style — width 100, tabs, single
// quotes, no trailing commas — and before timing anything the harness asserts that
// every formatter reporting a file count reports the same one.
//
// The numbers come from `benchmarks_formatters.json`, generated from that
// harness's `results.json` by `benchmarks_formatters.gen.json.ts`; only the prose below
// is authored here. To refresh: run `pnpm run update-readme` in the harness, then
// `gro gen` here.

import { benchmarks_formatters_json } from './benchmarks_formatters.ts';
import type { FormatterScenario } from './formatter_benchmark_data.ts';

export interface CliFormatterResult {
	/** Display label; `tsv` is the reference row every ratio is computed against. */
	label: string;
	/** hyperfine wall-clock mean, in milliseconds — what you experience typing the command. */
	wall_ms: number;
	/**
	 * Total CPU time across all threads, in ms — hyperfine's `User` plus `System`,
	 * the parallelism-neutral view. System time is counted because it is real work
	 * the command demanded (file I/O, thread spawn, page faults) and an uneven share
	 * of it per tool: a third of tsv's CPU on the multi-file repo, half of rsvelte-fmt's.
	 */
	cpu_ms: number;
	/** Peak resident set size (RSS), in megabytes; `null` when the harness measured no memory. */
	memory_mb: number | null;
}

/** A measured `CliFormatterResult` column — what a ratio can be taken over. */
export type CliMetric = keyof Omit<CliFormatterResult, 'label'>;

export interface CliScenario {
	key: string;
	heading: string;
	/** The harness's own one-line corpus label, rendered beside the heading. */
	target: string;
	/** One-line description of what makes the comparison fair. */
	description: string;
	/** Results ascending by wall-clock time, tsv-relative ratios computed by the component. */
	results: Array<CliFormatterResult>;
	/**
	 * hyperfine's untimed warmup runs and the timed runs each mean is taken over.
	 * The harness sets them per scenario (more for the short one-file runs), so
	 * they're shown per table. A scenario aborted before timing still carries the
	 * counts it would have run, so they say nothing about whether it was timed.
	 */
	warmup_runs: number;
	benchmark_runs: number;
	/**
	 * Every row is a tsv distribution, so the scenario compares tsv with itself and
	 * says nothing about other tools — claims spanning "every other tool" skip it.
	 */
	tsv_only: boolean;
	/**
	 * Why the harness stopped early, when it did. Before timing, `results` is
	 * empty and the sentence names the formatter its preflight faulted; after
	 * timing (a memory run crashed) `results` carry times but no memory. Either
	 * way the scenario is kept, so the gap reads as a reported abort rather than a
	 * silently missing table.
	 */
	aborted?: string;
	/**
	 * Why a tsv row's launch cost isn't like-for-like, when it isn't: the harness
	 * normally runs tsv's Node-launched rows through a bin shim copied from pnpm's
	 * own, as every other tool's row runs, and says so when it couldn't.
	 */
	unshimmed?: string;
}

export interface BenchmarksCliReport {
	machine: string;
	versions: Record<string, string>;
	scenarios: Array<CliScenario>;
}

/** The native tsv row every CLI ratio is computed against. */
export const CLI_TSV_LABEL = 'tsv';

/**
 * The tsv-vs-rsvelte-fmt Svelte scenario's id. The harness publishes it aborted
 * whenever rsvelte-fmt's nondeterministic crash hits its preflight, so prose
 * quoting its ratios must be conditional on them resolving.
 */
export const CLI_SVELTE_KEY = 'svelte-tsv-vs-rsvelte-fmt';

/** The multi-file TypeScript repo scenario's id — what the page's prose calls "the TypeScript repo". */
export const CLI_TS_REPO_KEY = 'typescript-only-non-jsx-subset';

/** The one-file scenario's id — what the page's prose calls "the large single file". */
export const CLI_SINGLE_FILE_KEY = 'large-single-file';

/**
 * The tsv-only delivery scenario's id: the native binary against the same binary
 * through `@fuzdev/tsv`'s Node dispatcher and against `@fuzdev/tsv-wasm`, on one
 * file. It measures what each way of installing tsv costs, not another tool.
 */
export const CLI_DELIVERY_KEY = 'tsv-delivery-paths';

/**
 * The npm-dispatcher row, as displayed: the native binary reached through
 * `@fuzdev/tsv`'s Node bin. It runs in the delivery scenario and beside native
 * tsv wherever the harness benches it against the other tools' npm bins.
 */
export const CLI_TSV_NPM_LABEL = 'tsv via npm dispatcher';

/** The delivery scenario's WASM row, as displayed. */
export const CLI_TSV_WASM_LABEL = 'tsv-wasm';

const CLI_TSV_LABELS: ReadonlySet<string> = new Set([
	CLI_TSV_LABEL,
	CLI_TSV_NPM_LABEL,
	CLI_TSV_WASM_LABEL
]);

/** Whether a row is tsv itself — the native binary or one of its other distributions. */
export const cli_label_is_tsv = (label: string): boolean => CLI_TSV_LABELS.has(label);

/**
 * The prose framing for each scenario, keyed by its generated scenario id — the
 * harness measures the numbers but doesn't explain them. Also fixes the page
 * order, which is by narrative weight (the multi-file repo leads, the tsv-only
 * delivery comparison closes), not the order the harness runs them in. A
 * scenario missing from here is dropped rather than rendered unexplained.
 */
const SCENARIO_COPY: Record<
	string,
	Omit<
		CliScenario,
		'key' | 'target' | 'results' | 'warmup_runs' | 'benchmark_runs' | 'aborted' | 'unshimmed'
	>
> = {
	[CLI_TS_REPO_KEY]: {
		heading: 'TypeScript repo',
		description:
			'Every formatter scoped to the same file set and pinned to tsv’s fixed style, so they make the same break decisions over the same files; a preflight check aborts the scenario rather than publish a comparison the tools didn’t run on equal work.',
		tsv_only: false
	},
	[CLI_SINGLE_FILE_KEY]: {
		heading: 'Large single file',
		description:
			'With a single input no formatter can parallelize across files, so wall-clock is closer to an engine-plus-startup comparison than the multi-file rows — each tool still pays its own process and thread-pool setup, and every row but the bare tsv binary pays Node’s startup first, a fixed cost that weighs most on the fastest rows.',
		tsv_only: false
	},
	[CLI_SVELTE_KEY]: {
		heading: 'Svelte corpus',
		description:
			'The two Rust Svelte-native formatters head-to-head on a third-party .svelte corpus, rsvelte-fmt configured to tsv’s fixed style (width 100, tabs, single quotes) so both do comparable line-break work. rsvelte-fmt 0.7.x’s check mode crashes nondeterministically on this corpus — the harness’s preflight pass, never the timed write runs; a run is published as it ended, complete or aborted, never retried into a clean-looking result.',
		tsv_only: false
	},
	[CLI_DELIVERY_KEY]: {
		heading: 'tsv delivery paths',
		description:
			'Every row is tsv, not another tool: the native binary, the same binary through @fuzdev/tsv’s Node dispatcher (how npx tsv runs it), and @fuzdev/tsv-wasm, the same CLI over a WASM engine, the fallback for platforms without a prebuilt binary. One file, so the gaps are launch and engine cost, not file parallelism (the WASM row’s CPU time exceeds its wall-clock because V8 compiles the module on background threads).',
		tsv_only: true
	}
};

/**
 * Display labels for the harness's hyperfine command names, which read better
 * spaced out in a table. Names absent here are displayed as-is.
 */
const CLI_LABELS: Record<string, string> = {
	'prettier+oxc-parser': 'prettier + oxc-parser',
	'tsv-npm': CLI_TSV_NPM_LABEL
};

const to_results = (scenario: FormatterScenario): Array<CliFormatterResult> =>
	scenario.timings
		.map((timing) => ({
			label: CLI_LABELS[timing.name] ?? timing.name,
			wall_ms: timing.mean_ms,
			cpu_ms: timing.user_ms + timing.system_ms,
			memory_mb: scenario.memory.find((m) => m.name === timing.name)?.mean_mb ?? null
		}))
		.sort((a, b) => a.wall_ms - b.wall_ms);

/**
 * The scenarios the page has prose for; every one must resolve to generated
 * data, timed or aborted — the harness publishes an aborted scenario too.
 */
export const CLI_SCENARIO_KEYS = Object.keys(SCENARIO_COPY);

/**
 * The sentence an aborted scenario shows beside (or in place of) its table. An
 * abort after timing (a memory run that crashed) keeps its timed rows, so the
 * note says only what is missing. A preflight abort names the fault per
 * formatter in its rows and then only says it is aborting, so the cause is read
 * back off those rows; one with every row clean — a scope mismatch, say — keeps
 * the harness's own wording.
 */
export const to_abort_note = (scenario: FormatterScenario): string => {
	if (scenario.timings.length) return `Timed, but no memory was published: ${scenario.aborted}.`;
	const faults = scenario.preflight.flatMap((entry) => {
		const label = CLI_LABELS[entry.name] ?? entry.name;
		if (entry.crashed) return [`${label} crashed partway through its parse check`];
		if (entry.unavailable) return [`${label} could not run`];
		if (entry.rejected > 0) return [`${label} rejected ${entry.rejected} files`];
		return [];
	});
	return `Not timed: ${faults.length ? faults.join('; ') : scenario.aborted}.`;
};

/**
 * The sentence a scenario shows when the harness ran some tsv rows without the
 * bin shim the other rows pay for.
 */
export const to_unshimmed_note = (names: Array<string>): string =>
	`${names.map((name) => CLI_LABELS[name] ?? name).join(' and ')} ran as a bare Node script, skipping the few milliseconds of pnpm bin shim the other tools’ rows go through.`;

const to_scenarios = (): Array<CliScenario> =>
	Object.entries(SCENARIO_COPY).flatMap(([key, copy]) => {
		const scenario = benchmarks_formatters_json.scenarios.find((s) => s.id === key);
		return scenario
			? [
					{
						key,
						...copy,
						target: scenario.target,
						results: to_results(scenario),
						warmup_runs: scenario.warmup_runs,
						benchmark_runs: scenario.benchmark_runs,
						...(scenario.aborted === undefined ? null : { aborted: to_abort_note(scenario) }),
						...(scenario.unshimmed ? { unshimmed: to_unshimmed_note(scenario.unshimmed) } : null)
					}
				]
			: [];
	});

export const benchmarks_cli: BenchmarksCliReport = {
	machine: benchmarks_formatters_json.machine,
	versions: benchmarks_formatters_json.versions,
	scenarios: to_scenarios()
};

/**
 * One rendered CLI scenario by its id — for prose that needs more than a ratio,
 * such as whether the scenario was aborted.
 *
 * @returns the scenario, or `undefined` when the generated data doesn't carry it
 */
export const cli_scenario_find = (scenario_key: string): CliScenario | undefined =>
	benchmarks_cli.scenarios.find((s) => s.key === scenario_key);

/**
 * How many times faster or lighter tsv is than `label` in one CLI scenario, by
 * the given metric — the ratios the page's prose quotes.
 *
 * @returns the ratio, or `undefined` when the scenario, the formatter, or either
 * side's measurement is absent
 */
export const cli_speedup_vs_tsv = (
	scenario_key: string,
	label: string,
	metric: CliMetric
): number | undefined => {
	const results = cli_scenario_find(scenario_key)?.results;
	return results && cli_ratio_vs_tsv(results, label, metric);
};

/**
 * How many times faster or lighter tsv through its npm dispatcher is than `label`
 * in one CLI scenario — the like-for-like ratio, since the other tools are timed
 * through their npm bins too.
 *
 * @returns the ratio, or `undefined` when the scenario, either row, or either
 * side's measurement is absent — an aborted scenario has none
 */
export const cli_speedup_vs_tsv_npm = (
	scenario_key: string,
	label: string,
	metric: CliMetric
): number | undefined => {
	const results = cli_scenario_find(scenario_key)?.results;
	return results && cli_ratio_between(results, label, CLI_TSV_NPM_LABEL, metric);
};

/**
 * The dispatcher row's highest peak RSS across the scenarios that face other
 * tools, in megabytes — the Node launcher's footprint rather than tsv's own.
 *
 * @returns the figure, or `undefined` when no such scenario measured one
 */
export const cli_tsv_npm_memory_mb = (): number | undefined => {
	const peaks = benchmarks_cli.scenarios
		.filter((s) => !s.tsv_only)
		.flatMap((s) => s.results.find((r) => r.label === CLI_TSV_NPM_LABEL)?.memory_mb ?? []);
	return peaks.length ? Math.max(...peaks) : undefined;
};

/**
 * What the npm dispatcher adds over the bare binary in wall-clock, in
 * milliseconds, spanned across every scenario that times both rows — Node
 * starting up to launch the binary, which the page calls a fixed cost.
 *
 * @returns the low and high difference, or `undefined` when no scenario timed both rows
 */
export const cli_tsv_npm_overhead_ms_range = (): { min: number; max: number } | undefined => {
	const overheads = benchmarks_cli.scenarios.flatMap((s) => {
		const npm = s.results.find((r) => r.label === CLI_TSV_NPM_LABEL);
		const tsv = s.results.find((r) => r.label === CLI_TSV_LABEL);
		return npm && tsv ? [npm.wall_ms - tsv.wall_ms] : [];
	});
	if (overheads.length === 0) return undefined;
	return { min: Math.min(...overheads), max: Math.max(...overheads) };
};

/**
 * `label`'s measurement over `baseline_label`'s, by one metric, within a
 * scenario's rows.
 *
 * @returns the ratio, or `undefined` when either row or either side's measurement is
 * absent (a `null` memory figure, or a zero that can't be divided by)
 */
export const cli_ratio_between = (
	results: Array<CliFormatterResult>,
	label: string,
	baseline_label: string,
	metric: CliMetric
): number | undefined => {
	const baseline = results.find((r) => r.label === baseline_label)?.[metric];
	const other = results.find((r) => r.label === label)?.[metric];
	if (baseline == null || other == null || !baseline) return undefined;
	return other / baseline;
};

/**
 * `label`'s measurement over native tsv's, by one metric, within a scenario's
 * rows — the ratio behind both the tables and `cli_speedup_vs_tsv`.
 *
 * @returns the ratio, or `undefined` when either row or either side's measurement is absent
 */
export const cli_ratio_vs_tsv = (
	results: Array<CliFormatterResult>,
	label: string,
	metric: CliMetric
): number | undefined => cli_ratio_between(results, label, CLI_TSV_LABEL, metric);

/**
 * The row a scenario's table takes its ratios against until a reader hovers
 * another one. Facing other tools that is the dispatcher row, the like-for-like
 * footing the page's headline claims lead with; a tsv-only scenario anchors on
 * the native binary, which its other rows are distributions of.
 *
 * @returns the anchor row's label, or `undefined` when the scenario has no tsv
 * row to anchor on — an abort before timing
 */
export const cli_default_anchor_label = (
	scenario: Pick<CliScenario, 'results' | 'tsv_only'>
): string | undefined => {
	const has = (label: string) => scenario.results.some((r) => r.label === label);
	if (!scenario.tsv_only && has(CLI_TSV_NPM_LABEL)) return CLI_TSV_NPM_LABEL;
	return has(CLI_TSV_LABEL) ? CLI_TSV_LABEL : undefined;
};

/**
 * The rows of a scenario a claim about tsv is measured against. Facing other
 * tools, that is the other tools only — a dispatcher row beside them is tsv
 * again, not a competitor. In a tsv-only scenario it is every row but native tsv.
 */
export const cli_comparison_results = (
	scenario: Pick<CliScenario, 'results' | 'tsv_only'>
): Array<CliFormatterResult> =>
	scenario.results.filter((r) =>
		scenario.tsv_only ? r.label !== CLI_TSV_LABEL : !cli_label_is_tsv(r.label)
	);

/**
 * The span of "times less memory than tsv" across `cli_comparison_results`, over one
 * scenario or every scenario that faces other tools — the range claims the
 * page's prose quotes. Unscoped, it skips the tsv-only scenarios, whose rows are
 * tsv's own distributions rather than "every other tool"; name one explicitly to
 * span it. An optional `labels` list narrows the span to just those formatters,
 * so a sentence naming specific tools quotes a range measured over exactly them,
 * and `baseline_label` takes the ratios against the dispatcher row instead of
 * the bare binary.
 *
 * @returns the low and high ratio, or `undefined` when nothing was measured
 */
export const cli_memory_ratio_range = (
	scenario_key?: string,
	labels?: Array<string>,
	baseline_label: string = CLI_TSV_LABEL
): { min: number; max: number } | undefined => {
	const scenarios = benchmarks_cli.scenarios.filter((s) =>
		scenario_key ? s.key === scenario_key : !s.tsv_only
	);
	const ratios = scenarios.flatMap((scenario) =>
		cli_comparison_results(scenario)
			.filter((r) => !labels || labels.includes(r.label))
			.map((r) => cli_ratio_between(scenario.results, r.label, baseline_label, 'memory_mb'))
			.filter((ratio) => ratio !== undefined)
	);
	if (ratios.length === 0) return undefined;
	return { min: Math.min(...ratios), max: Math.max(...ratios) };
};

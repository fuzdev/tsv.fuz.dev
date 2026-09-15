// The independent end-to-end CLI benchmark — a fork of Oxc's official
// `bench-formatter` that adds tsv (https://github.com/ryanatkn/oxc-bench-formatter,
// forked from https://github.com/oxc-project/bench-formatter — `tsv` is the fork's
// DEFAULT branch, so the bare fork URL already lands on it; upstream carries
// neither tsv nor this analysis). Unlike the in-process, single-threaded numbers
// elsewhere on this page, it measures the WHOLE CLI: process spawn, file
// discovery, I/O, and each tool's default multi-file parallelism. tsv, oxfmt, and
// biome parallelize across files while prettier is effectively serial, so the
// wall-clock ratios scale with core count and are machine-dependent — the
// parallelism-neutral view is CPU work (hyperfine `User` time). tsv runs only in
// the JSX-free scenarios (it has no JSX/TSX parser); the Svelte scenario benches
// it against rsvelte-fmt (`@rsvelte/fmt`), the other Rust Svelte-native formatter,
// and the delivery scenario benches tsv against itself — the native binary, the
// same binary through `@fuzdev/tsv`'s Node dispatcher, and `@fuzdev/tsv_wasm`.
// tsv is non-configurable, so in every scenario it appears in, the formatters it
// is compared against are pinned to its fixed style — width 100, tabs, single
// quotes, no trailing commas — and before timing anything the harness asserts that
// every formatter reporting a file count reports the same one.
//
// The numbers come from `benchmarks_formatters.json`, generated from that
// harness's README by `benchmarks_formatters.gen.json.ts`; only the prose below
// is authored here. To refresh: run `pnpm run update-readme` in the harness, then
// `gro gen` here.

import { benchmarks_formatters_json } from './benchmarks_formatters.ts';
import type { FormatterScenario } from './formatter_benchmark_data.ts';

export interface CliFormatterResult {
	/** Display label; `tsv` is the reference row every ratio is computed against. */
	label: string;
	/** hyperfine wall-clock mean, in milliseconds — what you experience typing the command. */
	wall_ms: number;
	/** hyperfine `User` time (total CPU across all threads), in ms — the parallelism-neutral view. */
	cpu_ms: number;
	/** Peak resident set size (RSS), in megabytes; `null` when the harness measured no memory. */
	memory_mb: number | null;
}

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
}

export interface BenchmarksCliReport {
	machine: string;
	versions: Record<string, string>;
	scenarios: Array<CliScenario>;
}

/**
 * The tsv-vs-rsvelte-fmt Svelte scenario's id. The harness publishes it aborted
 * whenever rsvelte-fmt's nondeterministic crash hits its preflight, so prose
 * quoting its ratios must be conditional on them resolving.
 */
export const CLI_SVELTE_KEY = 'svelte-tsv-vs-rsvelte-fmt';

/** The multi-file TypeScript repo scenario's id — what the page's prose calls "the TypeScript repo". */
export const CLI_TS_REPO_KEY = 'typescript-only-non-jsx-subset';

/**
 * The tsv-only delivery scenario's id: the native binary against the same binary
 * through `@fuzdev/tsv`'s Node dispatcher and against `@fuzdev/tsv_wasm`, on one
 * file. It measures what each way of installing tsv costs, not another tool.
 */
export const CLI_DELIVERY_KEY = 'tsv-delivery-paths';

/** The delivery scenario's npm-dispatcher row, as displayed. */
export const CLI_TSV_NPM_LABEL = 'tsv via npm dispatcher';

/** The delivery scenario's WASM row, as displayed. */
export const CLI_TSV_WASM_LABEL = 'tsv_wasm';

/**
 * The prose framing for each scenario, keyed by its generated scenario id — the
 * harness measures the numbers but doesn't explain them. Also fixes the page
 * order, which is by narrative weight (the multi-file repo leads, the tsv-only
 * delivery comparison closes), not the order the harness runs them in. A
 * scenario missing from here is dropped rather than rendered unexplained.
 */
const SCENARIO_COPY: Record<string, Omit<CliScenario, 'key' | 'target' | 'results' | 'aborted'>> = {
	[CLI_TS_REPO_KEY]: {
		heading: 'TypeScript repo',
		description:
			'Every formatter scoped to the same file set and pinned to tsv’s fixed style, so they make the same break decisions over the same files; a preflight check aborts the scenario rather than publish a comparison the tools didn’t run on equal work.',
		tsv_only: false
	},
	'large-single-file': {
		heading: 'Large single file',
		description:
			'With a single input every formatter is effectively single-threaded, so wall-clock is close to an engine comparison here.',
		tsv_only: false
	},
	[CLI_SVELTE_KEY]: {
		heading: 'Svelte corpus',
		description:
			'The two Rust Svelte-native formatters head-to-head on a third-party .svelte corpus, with rsvelte-fmt configured to tsv’s fixed style (width 100, tabs, single quotes) so both do comparable line-break work. rsvelte-fmt 0.7.x crashes nondeterministically on this corpus, so a run either completes or is published aborted, never retried into a clean-looking result.',
		tsv_only: false
	},
	[CLI_DELIVERY_KEY]: {
		heading: 'tsv delivery paths',
		description:
			'Not a comparison with other tools — every row is tsv: the native binary, the same binary reached through @fuzdev/tsv’s Node dispatcher (how npx tsv runs it), and @fuzdev/tsv_wasm, the same CLI over a WASM engine that platforms without a prebuilt binary fall back to. One file, so every row is single-threaded and the gaps are launch and engine cost, not parallelism.',
		tsv_only: true
	}
};

/**
 * Display labels for the harness's hyperfine command names, which read better
 * spaced out in a table. Names absent here are displayed as-is.
 */
export const CLI_LABELS: Record<string, string> = {
	'prettier+oxc-parser': 'prettier + oxc-parser',
	'tsv-npm': CLI_TSV_NPM_LABEL,
	'tsv-wasm': CLI_TSV_WASM_LABEL
};

const to_results = (scenario: FormatterScenario): Array<CliFormatterResult> =>
	scenario.timings
		.map((timing) => ({
			label: CLI_LABELS[timing.name] ?? timing.name,
			wall_ms: timing.mean_ms,
			cpu_ms: timing.user_ms,
			memory_mb: scenario.memory.find((m) => m.name === timing.name)?.mean_mb ?? null
		}))
		.sort((a, b) => a.wall_ms - b.wall_ms);

/**
 * The scenarios the page has prose for; every one must resolve to generated
 * data, timed or aborted — the harness publishes an aborted scenario too.
 */
export const CLI_SCENARIO_KEYS = Object.keys(SCENARIO_COPY);

/**
 * The sentence an aborted scenario shows beside (or in place of) its table. A
 * preflight abort names the fault per formatter in its rows and then only says
 * it is aborting, so the cause is read back off those rows; an abort with every
 * row clean — a memory run that crashed after timing, a scope mismatch — keeps
 * the harness's own wording.
 */
const to_abort_note = (scenario: FormatterScenario): string => {
	const faults = scenario.preflight.flatMap((entry) => {
		const label = CLI_LABELS[entry.name] ?? entry.name;
		if (entry.crashed) return [`${label} crashed partway through its parse check`];
		if (entry.unavailable) return [`${label} could not run`];
		if (entry.rejected > 0) return [`${label} rejected ${entry.rejected} files`];
		return [];
	});
	if (faults.length) return `Not timed: ${faults.join('; ')}.`;
	return scenario.timings.length
		? `Timed, but no memory was published: ${scenario.aborted}.`
		: `Not timed: ${scenario.aborted}.`;
};

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
						...(scenario.aborted === undefined ? null : { aborted: to_abort_note(scenario) })
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
	metric: keyof Omit<CliFormatterResult, 'label'>
): number | undefined => {
	const results = cli_scenario_find(scenario_key)?.results;
	const tsv = results?.find((r) => r.label === 'tsv')?.[metric];
	const other = results?.find((r) => r.label === label)?.[metric];
	if (tsv == null || other == null || !tsv) return undefined;
	return other / tsv;
};

/**
 * The span of "times less memory than tsv" across the non-tsv rows, over one
 * scenario or every scenario that faces other tools — the range claims the
 * page's prose quotes. Unscoped, it skips the tsv-only scenarios, whose rows are
 * tsv's own distributions rather than "every other tool"; name one explicitly to
 * span it. An optional `labels` list narrows the span to just those formatters,
 * so a sentence naming specific tools quotes a range measured over exactly them.
 *
 * @returns the low and high ratio, or `undefined` when nothing was measured
 */
export const cli_memory_ratio_range = (
	scenario_key?: string,
	labels?: Array<string>
): { min: number; max: number } | undefined => {
	const scenarios = benchmarks_cli.scenarios.filter((s) =>
		scenario_key ? s.key === scenario_key : !s.tsv_only
	);
	const ratios = scenarios.flatMap((scenario) =>
		scenario.results
			.filter((r) => r.label !== 'tsv' && (!labels || labels.includes(r.label)))
			.map((r) => cli_speedup_vs_tsv(scenario.key, r.label, 'memory_mb'))
			.filter((ratio) => ratio !== undefined)
	);
	if (ratios.length === 0) return undefined;
	return { min: Math.min(...ratios), max: Math.max(...ratios) };
};

// A snapshot of the independent end-to-end CLI benchmark — a fork of Oxc's official
// `bench-formatter` that adds tsv on its `tsv` branch
// (https://github.com/ryanatkn/oxc-bench-formatter, forked from
// https://github.com/oxc-project/bench-formatter — `tsv` is the fork's DEFAULT
// branch, so the bare fork URL already lands on it; upstream carries neither tsv
// nor this analysis). Unlike the
// in-process, single-threaded numbers elsewhere on this page, it measures the
// WHOLE CLI: process spawn, file discovery, I/O, and each tool's default
// multi-file parallelism. tsv, oxfmt, and biome parallelize across files while
// prettier is effectively serial, so the wall-clock ratios scale with core count
// and are machine-dependent — the parallelism-neutral view is CPU work (hyperfine
// `User` time). tsv runs only in the two JSX-free scenarios (it has no JSX/TSX
// parser). Hand-copied from the linked report; regenerate there with
// `pnpm run update-readme`, then update the numbers below.

export const BENCHMARKS_CLI_SOURCE_URL = 'https://github.com/ryanatkn/oxc-bench-formatter';
export const BENCHMARKS_CLI_UPSTREAM_URL = 'https://github.com/oxc-project/bench-formatter';

export interface CliFormatterResult {
	/** Display label; `tsv` is the reference row every ratio is computed against. */
	label: string;
	/** hyperfine wall-clock mean, in milliseconds — what you experience typing the command. */
	wall_ms: number;
	/** hyperfine `User` time (total CPU across all threads), in ms — the parallelism-neutral view. */
	cpu_ms: number;
	/** Peak resident set size (RSS), in megabytes. */
	memory_mb: number;
}

export interface CliScenario {
	key: string;
	heading: string;
	/** One-line description of the corpus and what makes the comparison fair. */
	description: string;
	/** Whether every formatter is effectively single-threaded here (one input file). */
	single_threaded: boolean;
	/** Results as measured; the component sorts and computes tsv-relative ratios. */
	results: Array<CliFormatterResult>;
}

export interface BenchmarksCliReport {
	source_url: string;
	upstream_url: string;
	machine: string;
	versions: {prettier: string; biome: string; oxfmt: string; tsv: string};
	scenarios: Array<CliScenario>;
}

export const benchmarks_cli: BenchmarksCliReport = {
	source_url: BENCHMARKS_CLI_SOURCE_URL,
	upstream_url: BENCHMARKS_CLI_UPSTREAM_URL,
	machine: 'AMD Ryzen 5 PRO 7530U · 12 threads · linux x64',
	versions: {prettier: '3.9.1', biome: '2.5.1', oxfmt: '0.59.0', tsv: '0.2.0'},
	scenarios: [
		{
			key: 'ts-repo',
			heading: 'TypeScript repo (Outline, non-JSX subset)',
			description:
				"Outline's .ts/.js/.mjs files — the common set every formatter supports, each scoped to it, with a preflight parse check confirming none reject anything. The fair way to put tsv on a real multi-file repo.",
			single_threaded: false,
			results: [
				{label: 'tsv', wall_ms: 120.3, cpu_ms: 854.8, memory_mb: 45.2},
				{label: 'oxfmt', wall_ms: 379.8, cpu_ms: 1826.7, memory_mb: 215.6},
				{label: 'biome', wall_ms: 784.3, cpu_ms: 7285.0, memory_mb: 135.7},
				{label: 'prettier + oxc-parser', wall_ms: 8979, cpu_ms: 11237, memory_mb: 331.4},
				{label: 'prettier', wall_ms: 10911, cpu_ms: 17611, memory_mb: 447.5},
			],
		},
		{
			key: 'large-single-file',
			heading: 'Large single file (TypeScript compiler parser.ts, ~540KB)',
			description:
				'One ~13.7K-line .ts file. With a single input every formatter is effectively single-threaded, so wall-clock is close to an engine comparison here — except oxfmt, which spins up a worker pool it cannot use, inflating its CPU time.',
			single_threaded: true,
			results: [
				{label: 'tsv', wall_ms: 28.8, cpu_ms: 15.2, memory_mb: 23.1},
				{label: 'biome', wall_ms: 138.8, cpu_ms: 107.3, memory_mb: 102.6},
				{label: 'oxfmt', wall_ms: 236.9, cpu_ms: 456.8, memory_mb: 118.0},
				{label: 'prettier + oxc-parser', wall_ms: 503.4, cpu_ms: 751.3, memory_mb: 184.4},
				{label: 'prettier', wall_ms: 1597, cpu_ms: 1583, memory_mb: 303.2},
			],
		},
	],
};

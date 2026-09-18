// Schemas and validation for the formatter comparison benchmark — Prettier,
// Biome, Oxfmt, rsvelte-fmt, and tsv on shared corpora. The harness publishes its
// numbers as `results.json` beside its README: hyperfine's own export plus the
// memory pass and the preflight check, recorded by the functions that print them.
// This module validates that report and keeps the scenarios tsv runs in;
// `benchmarks_formatters.gen.json.ts` writes the result out.

import { z } from 'zod';

/** A single formatter's timing in one scenario. All durations in milliseconds. */
export const FormatterTiming = z.strictObject({
	name: z.string().min(1),
	mean_ms: z.number().positive(),
	/** Zero for a lone run, which has no spread. */
	stddev_ms: z.number().nonnegative(),
	user_ms: z.number().nonnegative(),
	system_ms: z.number().nonnegative(),
	min_ms: z.number().positive(),
	max_ms: z.number().positive()
});
export type FormatterTiming = z.infer<typeof FormatterTiming>;

/** A single formatter's peak-RSS measurement in one scenario. */
export const FormatterMemory = z.strictObject({
	name: z.string().min(1),
	mean_mb: z.number().positive(),
	min_mb: z.number().positive(),
	max_mb: z.number().positive(),
	/**
	 * Ratio to the scenario's baseline formatter (tsv wherever tsv runs); absent on
	 * that row. Below 1 means less memory than the baseline.
	 */
	ratio: z.number().positive().optional(),
	ratio_stddev: z.number().nonnegative().optional()
});
export type FormatterMemory = z.infer<typeof FormatterMemory>;

/** How a scenario's fastest formatter compares to one of the others. */
export const FormatterSpeedup = z.strictObject({
	name: z.string().min(1),
	ratio: z.number().positive(),
	ratio_stddev: z.number().nonnegative()
});
export type FormatterSpeedup = z.infer<typeof FormatterSpeedup>;

/**
 * A formatter's parse-check result over the scenario's corpus. The harness runs
 * this before timing so a tool that rejects files isn't credited for skipping
 * them.
 */
export const FormatterPreflight = z.strictObject({
	name: z.string().min(1),
	/** Files the formatter refused to parse. */
	rejected: z.number().int().nonnegative(),
	/** The formatter's binary never launched, so its timing row is meaningless. */
	unavailable: z.boolean(),
	/** The check pass crashed partway (exit ≥ 128), so its coverage is unknown. */
	crashed: z.boolean()
});
export type FormatterPreflight = z.infer<typeof FormatterPreflight>;

/** One benchmark scenario — a corpus benched across every formatter that supports it. */
export const FormatterScenario = z.strictObject({
	/** Slug of `name`, e.g. `large-single-file` — what the page keys its copy on. */
	id: z.string().min(1),
	name: z.string().min(1),
	/** The corpus, as the harness describes it. */
	target: z.string().min(1),
	/**
	 * The counts the scenario resolved, recorded before anything can abort it. 0 only
	 * in the harness's upstream scenarios when hyperfine itself failed.
	 */
	warmup_runs: z.number().int().nonnegative(),
	benchmark_runs: z.number().int().nonnegative(),
	/** Empty in the harness's upstream scenarios, which run no preflight. */
	preflight: z.array(FormatterPreflight),
	/**
	 * Why the harness stopped early. Before timing (preflight failed) there are no
	 * timings, speedups, or memory rows and the `preflight` entries say which
	 * formatter caused it; after timing (a memory run crashed) timings and speedups
	 * are present and only `memory` is empty.
	 */
	aborted: z.string().min(1).optional(),
	/**
	 * tsv's Node-launched rows that ran as `node <script>` because the harness had
	 * no pnpm bin shim to copy for them — so they skipped the few milliseconds of
	 * shell shim every other tool's row pays. Absent when every row was shimmed.
	 */
	unshimmed: z.array(z.string().min(1)).min(1).optional(),
	timings: z.array(FormatterTiming),
	/**
	 * The fastest timed formatter, and its margin over each other one; `''` when
	 * nothing was timed. Not the memory rows' anchor, which the harness fixes per
	 * scenario and marks by leaving that row without a `ratio`.
	 */
	fastest: z.string(),
	speedups: z.array(FormatterSpeedup),
	/** Empty without GNU time, and when an abort kept the memory pass from finishing. */
	memory: z.array(FormatterMemory)
});
export type FormatterScenario = z.infer<typeof FormatterScenario>;

/**
 * The formatter comparison, as the harness publishes it and as this site commits
 * it. The committed copy holds only the scenarios tsv participates in — it has no
 * JSX/TSX parser, so the harness runs it on the JSX-free corpora only and the
 * other scenarios have no tsv row to compare against.
 */
export const FormatterBenchmarks = z.strictObject({
	/**
	 * The machine the numbers came from. The ratios move with it — Biome, Oxfmt,
	 * and tsv scale across cores while Prettier formats files one at a time.
	 */
	machine: z.string().min(1),
	/**
	 * A bare `node -e ""` timed under hyperfine on the same machine, with the PATH
	 * the scenarios resolve `node` from: the launch floor every npm-bin row pays
	 * before its formatter runs. A machine property beside `machine`, never a row,
	 * so it can't be folded into an "every other tool" range. Absent on reports
	 * from before the harness measured it.
	 */
	node_startup: z
		.strictObject({
			mean_ms: z.number().positive(),
			stddev_ms: z.number().nonnegative(),
			runs: z.number().int().positive()
		})
		.optional(),
	/** Formatter name to version string, e.g. `prettier` to `3.9.1`. */
	versions: z.record(z.string(), z.string().min(1)),
	scenarios: z.array(FormatterScenario)
});
export type FormatterBenchmarks = z.infer<typeof FormatterBenchmarks>;

/** Whether tsv was one of a scenario's formatters, timed or only checked. */
const scenario_has_tsv = (scenario: FormatterScenario): boolean =>
	scenario.timings.some((timing) => timing.name === 'tsv') ||
	(scenario.aborted !== undefined && scenario.preflight.some((p) => p.name === 'tsv'));

/**
 * Validate the harness's `results.json` and keep the scenarios tsv runs in.
 *
 * Throws rather than returning a partial result: a renamed key or a scenario with
 * nothing under it would otherwise strip numbers from the site silently. The
 * caller decides what a MISSING report means (the sibling checkout is optional);
 * everything past that point is a broken contract.
 *
 * @param results - the parsed `results.json`
 * @returns the validated benchmarks, tsv's scenarios only
 * @throws if the report doesn't match `FormatterBenchmarks`, a scenario carries
 * neither timings nor an abort, no scenario timed tsv, or the versions list lacks tsv
 */
export const parse_formatter_benchmarks = (results: unknown): FormatterBenchmarks => {
	const parsed = FormatterBenchmarks.safeParse(results);
	if (!parsed.success) {
		throw new Error(`formatter benchmarks: ${z.prettifyError(parsed.error)}`);
	}
	const { machine, versions, scenarios: all_scenarios } = parsed.data;

	for (const scenario of all_scenarios) {
		// A scenario with no timings either aborted before hyperfine ran — it says so,
		// and its preflight rows name the cause — or recorded nothing it should have.
		if (scenario.timings.length === 0 && scenario.aborted === undefined) {
			throw new Error(`formatter benchmarks: scenario "${scenario.name}" has no timings`);
		}
	}

	// tsv has no JSX/TSX parser, so it sits out some scenarios by design — but if it
	// was timed in NONE of them, either the harness stopped benching tsv or its row
	// was renamed, and the site would render a comparison without its subject.
	const scenarios = all_scenarios.filter(scenario_has_tsv);
	if (!scenarios.some((scenario) => scenario.timings.some((timing) => timing.name === 'tsv'))) {
		throw new Error(
			`formatter benchmarks: no scenario includes a tsv row (found ${all_scenarios
				.map((s) => s.id)
				.join(', ')})`
		);
	}

	if (!versions.tsv) {
		throw new Error('formatter benchmarks: no tsv version in the report');
	}

	return { machine, versions, scenarios };
};

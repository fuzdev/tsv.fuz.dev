import { assert, describe, test } from 'vitest';

import { benchmarks_formatters_json } from '$routes/docs/benchmarks/benchmarks_formatters.ts';
import {
	benchmarks_cli,
	CLI_SCENARIO_KEYS,
	to_abort_note
} from '$routes/docs/benchmarks/benchmarks_cli.ts';
import type {
	FormatterPreflight,
	FormatterScenario,
	FormatterTiming
} from '$routes/docs/benchmarks/formatter_benchmark_data.ts';

// Shape gate for the CLI report `benchmarks_cli.ts` derives from the generated
// `benchmarks_formatters.json`. The generator parses prose, so a drifted heading
// or scenario id in the harness's README would silently drop a scenario or its
// `tsv` reference row and render an empty table rather than fail to typecheck.
describe('benchmarks_cli shape', () => {
	test('every scenario the page has prose for resolved to generated data, in prose order', () => {
		// a copy entry with no matching scenario id drops silently from the table, so
		// every entry must resolve — an aborted scenario resolves too, it just
		// renders its abort note instead of a table
		assert.deepEqual(
			benchmarks_cli.scenarios.map((s) => s.key),
			CLI_SCENARIO_KEYS
		);
	});

	test('every timed scenario carries a tsv reference row with positive metrics', () => {
		assert.isAtLeast(benchmarks_cli.scenarios.length, 1);
		for (const scenario of benchmarks_cli.scenarios) {
			// an aborted scenario carries its note; one aborted before timing has no
			// rows to anchor, one aborted in its memory pass keeps its timed rows
			if (scenario.aborted !== undefined) {
				assert.isNotEmpty(scenario.aborted, `${scenario.key} aborted without a note`);
				if (scenario.results.length === 0) continue;
			}
			// BenchmarksCli anchors every ratio on the tsv row; without it the table is empty
			assert.ok(
				scenario.results.some((r) => r.label === 'tsv'),
				`${scenario.key} is missing its tsv row`
			);
			for (const r of scenario.results) {
				assert.isAbove(r.wall_ms, 0, `${scenario.key}/${r.label} wall_ms`);
				assert.isAbove(r.cpu_ms, 0, `${scenario.key}/${r.label} cpu_ms`);
				// null is legal (a harness run without GNU time measures no memory), 0 is not
				assert.ok(r.memory_mb === null || r.memory_mb > 0, `${scenario.key}/${r.label} memory_mb`);
			}
		}
	});

	test("the derived wall-clock ratios agree with hyperfine's own summary", () => {
		// The generated report carries the harness's own `Summary` ratios beside the
		// raw timings. Recomputing them from the timings and comparing catches a
		// misparse that would otherwise render plausible-but-wrong numbers.
		for (const scenario of benchmarks_formatters_json.scenarios) {
			if (scenario.timings.length === 0) {
				// aborted before timing: no baseline and nothing to cross-check
				assert.isDefined(scenario.aborted, `${scenario.id} has no timings and no abort`);
				assert.isEmpty(scenario.speedups, `${scenario.id} aborted but carries speedups`);
				continue;
			}
			assert.strictEqual(scenario.baseline, 'tsv', `${scenario.id} baseline`);
			// from the raw timings, not the rendered report: the generated data also
			// carries tsv scenarios the page has no copy for, and their numbers must
			// parse just as soundly
			const tsv = scenario.timings.find((t) => t.name === 'tsv');
			assert(tsv, `${scenario.id} has no tsv timing row`);
			for (const speedup of scenario.speedups) {
				const other = scenario.timings.find((t) => t.name === speedup.name);
				assert(other, `${scenario.id}/${speedup.name} has no timing row`);
				const derived = other.mean_ms / tsv.mean_ms;
				// hyperfine derives its summary from full-precision means but prints the
				// timings rounded, so recomputing from the printed numbers lands within a
				// fraction of a percent — wide enough for that, far too tight to hide a
				// misparse (a wrong unit would be off by 1000x)
				assert.closeTo(
					derived,
					speedup.ratio,
					speedup.ratio * 0.01,
					`${scenario.id}/${speedup.name}`
				);
			}
		}
	});

	test('every formatter accepts the whole corpus in every timed scenario, as the page claims', () => {
		// The page's notes say the preflight parse check found nothing rejected, so
		// no formatter is credited for skipping files. That's a claim about the data —
		// for the scenarios that were timed. An aborted one is the harness saying the
		// opposite, and the page shows it as an abort, so its rows are exempt.
		for (const scenario of benchmarks_formatters_json.scenarios) {
			assert.isNotEmpty(scenario.preflight, `${scenario.id} ran no preflight`);
			// aborted before timing — its rows are the fault, shown as such
			if (scenario.timings.length === 0) continue;
			for (const entry of scenario.preflight) {
				assert.isFalse(entry.crashed, `${scenario.id}/${entry.name} crashed during its check`);
				assert.strictEqual(entry.rejected, 0, `${scenario.id}/${entry.name} rejected files`);
				assert.isFalse(entry.unavailable, `${scenario.id}/${entry.name} never launched`);
			}
		}
	});
});

describe('to_abort_note', () => {
	const scenario = (overrides: Partial<FormatterScenario>): FormatterScenario => ({
		id: 'x',
		name: 'x',
		target: '',
		warmup_runs: 1,
		benchmark_runs: 1,
		preflight: [],
		aborted: 'harness said so',
		timings: [],
		baseline: '',
		speedups: [],
		memory: [],
		...overrides
	});
	const preflight = (name: string, overrides: Partial<FormatterPreflight>): FormatterPreflight => ({
		name,
		rejected: 0,
		unavailable: false,
		crashed: false,
		...overrides
	});
	const timing: FormatterTiming = {
		name: 'tsv',
		mean_ms: 1,
		stddev_ms: 0,
		min_ms: 1,
		max_ms: 1,
		user_ms: 1,
		system_ms: 0
	};

	test('a preflight abort names each fault, with display labels', () => {
		assert.strictEqual(
			to_abort_note(
				scenario({
					preflight: [
						preflight('tsv', {}),
						preflight('rsvelte-fmt', { crashed: true }),
						preflight('tsv-npm', { unavailable: true }),
						preflight('biome', { rejected: 3 })
					]
				})
			),
			'Not timed: rsvelte-fmt crashed partway through its parse check; tsv via npm dispatcher could not run; biome rejected 3 files.'
		);
	});

	test('a preflight abort with every row clean keeps the harness wording', () => {
		assert.strictEqual(
			to_abort_note(scenario({ preflight: [preflight('tsv', {})] })),
			'Not timed: harness said so.'
		);
	});

	test('an abort after timing reports only the missing memory, whatever preflight said', () => {
		assert.strictEqual(
			to_abort_note(
				scenario({
					timings: [timing],
					preflight: [preflight('biome', { rejected: 1 })]
				})
			),
			'Timed, but no memory was published: harness said so.'
		);
	});
});

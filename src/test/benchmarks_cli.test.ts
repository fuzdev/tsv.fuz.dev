import { assert, describe, test } from 'vitest';

import { benchmarks_formatters_json } from '$routes/docs/benchmarks/benchmarks_formatters.ts';
import {
	benchmarks_cli,
	cli_comparison_results,
	cli_default_anchor_label,
	cli_label_is_tsv,
	cli_memory_ratio_range,
	cli_ratio_between,
	cli_ratio_vs_tsv,
	cli_settle_seconds,
	CLI_DELIVERY_KEY,
	CLI_SCENARIO_KEYS,
	CLI_SINGLE_FILE_KEY,
	CLI_TSV_LABEL,
	CLI_TSV_NPM_LABEL,
	CLI_TSV_WASM_LABEL,
	to_abort_note,
	to_unshimmed_note,
	type CliFormatterResult
} from '$routes/docs/benchmarks/benchmarks_cli.ts';
import type {
	FormatterPreflight,
	FormatterScenario,
	FormatterTiming
} from '$routes/docs/benchmarks/formatter_benchmark_data.ts';

// Shape gate for the CLI report `benchmarks_cli.ts` derives from the generated
// `benchmarks_formatters.json`. The generator validates the harness's report
// against a schema, which can't know the page's scenario ids: a renamed scenario
// would validate and then silently drop from the page, or lose the `tsv` row its
// table anchors on, rather than fail to typecheck.
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
		// report whose rows and ratios came apart — a unit slip, a mislabeled row —
		// which would otherwise render plausible-but-wrong numbers.
		for (const scenario of benchmarks_formatters_json.scenarios) {
			if (scenario.timings.length === 0) {
				// aborted before timing: no fastest row and nothing to cross-check
				assert.isDefined(scenario.aborted, `${scenario.id} has no timings and no abort`);
				assert.isEmpty(scenario.speedups, `${scenario.id} aborted but carries speedups`);
				continue;
			}
			assert.strictEqual(scenario.fastest, 'tsv', `${scenario.id} fastest`);
			// from the raw timings, not the rendered report: the generated data also
			// carries tsv scenarios the page has no copy for, and their numbers must
			// parse just as soundly
			const tsv = scenario.timings.find((t) => t.name === 'tsv');
			assert(tsv, `${scenario.id} has no tsv timing row`);
			for (const speedup of scenario.speedups) {
				const other = scenario.timings.find((t) => t.name === speedup.name);
				assert(other, `${scenario.id}/${speedup.name} has no timing row`);
				const derived = other.mean_ms / tsv.mean_ms;
				// the harness derives the ratio from full-precision means and records both
				// rounded, so recomputing lands within a fraction of a percent — wide enough
				// for that, far too tight to hide a slip (a wrong unit would be off by 1000x)
				assert.closeTo(
					derived,
					speedup.ratio,
					speedup.ratio * 0.01,
					`${scenario.id}/${speedup.name}`
				);
			}
		}
	});

	test("the derived memory ratios agree with the harness's own", () => {
		// the memory counterpart of the check above: the page derives its ratios from
		// the mean peaks, and the report carries the harness's ratio beside each
		for (const scenario of benchmarks_formatters_json.scenarios) {
			const rows = scenario.memory.filter((m) => m.ratio !== undefined);
			if (rows.length === 0) continue; // no memory pass, or none measured against a baseline
			const tsv = scenario.memory.find((m) => m.name === 'tsv');
			assert(tsv, `${scenario.id} has memory ratios but no tsv row to take them against`);
			assert.notProperty(tsv, 'ratio', `${scenario.id}: the baseline row carries a ratio`);
			for (const row of rows) {
				// the harness divides full-precision means and the report may carry them
				// rounded to a tenth of a megabyte, which moves a ratio by up to ~1%
				assert.closeTo(
					row.mean_mb / tsv.mean_mb,
					row.ratio!,
					row.ratio! * 0.02,
					`${scenario.id}/${row.name}`
				);
			}
		}
	});

	test('the two scenarios that time tsv on the same file agree', () => {
		// the delivery and large-single-file scenarios run the bare binary and the
		// dispatcher over the same parser.ts in separate hyperfine sessions, so their
		// means are one measurement taken twice — a gap between them is the run-to-run
		// noise every ratio on the page carries, and a wide one says to re-run
		const rows = (key: string) => {
			const scenario = benchmarks_cli.scenarios.find((s) => s.key === key);
			assert(scenario, `no generated scenario has id "${key}"`);
			return scenario;
		};
		const delivery = rows(CLI_DELIVERY_KEY);
		const single = rows(CLI_SINGLE_FILE_KEY);
		assert.strictEqual(delivery.target.split(',')[0], single.target, 'same corpus file');
		for (const label of [CLI_TSV_LABEL, CLI_TSV_NPM_LABEL]) {
			const a = delivery.results.find((r) => r.label === label);
			const b = single.results.find((r) => r.label === label);
			assert(a && b, `${label} is missing from one of the two scenarios`);
			assert.closeTo(a.wall_ms, b.wall_ms, b.wall_ms * 0.1, `${label} wall_ms`);
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

describe('cli_settle_seconds', () => {
	test("the settle the run-order note quotes is every rendered scenario's", () => {
		// the note says the harness idles before "each formatter's warmups" without
		// naming a scenario, so one figure has to hold for all of them; a report that
		// records none, or a run that turned it off, quotes nothing
		const settle = cli_settle_seconds();
		if (settle === undefined) return;
		assert.isAbove(settle, 0);
		for (const scenario of benchmarks_cli.scenarios) {
			assert.strictEqual(scenario.settle_seconds, settle, scenario.key);
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
		fastest: '',
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

describe('cli ratios over a scenario with two tsv rows', () => {
	const result = (
		label: string,
		wall_ms: number,
		memory_mb: number | null
	): CliFormatterResult => ({
		label,
		wall_ms,
		cpu_ms: wall_ms,
		memory_mb
	});
	const results = [
		result('tsv', 20, 10),
		result(CLI_TSV_NPM_LABEL, 50, 40),
		result('oxfmt', 60, 100),
		result('biome', 100, null)
	];

	test('a dispatcher row beside other tools is not one of them', () => {
		assert.deepEqual(
			cli_comparison_results({ results, tsv_only: false }).map((r) => r.label),
			['oxfmt', 'biome']
		);
	});

	test('a tsv distribution the harness adds later is still tsv, by prefix', () => {
		// a closed label set would admit a new `tsv-*` row as a competitor, and the
		// "less memory than every other tool" ranges would quietly span it
		for (const label of [CLI_TSV_LABEL, CLI_TSV_NPM_LABEL, CLI_TSV_WASM_LABEL, 'tsv-bun']) {
			assert.isTrue(cli_label_is_tsv(label), label);
		}
		for (const label of ['oxfmt', 'biome', 'rsvelte-fmt', 'tsvelte', 'prettier + oxc-parser']) {
			assert.isFalse(cli_label_is_tsv(label), label);
		}
		assert.deepEqual(
			cli_comparison_results({
				results: [...results, result('tsv-bun', 30, 20)],
				tsv_only: false
			}).map((r) => r.label),
			['oxfmt', 'biome']
		);
	});

	test('a tsv-only scenario compares native tsv with its own distributions', () => {
		const delivery = [result('tsv', 20, 10), results[1]!, result(CLI_TSV_WASM_LABEL, 160, 120)];
		assert.deepEqual(
			cli_comparison_results({ results: delivery, tsv_only: true }).map((r) => r.label),
			[CLI_TSV_NPM_LABEL, CLI_TSV_WASM_LABEL]
		);
	});

	test('ratios anchor on whichever tsv row is named', () => {
		assert.strictEqual(cli_ratio_vs_tsv(results, 'oxfmt', 'wall_ms'), 3);
		assert.strictEqual(cli_ratio_between(results, 'oxfmt', CLI_TSV_NPM_LABEL, 'wall_ms'), 1.2);
		assert.strictEqual(cli_ratio_between(results, 'oxfmt', CLI_TSV_NPM_LABEL, 'memory_mb'), 2.5);
	});

	test('a missing row or measurement has no ratio', () => {
		assert.isUndefined(cli_ratio_between(results, 'prettier', CLI_TSV_NPM_LABEL, 'wall_ms'));
		assert.isUndefined(cli_ratio_between(results, 'biome', CLI_TSV_NPM_LABEL, 'memory_mb'));
		// the baseline row itself missing
		const without_npm = results.filter((r) => r.label !== CLI_TSV_NPM_LABEL);
		assert.isUndefined(cli_ratio_between(without_npm, 'oxfmt', CLI_TSV_NPM_LABEL, 'wall_ms'));
	});
});

describe('cli_memory_ratio_range', () => {
	test('a named tool missing from a spanned scenario voids the range rather than narrowing it', () => {
		// the TLDR's "less memory than either" names two tools; a renamed row must not
		// leave the sentence quoting a range measured over one
		const key = CLI_SINGLE_FILE_KEY;
		assert.isDefined(cli_memory_ratio_range(key, ['oxfmt', 'biome']));
		assert.isUndefined(cli_memory_ratio_range(key, ['oxfmt', 'biome-renamed']));
		assert.isUndefined(cli_memory_ratio_range(key, ['oxfmt'], 'tsv-renamed'));
	});
});

describe('cli_default_anchor_label', () => {
	const row = (label: string) => ({ label, wall_ms: 1, cpu_ms: 1, memory_mb: 1 });

	test('facing other tools, the dispatcher row is the like-for-like anchor', () => {
		const results = [row('oxfmt'), row(CLI_TSV_NPM_LABEL), row(CLI_TSV_LABEL)];
		assert.strictEqual(cli_default_anchor_label({ results, tsv_only: false }), CLI_TSV_NPM_LABEL);
	});

	test('a tsv-only scenario anchors on the native binary its rows are distributions of', () => {
		const results = [row(CLI_TSV_WASM_LABEL), row(CLI_TSV_NPM_LABEL), row(CLI_TSV_LABEL)];
		assert.strictEqual(cli_default_anchor_label({ results, tsv_only: true }), CLI_TSV_LABEL);
	});

	test('without a dispatcher row it falls back to native tsv, and without tsv to nothing', () => {
		assert.strictEqual(
			cli_default_anchor_label({ results: [row('oxfmt'), row(CLI_TSV_LABEL)], tsv_only: false }),
			CLI_TSV_LABEL
		);
		assert.isUndefined(cli_default_anchor_label({ results: [], tsv_only: false }));
	});

	test('every rendered scenario the report timed has an anchor', () => {
		for (const scenario of benchmarks_cli.scenarios) {
			if (scenario.results.length === 0) continue; // aborted before timing
			assert.strictEqual(
				cli_default_anchor_label(scenario),
				scenario.tsv_only ? CLI_TSV_LABEL : CLI_TSV_NPM_LABEL,
				scenario.key
			);
		}
	});
});

describe('to_unshimmed_note', () => {
	test('names the rows by their display labels', () => {
		assert.strictEqual(
			to_unshimmed_note(['tsv-npm', 'tsv-wasm']),
			'tsv via npm dispatcher and tsv-wasm ran as a bare Node script, skipping the few milliseconds of pnpm bin shim the other tools’ rows go through.'
		);
	});
});

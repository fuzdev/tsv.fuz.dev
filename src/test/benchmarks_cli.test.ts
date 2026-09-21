import { assert, describe, test } from 'vitest';

import {
	cli_comparison_results,
	cli_default_anchor_label,
	cli_label_is_tsv,
	cli_ratio_between,
	CLI_TSV_LABEL,
	CLI_TSV_NPM_LABEL,
	CLI_TSV_WASM_LABEL,
	to_abort_note,
	to_unshimmed_note,
	type CliFormatterResult
} from '$routes/docs/benchmarks/benchmarks_cli.ts';
import type { FormatterScenario } from '$routes/docs/benchmarks/formatter_benchmark_data.ts';

import {
	create_formatter_preflight,
	create_formatter_scenario,
	create_formatter_timing
} from './benchmark_test_helpers.ts';

describe('to_abort_note', () => {
	// aborted before timing, until a test gives it rows
	const scenario = (overrides: Partial<FormatterScenario>): FormatterScenario =>
		create_formatter_scenario({
			preflight: [],
			aborted: 'harness said so',
			timings: [],
			fastest: '',
			speedups: [],
			memory: [],
			...overrides
		});
	const preflight = create_formatter_preflight;
	const timing = create_formatter_timing('tsv', 1);

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
		assert.strictEqual(cli_ratio_between(results, 'oxfmt', CLI_TSV_LABEL, 'wall_ms'), 3);
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
});

describe('to_unshimmed_note', () => {
	test('names the rows by their display labels', () => {
		assert.strictEqual(
			to_unshimmed_note(['tsv-npm', 'tsv-wasm']),
			'tsv via npm dispatcher and tsv-wasm ran as a bare Node script, skipping the few milliseconds of pnpm bin shim the other tools’ rows go through.'
		);
	});
});

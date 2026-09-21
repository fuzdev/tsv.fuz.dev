import { assert, describe, test } from 'vitest';

import { benchmarks_json } from '$routes/docs/benchmarks/benchmarks.ts';
import {
	derive_conformance_groups,
	format_coverage_percent
} from '$routes/docs/benchmarks/benchmark_conformance.ts';
import type { BaselineEntry } from '$routes/docs/benchmarks/benchmark_data.ts';

const entry = (overrides: Partial<BaselineEntry>): BaselineEntry => ({
	name: 'x',
	group: 'format/css',
	mean_ns: 1,
	p50_ns: 1,
	p75_ns: 1,
	p90_ns: 1,
	p95_ns: 1,
	p99_ns: 1,
	min_ns: 1,
	max_ns: 1,
	std_dev_ns: 0,
	cv: 0.01,
	ops_per_second: 1,
	sample_size: 100,
	cv_raw: 0.01,
	drift: 0,
	raw_sample_size: 100,
	...overrides
});

describe('derive_conformance_groups', () => {
	const coverage = (name: string, group: string, processed: number | null, total: number | null) =>
		entry({ name, group, files_processed: processed, files_total: total });

	test('rows sort by coverage, under the engine name, with their note', () => {
		const [group, ...rest] = derive_conformance_groups({
			...benchmarks_json,
			entries: [
				coverage('tsv-json', 'parse/typescript', 90, 100),
				coverage('tsc', 'parse/typescript', 95, 100),
				// a second binding of an engine, a format row, and a row without counts all drop
				coverage('tsv-wasm-json', 'parse/typescript', 90, 100),
				coverage('prettier', 'format/typescript', 100, 100),
				coverage('oxc-parser', 'parse/typescript', null, null)
			]
		});
		assert.isEmpty(rest);
		assert(group, 'typescript conformance group missing');
		assert.strictEqual(group.language, 'typescript');
		assert.strictEqual(group.files_total, 100);
		assert.deepEqual(
			group.rows.map((r) => [r.name, r.coverage_fraction]),
			[
				['tsc', 0.95],
				['tsv', 0.9]
			]
		);
		assert.isDefined(group.rows[0]?.note);
	});

	test('an empty corpus is zero coverage, not NaN', () => {
		const [group] = derive_conformance_groups({
			...benchmarks_json,
			entries: [coverage('tsv-json', 'parse/css', 0, 0)]
		});
		assert.strictEqual(group?.rows[0]?.coverage_fraction, 0);
	});
});

describe('format_coverage_percent', () => {
	test('floors — only exact totality reads 100%', () => {
		// 44219/44220 rounds to 100.00% but must not display as it: floor, so a
		// visibly non-total count never sits beside a "100.00%" label.
		assert.strictEqual(format_coverage_percent(44_219 / 44_220), '99.99%');
		assert.strictEqual(format_coverage_percent(1), '100.00%');
		assert.strictEqual(format_coverage_percent(0.998549), '99.85%');
		assert.strictEqual(format_coverage_percent(0), '0.00%');
	});
});

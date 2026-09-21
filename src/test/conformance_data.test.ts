import { assert, describe, test } from 'vitest';

import { derive_conformance_groups } from '$routes/docs/conformance/conformance_data.ts';

import { create_baseline, create_baseline_entry } from './benchmark_test_helpers.ts';

const entry = create_baseline_entry;

describe('derive_conformance_groups', () => {
	const coverage = (name: string, group: string, processed: number | null, total: number | null) =>
		entry({ name, group, files_processed: processed, files_total: total });

	test('rows sort by coverage, under the engine name, with their note', () => {
		const [group, ...rest] = derive_conformance_groups(
			create_baseline({
				entries: [
					coverage('tsv-json', 'parse/typescript', 90, 100),
					coverage('tsc', 'parse/typescript', 95, 100),
					// a second binding of an engine, a format row, and a row without counts all drop
					coverage('tsv-wasm-json', 'parse/typescript', 90, 100),
					coverage('prettier', 'format/typescript', 100, 100),
					coverage('oxc-parser', 'parse/typescript', null, null)
				]
			})
		);
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
		const [group] = derive_conformance_groups(
			create_baseline({
				entries: [coverage('tsv-json', 'parse/css', 0, 0)]
			})
		);
		assert.strictEqual(group?.rows[0]?.coverage_fraction, 0);
	});
});

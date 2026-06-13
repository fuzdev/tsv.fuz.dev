import {assert, describe, test} from 'vitest';

import {benchmarks_json} from '../routes/docs/benchmarks/benchmarks.js';
import {
	derive_benchmark_groups,
	derive_speedup_summary,
} from '../routes/docs/benchmarks/benchmark_data.js';

// Shape gate for the committed benchmarks.json: the bench report format drifts
// (it once went 3 months stale across a key rename that rendered as `undefined`),
// and `benchmarks.ts` casts the JSON, so typechecking alone won't catch it.
// When `npm run update-benchmarks` pulls in a new shape, these fail loudly.
describe('benchmarks.json shape', () => {
	test('baseline version is current', () => {
		assert.isAtLeast(benchmarks_json.version, 4);
	});

	test('binary sizes include the ratio anchors', () => {
		const labels = benchmarks_json.binary_sizes.map((s) => s.label);
		assert.include(labels, 'tsv (native)'); // native anchor
		assert.include(labels, 'tsv_wasm'); // wasm anchor (the full build)
	});

	test('versions carries the keys the meta component renders', () => {
		const {versions} = benchmarks_json;
		assert.isString(versions.svelte);
		assert.isString(versions.acorn_ts);
		assert.isString(versions.prettier);
		assert.isString(versions.prettier_svelte);
	});

	test('corpus covers every benchmarked language', () => {
		for (const language of ['svelte', 'typescript', 'css']) {
			assert.isAbove(benchmarks_json.corpus[language] ?? 0, 0, language);
		}
	});

	test('every group derives a canonical entry and a timed-set count', () => {
		const groups = derive_benchmark_groups(benchmarks_json);
		assert.isAtLeast(groups.length, 6); // format+parse × svelte/typescript/css
		for (const group of groups) {
			const key = `${group.operation}/${group.language}`;
			assert.ok(group.canonical_entry, `${key} has no canonical entry`);
			assert.isNotNull(group.files_iterated, `${key} has no files_iterated`);
		}
	});

	test('speedup summary is fully populated', () => {
		const rows = derive_speedup_summary(derive_benchmark_groups(benchmarks_json));
		assert.strictEqual(rows.length, 2); // native + wasm
		for (const row of rows) {
			assert.isDefined(row.format_svelte, row.variant);
			assert.isDefined(row.format_typescript, row.variant);
			assert.isDefined(row.format_css, row.variant);
		}
	});
});

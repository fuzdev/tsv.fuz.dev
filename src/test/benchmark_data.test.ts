import {assert, describe, test} from 'vitest';

import {benchmarks_json} from '$routes/docs/benchmarks/benchmarks.ts';
import {benchmarks_cross_runtime_json} from '$routes/docs/benchmarks/benchmarks_cross_runtime.ts';
import {
	derive_benchmark_groups,
	derive_cross_runtime_groups,
	derive_speedup_summary,
} from '$routes/docs/benchmarks/benchmark_data.ts';

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
		assert.include(labels, 'tsv (napi)'); // native anchor (flagship N-API build)
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

	test('flagship report is the node runtime', () => {
		// the headline detailed view switched to N-API under Node; guards against an
		// `update-benchmarks` that pulls the wrong runtime's sibling report
		assert.strictEqual((benchmarks_json as {runtime?: string}).runtime, 'node');
	});
});

// Shape gate for the committed cross-runtime `benchmarks_cross_runtime.json` (the
// bench composer's combined `report.json`) — a different, slimmer shape than the
// per-runtime baseline, consumed by the Cross-runtime section.
describe('benchmarks_cross_runtime.json shape', () => {
	test('combined report carries the current version and kind', () => {
		assert.isAtLeast(benchmarks_cross_runtime_json.version, 5);
		assert.strictEqual(benchmarks_cross_runtime_json.kind, 'combined');
	});

	test('runtimes include the flagship and its cross-runtime peers', () => {
		const {runtimes} = benchmarks_cross_runtime_json;
		assert.include(runtimes, 'node'); // the flagship the headline view leads with
		assert.include(runtimes, 'deno');
		assert.include(runtimes, 'bun');
	});

	test('every group derives rows with the flagship runtime populated', () => {
		const groups = derive_cross_runtime_groups(benchmarks_cross_runtime_json);
		assert.isAtLeast(groups.length, 6); // format+parse × svelte/typescript/css
		for (const group of groups) {
			assert.isAbove(group.rows.length, 0, group.group);
			for (const row of group.rows) {
				assert.isNumber(row.ops_per_second.node, `${group.group}/${row.name} missing node ops`);
			}
		}
	});
});

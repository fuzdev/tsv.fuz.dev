import { assert, describe, test } from 'vitest';

import {
	derive_conformance_groups,
	derive_conformance_matrices
} from '$routes/docs/conformance/conformance_data.ts';

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
					coverage('yuku-parser-wasm', 'parse/typescript', 95, 100),
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
				['yuku-parser', 0.95],
				['tsv', 0.9]
			]
		);
		assert.strictEqual(group.rows[0]?.note, 'wasm');
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

describe('derive_conformance_matrices', () => {
	const TS_REPO = 'benches/js/.cache/ts_repo_files.json';
	const cell = (processed: number, total: number) => ({ processed, total });
	const coverage = (name: string, group: string, processed: number, total: number) =>
		entry({ name, group, files_processed: processed, files_total: total });

	const typescript_baseline = (sources: Record<string, Record<string, ReturnType<typeof cell>>>) =>
		create_baseline({
			corpus: { svelte: 0, typescript: 100, css: 0 },
			entries: [
				coverage('tsv-json', 'parse/typescript', 97, 100),
				coverage('tsv-wasm-json', 'parse/typescript', 97, 100),
				coverage('tsc', 'parse/typescript', 98, 100)
			],
			corpus_sources: [
				{
					path: TS_REPO,
					files: 60,
					repo: {
						url: 'https://github.com/microsoft/TypeScript',
						slug: 'microsoft/TypeScript',
						commit: '',
						subpath: ''
					}
				}
			],
			coverage_by_source: { 'parse/typescript': sources }
		});

	test('a row per source, largest first, with engine-folded cells and the selector flagged', () => {
		const [matrix, ...rest] = derive_conformance_matrices(
			typescript_baseline({
				'../unknown/source': {
					'tsv-json': cell(27, 30),
					'tsv-wasm-json': cell(27, 30),
					tsc: cell(29, 30)
				},
				[TS_REPO]: { 'tsv-json': cell(59, 60), 'tsv-wasm-json': cell(59, 60), tsc: cell(60, 60) }
			})
		);
		assert.isEmpty(rest);
		assert(matrix, 'typescript matrix missing');
		assert.deepEqual(
			matrix.engines.map((e) => e.name),
			['tsc', 'tsv']
		);
		assert.deepEqual(
			matrix.aggregate.map((c) => [c.processed, c.rejected, c.selected]),
			[
				[98, 2, false],
				[97, 3, false]
			]
		);
		const [ts_repo, unknown] = matrix.sources;
		assert(ts_repo && unknown, 'two source rows');
		assert.deepEqual(ts_repo.origins, [
			{
				path: TS_REPO,
				label: "TypeScript compiler's cases",
				url: 'https://github.com/microsoft/TypeScript'
			}
		]);
		assert.strictEqual(ts_repo.files, 60);
		// tsc selected its compiler's cases, so its full cell is construction; tsv's is a result
		assert.deepEqual(
			ts_repo.cells.map((c) => [c?.rejected, c?.selected]),
			[
				[0, true],
				[1, false]
			]
		);
		// a path without a label or a corpus source still gets its row
		assert.deepEqual(unknown.origins, [
			{ path: '../unknown/source', label: undefined, url: undefined }
		]);
		assert.strictEqual(unknown.cells[1]?.coverage_fraction, 0.9);
	});

	test('two or more sources every engine accepts in full fold into one trailing row', () => {
		const full = { 'tsv-json': cell(5, 5), tsc: cell(5, 5) };
		const [matrix] = derive_conformance_matrices(
			typescript_baseline({
				'../a': full,
				'../b': { 'tsv-json': cell(20, 20), tsc: cell(20, 20) },
				'../c': { 'tsv-json': cell(1, 2), tsc: cell(2, 2) }
			})
		);
		assert(matrix);
		assert.deepEqual(
			matrix.sources.map((s) => [s.origins.map((o) => o.path), s.folded, s.files]),
			[
				[['../c'], false, 2],
				[['../a', '../b'], true, 25]
			]
		);
		assert.deepEqual(
			matrix.sources[1]?.cells.map((c) => [c?.processed, c?.total]),
			[
				[25, 25],
				[25, 25]
			]
		);
	});

	test('a lone all-accepted source, or one its engine selected, keeps its own row', () => {
		const [lone] = derive_conformance_matrices(
			typescript_baseline({
				'../a': { 'tsv-json': cell(5, 5), tsc: cell(5, 5) },
				[TS_REPO]: { 'tsv-json': cell(60, 60), tsc: cell(60, 60) }
			})
		);
		assert.deepEqual(
			lone?.sources.map((s) => s.folded),
			[false, false]
		);
	});

	test('an engine that selected every source flags the aggregate too', () => {
		const [matrix] = derive_conformance_matrices(
			create_baseline({
				entries: [
					coverage('svelte/compiler', 'parse/svelte', 5, 5),
					coverage('tsv-json', 'parse/svelte', 4, 5)
				],
				coverage_by_source: {
					'parse/svelte': { '../a': { 'svelte/compiler': cell(5, 5), 'tsv-json': cell(4, 5) } }
				}
			})
		);
		assert.deepEqual(
			matrix?.engines.map((e, i) => [e.name, matrix.aggregate[i]?.selected]),
			[
				['svelte/compiler', true],
				['tsv', false]
			]
		);
	});

	test('a report without per-source coverage keeps its aggregate', () => {
		const [matrix] = derive_conformance_matrices(
			create_baseline({ entries: [coverage('tsv-json', 'parse/css', 4, 5)] })
		);
		assert.isEmpty(matrix?.sources);
		assert.strictEqual(matrix?.aggregate[0]?.rejected, 1);
	});
});

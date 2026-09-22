import { assert, describe, test } from 'vitest';

import { conformance_json } from '$routes/docs/conformance/conformance.ts';
import {
	CONFORMANCE_SELECTORS,
	derive_conformance_groups,
	derive_conformance_matrices
} from '$routes/docs/conformance/conformance_data.ts';

import { REPORT_VERSION } from './benchmark_test_helpers.ts';

// Shape gate for the committed conformance report `conformance.json`
// (tsv's `report.conformance.node.json` — the parse-coverage surface over the
// deliberately-hard fixture suites, disjoint from the perf corpus, Svelte set minus
// canonical-rejects), consumed by the Parse conformance section.
describe('conformance.json shape', () => {
	test('report is the conformance surface at the current version', () => {
		assert.strictEqual(conformance_json.version, REPORT_VERSION);
		assert.strictEqual(conformance_json.corpus_kind, 'conformance');
		assert.strictEqual(conformance_json.runtime, 'node');
	});

	test('conformance report is parse-only', () => {
		for (const entry of conformance_json.entries) {
			assert.match(entry.group, /^parse\//, `${entry.group}/${entry.name}`);
		}
	});

	test('every impl loaded, and no byte-graded pair disagreed on output', () => {
		// an accept-set disagreement between two bindings of one engine is legitimate
		// here (oxc-parser's pinned-older wasm binding — the prose test bounds it), but a
		// byte mismatch between tsv's own native and wasm rows contradicts the section's
		// "byte-identical output" claim, and a load failure silently drops a coverage row
		assert.deepStrictEqual(conformance_json.unavailable, []);
		for (const finding of conformance_json.variant_parity ?? []) {
			assert.strictEqual(finding.output_mismatch ?? 0, 0, `${finding.group}/${finding.impl}`);
		}
	});

	test('every impl of a per-source slice reports the same slice total', () => {
		// a source row's file count and share are read off its impls' shared total
		const by_group = Object.entries(conformance_json.coverage_by_source ?? {});
		assert.isNotEmpty(by_group, 'the report carries no coverage_by_source');
		for (const [group, sources] of by_group) {
			for (const [source, by_impl] of Object.entries(sources)) {
				const totals = new Set(Object.values(by_impl).map((cell) => cell.total));
				assert.strictEqual(totals.size, 1, `${group} ${source}: ${[...totals].join(', ')}`);
			}
		}
	});

	test('corpus sources disclose the composition', () => {
		assert.isNotEmpty(conformance_json.corpus_sources ?? []);
	});

	test('derives one coverage group per language, each with a tsv row and full coverage data', () => {
		const groups = derive_conformance_groups(conformance_json);
		assert.strictEqual(groups.length, 3); // svelte / typescript / css
		assert.deepEqual(
			groups.map((g) => g.language),
			['svelte', 'typescript', 'css']
		);
		for (const group of groups) {
			assert.ok(
				group.rows.some((r) => r.name === 'tsv'),
				`${group.language} has a tsv row`
			);
			// rows are ordered by coverage, highest first
			const fractions = group.rows.map((r) => r.coverage_fraction);
			assert.deepEqual(
				fractions,
				[...fractions].toSorted((a, b) => b - a),
				`${group.language} rows descend by coverage`
			);
			for (const row of group.rows) {
				assert.isAbove(row.files_total, 0, `${group.language}/${row.name} total`);
				// the group header is the max across rows, which reads as the language's
				// total only while every row saw the same corpus
				assert.strictEqual(row.files_total, group.files_total, `${group.language}/${row.name}`);
				assert.isAtLeast(row.coverage_fraction, 0);
				assert.isAtMost(row.coverage_fraction, 1);
				// engine-level rows only — binding/materialization variants are folded
				assert.notMatch(row.name, /-internal|wasm-|-wasm/, `${group.language}/${row.name}`);
			}
		}
	});

	test('every engine the report carries reaches a coverage row', () => {
		// The rows are keyed by ONE entry name per engine (`CONFORMANCE_ENGINE_NAMES`),
		// so a harness that renames or re-picks a binding — yuku's native row
		// returning, oxc's wasi pin rejoining — would drop an engine from the table
		// without a type error. Fold each entry to its engine by stripping the
		// binding/materialization suffixes and hold the row count to that set.
		const to_engine = (name: string) =>
			name.replace(/-(wasm|json|no-locations|internal|skip-expr-loc)/g, '');
		const groups = derive_conformance_groups(conformance_json);
		for (const group of groups) {
			const engines = new Set(
				conformance_json.entries
					.filter((e) => e.group === `parse/${group.language}`)
					.map((e) => to_engine(e.name))
			);
			assert.strictEqual(
				group.rows.length,
				engines.size,
				`${group.language}: rows for ${[...engines].join(', ')}`
			);
		}
	});

	test('yuku reaches the typescript coverage group through its wasm binding', () => {
		// The conformance report carries no yuku native row — that binding crashes the
		// host process on this corpus, so tsv's harness omits it — and the page's note
		// about it is unconditional. If the row name ever changes, the engine would
		// silently vanish from the table instead of failing here.
		const groups = derive_conformance_groups(conformance_json);
		const ts = groups.find((g) => g.language === 'typescript');
		const yuku = ts?.rows.find((r) => r.name === 'yuku-parser');
		assert.ok(yuku, 'typescript coverage must carry a yuku-parser row');
		// the row's own qualifier, so the table says which binding without the
		// reader having to reach the note below it
		assert.strictEqual(yuku.note, 'wasm');
	});

	test('tsc reaches the typescript coverage group, and only it', () => {
		// tsc parses TypeScript/JS alone and rides this surface only (it is a verdict,
		// not a speed)
		const groups = derive_conformance_groups(conformance_json);
		const row_named = (language: string) =>
			groups.find((g) => g.language === language)?.rows.find((r) => r.name === 'tsc');
		assert.ok(row_named('typescript'), 'typescript coverage must carry a tsc row');
		assert.isUndefined(row_named('svelte'), 'tsc parses no Svelte');
		assert.isUndefined(row_named('css'), 'tsc parses no CSS');
	});
});

describe('conformance matrices over the committed report', () => {
	const matrices = derive_conformance_matrices(conformance_json);

	test('every source row is labeled, linked, and counted as the corpus sources count it', () => {
		for (const matrix of matrices) {
			assert.isNotEmpty(matrix.sources, matrix.language);
			for (const source of matrix.sources) {
				for (const origin of source.origins) {
					// a raw cache path must not reach readers
					assert.isDefined(origin.label, `${matrix.language} ${origin.path} has no label`);
					assert.isDefined(origin.url, `${matrix.language} ${origin.path} has no link`);
				}
				const counted = source.origins.reduce((sum, origin) => {
					const corpus_source = conformance_json.corpus_sources.find((s) => s.path === origin.path);
					return sum + (corpus_source?.by_language?.[matrix.language] ?? 0);
				}, 0);
				assert.strictEqual(source.files, counted, `${matrix.language} ${source.origins[0]?.path}`);
			}
		}
	});

	test("each engine's source cells sum to its aggregate", () => {
		// the rows are the aggregate unblended, so a source the matrix dropped or an
		// engine keyed to a different binding than the aggregate's shows up here
		for (const matrix of matrices) {
			for (const [i, engine] of matrix.engines.entries()) {
				const cells = matrix.sources.map((s) => s.cells[i]);
				const sum = (key: 'processed' | 'total') =>
					cells.reduce((total, cell) => total + (cell?.[key] ?? NaN), 0);
				const id = `${matrix.language}/${engine.name}`;
				assert.strictEqual(sum('processed'), matrix.aggregate[i]?.processed, id);
				assert.strictEqual(sum('total'), matrix.aggregate[i]?.total, id);
			}
		}
	});

	test('every hand-stated selector resolves, and reads 100% on what it selected', () => {
		for (const [group_key, by_source] of Object.entries(CONFORMANCE_SELECTORS)) {
			const matrix = matrices.find((m) => `parse/${m.language}` === group_key);
			assert(matrix, `${group_key} is missing`);
			for (const [path, engine_name] of Object.entries(by_source)) {
				const i = matrix.engines.findIndex((e) => e.name === engine_name);
				assert.isAtLeast(i, 0, `${group_key}: no ${engine_name} column`);
				const rows =
					path === '*'
						? matrix.sources
						: matrix.sources.filter((s) => s.origins.some((o) => o.path === path));
				assert.isNotEmpty(rows, `${group_key}: no ${path} row`);
				for (const row of rows) {
					const cell = row.cells[i];
					assert(cell?.selected, `${group_key} ${path}: ${engine_name} is not flagged`);
					assert.strictEqual(cell.rejected, 0, `${engine_name} no longer reads 100% on its slice`);
				}
			}
		}
	});

	test('only the sources every parser accepts in full are folded', () => {
		// the folded row's label says so. Whether the committed report folds at all is
		// the data's to decide (a fold needs two fully-accepted sources in one matrix,
		// and the TypeScript matrix has one since Prettier's CSS suite stopped carrying
		// its harness files), so the fold itself is pinned on synthetic rows in
		// `conformance_data.test.ts`; this gate holds the invariant over any fold present
		const folded = matrices.flatMap((m) => m.sources.filter((s) => s.folded));
		for (const row of folded) {
			assert.isNotEmpty(row.cells);
			for (const cell of row.cells) assert.strictEqual(cell?.rejected, 0);
		}
	});
});

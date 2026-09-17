import { assert, describe, test } from 'vitest';

import {
	cross_runtime_ratio_background,
	derive_cross_runtime_groups,
	derive_runtime_versions,
	derive_unavailable_by_runtime,
	derive_unstable_cells,
	format_cross_runtime_label,
	is_impl_unavailable,
	order_cross_runtime_runtimes,
	type BenchmarkRuntime,
	type CrossRuntimeReport,
	type UnstableCell
} from '$routes/docs/benchmarks/benchmark_cross_runtime.ts';

describe('order_cross_runtime_runtimes', () => {
	test('reorders the report storage order to node-first display order', () => {
		assert.deepStrictEqual(order_cross_runtime_runtimes(['deno', 'node', 'bun']), [
			'node',
			'deno',
			'bun'
		]);
	});

	test('anchors on the next runtime in display order when node is absent', () => {
		assert.deepStrictEqual(order_cross_runtime_runtimes(['bun', 'deno']), ['deno', 'bun']);
		assert.deepStrictEqual(order_cross_runtime_runtimes([]), []);
	});
});

// Per-runtime load failures (the composer's `unavailable_by_runtime`, combined
// `version` 9+ — it carried init-line labels under `impls` at 8, which matched no
// row name). Synthetic reports: the committed one records no failures, and the
// point of these is the DISTINCTION the field draws — a runtime that couldn't load
// the impl behind a row versus a report that simply has no such row. Both render
// as `fail`.
describe('derive_unavailable_by_runtime', () => {
	const report = (
		unavailable_by_runtime?: CrossRuntimeReport['unavailable_by_runtime']
	): CrossRuntimeReport => ({
		version: 9,
		kind: 'combined',
		generated: '2026-01-01T00:00:00.000Z',
		runtimes: ['deno', 'node', 'bun'],
		unavailable_by_runtime,
		sources: [],
		rows: []
	});

	test('lists each runtime in the site column order, not the report storage order', () => {
		// the report stores deno-first; the tables read node-first, and a disclosure
		// listing runtimes in a different order than the columns invites misreading
		const derived = derive_unavailable_by_runtime(
			report([
				{ runtime: 'bun', rows: ['biome-wasm', 'oxc-parser-wasm'] },
				{ runtime: 'node', rows: ['biome-wasm'] }
			])
		);
		assert.deepStrictEqual(
			derived.map((entry) => entry.runtime),
			['node', 'bun']
		);
	});

	test('an empty row list is not a disclosure', () => {
		assert.isEmpty(derive_unavailable_by_runtime(report([{ runtime: 'bun', rows: [] }])));
	});

	test('a report predating the field discloses nothing — silence, not an all-clear', () => {
		assert.isEmpty(derive_unavailable_by_runtime(report(undefined)));
	});

	test('is_impl_unavailable answers per runtime, and never guesses on an older report', () => {
		// keyed by ROW name (`biome-wasm`), which is what the tables render — the
		// bench's init label (`Biome`) would match no cell
		const recorded = report([{ runtime: 'bun', rows: ['biome-wasm'] }]);
		assert.isTrue(is_impl_unavailable(recorded, 'bun', 'biome-wasm'));
		assert.isFalse(is_impl_unavailable(recorded, 'node', 'biome-wasm'));
		assert.isFalse(is_impl_unavailable(recorded, 'bun', 'oxfmt'));
		// absent field → every cell reads as "not measured here", which is the only
		// claim the data supports
		assert.isFalse(is_impl_unavailable(report(undefined), 'bun', 'biome-wasm'));
	});
});

// The per-row file-set-mismatch annotation (the site rendering of the composer's
// `⚠ files a/b/c`), on a synthetic report since the committed one is healthy.
describe('derive_cross_runtime_groups files_iterated_mismatch', () => {
	const report = (
		files_iterated: CrossRuntimeReport['rows'][number]['files_iterated']
	): CrossRuntimeReport => ({
		version: 7,
		kind: 'combined',
		generated: '2026-01-01T00:00:00.000Z',
		runtimes: ['deno', 'node', 'bun'],
		sources: [],
		rows: [
			{
				group: 'parse/typescript',
				name: 'tsv-json',
				ops_per_second: { deno: 1, node: 2, bun: 3 },
				mean_ns: { deno: 3, node: 2, bun: 1 },
				files_iterated
			}
		]
	});

	const derive_row = (files_iterated: CrossRuntimeReport['rows'][number]['files_iterated']) =>
		derive_cross_runtime_groups(report(files_iterated))[0]!.rows[0]!;

	test('equal counts across runtimes derive null', () => {
		assert.isNull(derive_row({ deno: 767, node: 767, bun: 767 }).files_iterated_mismatch);
	});

	test('unequal counts surface the raw per-runtime counts', () => {
		const mismatch = { deno: 765, node: 767, bun: 767 };
		assert.deepStrictEqual(derive_row(mismatch).files_iterated_mismatch, mismatch);
	});

	test('a null count (untimed runtime) is not a mismatch by itself', () => {
		assert.isNull(derive_row({ deno: null, node: 767, bun: 767 }).files_iterated_mismatch);
	});
});

describe('derive_unstable_cells', () => {
	const cell = (runtime: BenchmarkRuntime): UnstableCell => ({
		group: 'format/css',
		name: 'tsv',
		runtime,
		cv: 0.2,
		cv_raw: null,
		drift: null,
		samples: 10
	});
	const report = (unstable_cells?: Array<UnstableCell>): CrossRuntimeReport => ({
		version: 15,
		kind: 'combined',
		generated: '2026-01-01T00:00:00.000Z',
		runtimes: ['deno', 'node', 'bun'],
		unstable_cells,
		sources: [],
		rows: []
	});

	test('lists cells in the site column order, not the report storage order', () => {
		const derived = derive_unstable_cells(report([cell('bun'), cell('deno'), cell('node')]));
		assert.deepStrictEqual(
			derived.map((c) => c.runtime),
			['node', 'deno', 'bun']
		);
	});

	test('does not reorder the report in place', () => {
		const cells = [cell('bun'), cell('node')];
		derive_unstable_cells(report(cells));
		assert.deepStrictEqual(
			cells.map((c) => c.runtime),
			['bun', 'node']
		);
	});

	test('a report predating the field discloses nothing', () => {
		assert.isEmpty(derive_unstable_cells(report(undefined)));
	});
});

describe('derive_runtime_versions', () => {
	test('reads each source machine in display order, dropping sources without one', () => {
		const machine = (runtime_version: string) => ({
			cpu_model: 'cpu',
			os: 'linux',
			arch: 'x64',
			runtime_version
		});
		const source = (runtime: BenchmarkRuntime, m: ReturnType<typeof machine> | null) => ({
			runtime,
			timestamp: '2026-01-01T00:00:00.000Z',
			git_commit: null,
			tsv: null,
			machine: m
		});
		const versions = derive_runtime_versions({
			version: 15,
			kind: 'combined',
			generated: '2026-01-01T00:00:00.000Z',
			runtimes: ['deno', 'node', 'bun'],
			sources: [
				source('deno', machine('2.5.0')),
				source('node', machine('24.14.1')),
				source('bun', null)
			],
			rows: []
		});
		assert.deepStrictEqual(versions, [
			{ runtime: 'node', version: '24.14.1' },
			{ runtime: 'deno', version: '2.5.0' }
		]);
	});
});

describe('format_cross_runtime_label', () => {
	test('neutralizes the node-specific binding suffix, leaving other labels alone', () => {
		assert.strictEqual(format_cross_runtime_label('tsv-json'), 'tsv json (native)');
		assert.strictEqual(format_cross_runtime_label('biome-wasm'), 'biome (wasm)');
		assert.strictEqual(format_cross_runtime_label('prettier'), 'prettier');
	});
});

describe('cross_runtime_ratio_background', () => {
	test('parity is transparent, and alpha saturates at a 20% delta either way', () => {
		assert.include(cross_runtime_ratio_background(1), ' 0.0%,');
		assert.include(cross_runtime_ratio_background(1.1), 'var(--color_b_50) 15.0%,');
		assert.include(cross_runtime_ratio_background(1.2), 'var(--color_b_50) 30.0%,');
		assert.include(cross_runtime_ratio_background(3), 'var(--color_b_50) 30.0%,');
		assert.include(cross_runtime_ratio_background(0.5), 'var(--color_c_50) 30.0%,');
	});
});

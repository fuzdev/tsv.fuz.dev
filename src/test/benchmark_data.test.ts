import {assert, describe, test} from 'vitest';

import {benchmarks_json} from '$routes/docs/benchmarks/benchmarks.ts';
import {benchmarks_cross_runtime_json} from '$routes/docs/benchmarks/benchmarks_cross_runtime.ts';
import {
	categorize_size_capability,
	derive_benchmark_groups,
	derive_cross_runtime_groups,
	derive_size_groups,
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

	test('svelte/css parse groups get disabled oxc placeholders, typescript keeps real ones', () => {
		const groups = derive_benchmark_groups(benchmarks_json);
		const parse = (language: string) =>
			groups.find((g) => g.operation === 'parse' && g.language === language);

		// typescript actually runs oxc-parser — its oxc entries are real, not placeholders
		const ts = parse('typescript');
		const ts_oxc = ts?.entries.filter((e) => e.category === 'oxc') ?? [];
		assert.isNotEmpty(ts_oxc);
		for (const e of ts_oxc) assert.isNotOk(e.disabled, `${e.name} should be a real entry`);

		// svelte and css mirror those oxc entries in, disabled, in the same slot: just
		// after the JS-materializing `*-json` entries and before the `*-internal` ones
		for (const language of ['svelte', 'css']) {
			const group = parse(language);
			assert.ok(group, `${language} parse group missing`);
			const oxc = group!.entries.filter((e) => e.category === 'oxc');
			assert.strictEqual(oxc.length, ts_oxc.length, `${language} oxc placeholder count`);
			for (const e of oxc) {
				assert.ok(e.disabled, `${language} ${e.name} should be disabled`);
				assert.strictEqual(e.bar_fraction, 0, `${language} ${e.name} bar`);
				assert.isUndefined(e.speedup_vs_anchor, `${language} ${e.name} speedup`);
			}
			const names = group!.entries.map((e) => e.name);
			const first_oxc = names.findIndex((n) => n.includes('oxc'));
			const last_json = names.reduce((idx, n, i) => (n.endsWith('-json') ? i : idx), -1);
			assert.strictEqual(first_oxc, last_json + 1, `${language} oxc slotted after -json entries`);
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

	test('binary sizes group by capability with per-kind ratio anchors', () => {
		const groups = derive_size_groups(benchmarks_json.binary_sizes);
		// full / formatter / parser, in that order, all present in the current data
		assert.deepStrictEqual(
			groups.map((g) => g.capability),
			['full', 'formatter', 'parser'],
		);
		for (const group of groups) {
			assert.isNotEmpty(group.entries);
			// every entry lands in the group its capability names
			for (const e of group.entries) {
				assert.strictEqual(categorize_size_capability(e.label), group.capability);
			}
			// each kind's tsv build anchors that kind's ratios (undefined on itself)
			for (const kind of ['wasm', 'native'] as const) {
				const of_kind = group.entries.filter((e) => e.kind === kind);
				const anchor = of_kind.find(
					(e) => e.ratio_vs_tsv === undefined && e.label.startsWith('tsv'),
				);
				if (of_kind.length > 1) assert.ok(anchor, `${group.capability}/${kind} has no tsv anchor`);
				for (const e of of_kind) {
					if (e !== anchor) assert.isDefined(e.ratio_vs_tsv, `${e.label} ratio`);
				}
			}
		}
		// the parser group pits tsv against oxc-parser in both kinds
		const parser = groups.find((g) => g.capability === 'parser');
		const parser_labels = parser?.entries.map((e) => e.label) ?? [];
		assert.include(parser_labels, 'oxc-parser (wasm)');
		assert.include(parser_labels, 'oxc-parser (napi)');
	});

	test('full toolchain group carries the combined oxc-parser + oxfmt entry', () => {
		const sizes = benchmarks_json.binary_sizes;
		const groups = derive_size_groups(sizes);
		const full = groups.find((g) => g.capability === 'full');
		const combined = full?.entries.find((e) => e.label === 'oxc-parser + oxfmt (napi)');
		assert.ok(combined, 'combined oxc entry missing from full toolchain group');

		// its bytes and gzip are the sum of oxc's separate parser and formatter builds
		const oxc_parser = sizes.find((s) => s.label === 'oxc-parser (napi)');
		const oxfmt = sizes.find((s) => s.label === 'oxfmt (napi)');
		assert.ok(oxc_parser && oxfmt, 'source oxc builds missing');
		assert.strictEqual(combined!.bytes, oxc_parser!.bytes + oxfmt!.bytes);
		assert.strictEqual(combined!.gzip_bytes, oxc_parser!.gzip_bytes! + oxfmt!.gzip_bytes!);

		// native build, colored as oxc, and ratioed against tsv's native flagship
		assert.strictEqual(combined!.kind, 'native');
		assert.strictEqual(combined!.category, 'oxc');
		assert.isDefined(combined!.ratio_vs_tsv);
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

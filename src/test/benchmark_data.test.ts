import {assert, describe, test} from 'vitest';

import {benchmarks_json} from '$routes/docs/benchmarks/benchmarks.ts';
import {benchmarks_conformance_json} from '$routes/docs/benchmarks/benchmarks_conformance.ts';
import {benchmarks_cross_runtime_json} from '$routes/docs/benchmarks/benchmarks_cross_runtime.ts';
import {
	categorize_size_capability,
	compute_baseline_ratio,
	derive_benchmark_groups,
	derive_conformance_groups,
	derive_cross_runtime_groups,
	derive_size_groups,
	derive_speedup_summary,
	format_speedup_signed,
	OXFMT_WASM_LABEL,
} from '$routes/docs/benchmarks/benchmark_data.ts';

// Shape gate for the committed benchmarks.json: the bench report format drifts
// (it once went 3 months stale across a key rename that rendered as `undefined`),
// and `benchmarks.ts` casts the JSON, so typechecking alone won't catch it.
// When `npm run update-benchmarks` pulls in a new shape, these fail loudly.
describe('benchmarks.json shape', () => {
	test('baseline version is current', () => {
		assert.isAtLeast(benchmarks_json.version, 4);
	});

	test('binary sizes include the flagship tsv builds', () => {
		const labels = benchmarks_json.binary_sizes.map((s) => s.label);
		assert.include(labels, 'tsv (napi)'); // flagship N-API build (perf report anchor)
		assert.include(labels, 'tsv_wasm'); // the full wasm build — smallest full-toolchain, size baseline
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

	test('every group leads with its canonical entry (the default anchor) and a timed-set count', () => {
		const groups = derive_benchmark_groups(benchmarks_json);
		assert.isAtLeast(groups.length, 6); // format+parse × svelte/typescript/css
		for (const group of groups) {
			const key = `${group.operation}/${group.language}`;
			assert.ok(group.canonical_entry, `${key} has no canonical entry`);
			// the canonical reference sorts first, so it's the default 1.0x anchor the
			// shared component reads off the leading row
			assert.strictEqual(group.entries[0]?.category, 'canonical', `${key} canonical leads`);
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
		// after the biome placeholder (itself just after the `*-json` entries) and
		// before the `*-internal` ones
		for (const language of ['svelte', 'css']) {
			const group = parse(language);
			assert.ok(group, `${language} parse group missing`);
			const oxc = group.entries.filter((e) => e.category === 'oxc');
			assert.strictEqual(oxc.length, ts_oxc.length, `${language} oxc placeholder count`);
			for (const e of oxc) {
				assert.ok(e.disabled, `${language} ${e.name} should be disabled`);
				assert.strictEqual(e.bar_fraction, 0, `${language} ${e.name} bar`);
			}
			const names = group.entries.map((e) => e.name);
			const first_oxc = names.findIndex((n) => n.includes('oxc'));
			const last_json = names.reduce((idx, n, i) => (n.endsWith('-json') ? i : idx), -1);
			// last_json + 1 is the biome placeholder, so oxc starts one slot further
			assert.strictEqual(first_oxc, last_json + 2, `${language} oxc slotted after -json entries`);
		}
	});

	test('every parse group gets a disabled biome placeholder, since biome never exposes a parser to JS', () => {
		const groups = derive_benchmark_groups(benchmarks_json);
		for (const language of ['svelte', 'typescript', 'css']) {
			const group = groups.find((g) => g.operation === 'parse' && g.language === language);
			assert.ok(group, `${language} parse group missing`);
			const biome = group.entries.filter((e) => e.category === 'biome');
			assert.strictEqual(biome.length, 1, `${language} biome placeholder count`);
			const [entry] = biome;
			assert.ok(entry, `${language} biome entry missing`);
			assert.ok(entry.disabled, `${language} biome entry should be disabled`);
			assert.strictEqual(entry.bar_fraction, 0, `${language} biome bar`);

			// slotted just after the JS-materializing `*-json` entries
			const names = group.entries.map((e) => e.name);
			const first_biome = names.findIndex((n) => n.includes('biome'));
			const last_json = names.reduce((idx, n, i) => (n.endsWith('-json') ? i : idx), -1);
			assert.strictEqual(
				first_biome,
				last_json + 1,
				`${language} biome slotted after -json entries`,
			);
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

	test('binary sizes group by capability with one smallest-build ratio anchor', () => {
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
			// the group's default ratio anchor (its 1.0x row) is the single smallest real
			// build, and it leads the group — the shared component reads every ratio off
			// the first row. Disabled placeholders (e.g. oxfmt's absent wasm build) never
			// sort first.
			const real = group.entries.filter((e) => !e.disabled);
			const smallest = real.reduce((a, b) => (a.bytes <= b.bytes ? a : b));
			assert.strictEqual(
				group.entries[0]?.label,
				smallest.label,
				`${group.capability} smallest leads`,
			);
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
		assert.strictEqual(combined.bytes, oxc_parser.bytes + oxfmt.bytes);
		assert.strictEqual(combined.gzip_bytes, oxc_parser.gzip_bytes! + oxfmt.gzip_bytes!);

		// native build, colored as oxc
		assert.strictEqual(combined.kind, 'native');
		assert.strictEqual(combined.category, 'oxc');
	});

	test('formatter group gets a disabled oxfmt (wasm) placeholder just above oxfmt (napi), since oxfmt has no wasm build', () => {
		const groups = derive_size_groups(benchmarks_json.binary_sizes);
		const formatter = groups.find((g) => g.capability === 'formatter');
		assert.ok(formatter, 'formatter group missing');

		const placeholder = formatter.entries.find((e) => e.label === OXFMT_WASM_LABEL);
		assert.ok(placeholder, 'oxfmt (wasm) placeholder missing');
		assert.ok(placeholder.disabled, 'oxfmt (wasm) should be disabled');
		assert.strictEqual(placeholder.kind, 'wasm');
		assert.strictEqual(placeholder.category, 'oxc');
		assert.strictEqual(placeholder.bar_fraction, 0);

		const labels = formatter.entries.map((e) => e.label);
		const placeholder_index = labels.indexOf(OXFMT_WASM_LABEL);
		const native_index = labels.indexOf('oxfmt (napi)');
		assert.isAbove(native_index, -1, 'oxfmt (napi) missing from formatter group');
		assert.strictEqual(
			placeholder_index,
			native_index - 1,
			'placeholder should sit just above oxfmt (napi)',
		);
	});

	test('flagship report is the node runtime', () => {
		// the headline detailed view switched to N-API under Node; guards against an
		// `update-benchmarks` that pulls the wrong runtime's sibling report
		assert.strictEqual((benchmarks_json as {runtime?: string}).runtime, 'node');
	});
});

// Shape gate for the committed conformance report `benchmarks_conformance.json`
// (tsv's `report.conformance.node.json` — the parse-coverage surface over the
// full fixtures-included corpus), consumed by the Parse conformance section.
describe('benchmarks_conformance.json shape', () => {
	test('report is the conformance surface at the current version', () => {
		assert.isAtLeast(benchmarks_conformance_json.version, 6);
		assert.strictEqual(benchmarks_conformance_json.corpus_kind, 'conformance');
		assert.strictEqual((benchmarks_conformance_json as {runtime?: string}).runtime, 'node');
	});

	test('conformance report is parse-only', () => {
		for (const entry of benchmarks_conformance_json.entries) {
			assert.match(entry.group, /^parse\//, `${entry.group}/${entry.name}`);
		}
	});

	test('corpus sources disclose the composition', () => {
		assert.isNotEmpty(benchmarks_conformance_json.corpus_sources ?? []);
	});

	test('derives one coverage group per language, each with a tsv row and full coverage data', () => {
		const groups = derive_conformance_groups(benchmarks_conformance_json);
		assert.strictEqual(groups.length, 3); // svelte / typescript / css
		assert.deepEqual(
			groups.map((g) => g.language),
			['svelte', 'typescript', 'css'],
		);
		for (const group of groups) {
			assert.ok(
				group.rows.some((r) => r.name === 'tsv'),
				`${group.language} has a tsv row`,
			);
			for (const row of group.rows) {
				assert.isAbove(row.files_total, 0, `${group.language}/${row.name} total`);
				assert.isAtLeast(row.coverage_fraction, 0);
				assert.isAtMost(row.coverage_fraction, 1);
				// engine-level rows only — binding/materialization variants are folded
				assert.notMatch(row.name, /-internal|wasm-|-wasm/, `${group.language}/${row.name}`);
			}
		}
	});
});

describe('format_speedup_signed', () => {
	test('anchor-and-faster entries read as a plain multiple', () => {
		assert.strictEqual(format_speedup_signed(1), '1.00x');
		assert.strictEqual(format_speedup_signed(2.5), '2.50x');
		assert.strictEqual(format_speedup_signed(12.3), '12.3x'); // >= 10 drops to one decimal
	});

	test('slower entries negate the reciprocal so the factor is directly legible', () => {
		assert.strictEqual(format_speedup_signed(0.15), '-6.67x');
		assert.strictEqual(format_speedup_signed(0.05), '-20.0x'); // >= 10 magnitude → one decimal
		assert.strictEqual(format_speedup_signed(0.98), '-1.02x'); // near-parity sign flip
	});
});

describe('compute_baseline_ratio', () => {
	test('speed reads the anchor as the reference — faster entries exceed 1', () => {
		// anchor 100ns; a 50ns entry is 2x faster, a 200ns entry is half the speed
		assert.strictEqual(compute_baseline_ratio('speed', 50, 100), 2);
		assert.strictEqual(compute_baseline_ratio('speed', 200, 100), 0.5);
	});

	test('size reads the anchor as the reference — bigger entries exceed 1', () => {
		// anchor 100 bytes; a 300-byte build is 3x bigger, a 50-byte build is half
		assert.strictEqual(compute_baseline_ratio('size', 300, 100), 3);
		assert.strictEqual(compute_baseline_ratio('size', 50, 100), 0.5);
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

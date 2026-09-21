import { assert, describe, test } from 'vitest';

import { benchmarks_json } from '$routes/docs/benchmarks/benchmarks.ts';
import {
	categorize_size_capability,
	derive_size_groups,
	OXC_FULL_LABEL,
	OXFMT_WASM_LABEL,
	RSVELTE_INSTALL_LABEL,
	RSVELTE_LABEL,
	SIZE_CAPABILITY_BY_LABEL
} from '$routes/docs/benchmarks/benchmark_sizes.ts';

// Shape gate for the binary-size half of the committed benchmarks.json: the size
// table's COMPOSITION varies with what the producing machine built, so these pin the
// builds the page's groups and prose depend on.
describe('benchmarks.json binary sizes', () => {
	test('binary sizes include the flagship tsv builds', () => {
		const labels = benchmarks_json.binary_sizes.map((s) => s.label);
		assert.include(labels, 'tsv (napi)'); // flagship N-API build (perf report anchor)
		assert.include(labels, 'tsv-wasm'); // the full wasm build — the tldr's wasm size claim reads it
	});

	test('every hand-stated capability label still names a build in the report', () => {
		// `categorize_size_capability` falls back to `full` for a label whose name says
		// nothing about what it does, which is right only for builds that really ship
		// both operations. The labels in the table are the exceptions, matched by
		// exact string — a rename upstream misses the lookup and lands silently in
		// `full`, where `swc (napi)` (a 32 MB parser) would become the flagship group's
		// `max` and rescale every bar in it.
		const labels = new Set(benchmarks_json.binary_sizes.map((s) => s.label));
		for (const label of Object.keys(SIZE_CAPABILITY_BY_LABEL)) {
			assert.ok(
				labels.has(label),
				`"${label}" is hand-mapped to a capability but no longer names a build — ` +
					`it now falls through to "full"`
			);
		}
	});

	test('binary sizes group by capability with one smallest-build ratio anchor', () => {
		const groups = derive_size_groups(benchmarks_json.binary_sizes);
		// full / formatter / parser, in that order, all present in the current data
		assert.deepStrictEqual(
			groups.map((g) => g.capability),
			['full', 'formatter', 'parser']
		);
		for (const group of groups) {
			assert.isNotEmpty(group.entries);
			// every entry lands in the group its capability names
			for (const e of group.entries) {
				assert.strictEqual(categorize_size_capability(e.label), group.capability);
			}
			// the group's default ratio anchor (its 1.0x row) is the single smallest real
			// build, and it leads the group — the shared component anchors on the first
			// ENABLED row, but the visual slot is the first row, so a disabled
			// placeholder (oxfmt's absent wasm build, spliced above `oxfmt (napi)`)
			// must not be sorting first either
			const real = group.entries.filter((e) => !e.disabled);
			const smallest = real.reduce((a, b) => (a.bytes <= b.bytes ? a : b));
			assert.strictEqual(
				group.entries[0]?.label,
				smallest.label,
				`${group.capability} smallest leads`
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
		const combined = full?.entries.find((e) => e.label === OXC_FULL_LABEL);
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

	test('formatter group carries rsvelte-fmt both bare and summed with the oxfmt it needs for a project', () => {
		const sizes = benchmarks_json.binary_sizes;
		const groups = derive_size_groups(sizes);
		const formatter = groups.find((g) => g.capability === 'formatter');
		assert.ok(formatter, 'formatter group missing');

		// the page's size notes on both entries are unconditional, so the report must
		// carry the build (`benchmark_sizes.test.ts` covers the no-build case)
		const bare = formatter.entries.find((e) => e.label === RSVELTE_LABEL);
		assert.ok(bare, 'rsvelte-fmt build missing from formatter group');

		const combined = formatter.entries.find((e) => e.label === RSVELTE_INSTALL_LABEL);
		assert.ok(combined, 'rsvelte-fmt + oxfmt entry missing from formatter group');

		const oxfmt = sizes.find((s) => s.label === 'oxfmt (napi)');
		assert.ok(oxfmt, 'source oxfmt build missing');
		assert.strictEqual(combined.bytes, bare.bytes + oxfmt.bytes);
		assert.strictEqual(combined.gzip_bytes, bare.gzip_bytes! + oxfmt.gzip_bytes!);

		// both are real measured builds, not placeholders — the pair is the project
		// figure, the bare binary the single-file one
		assert.isNotOk(bare.disabled, 'bare rsvelte-fmt should be a real entry');
		assert.isNotOk(combined.disabled, 'rsvelte pair should be a real entry');
		assert.strictEqual(combined.kind, 'native');
		for (const e of [bare, combined]) {
			assert.strictEqual(e.category, 'rsvelte', `${e.label} category`);
		}

		// the sum must sort after its own bare half — a group ordered smallest-first
		// would otherwise be reporting a sum smaller than one of its addends
		const labels = formatter.entries.map((e) => e.label);
		assert.isAbove(
			labels.indexOf(RSVELTE_INSTALL_LABEL),
			labels.indexOf(RSVELTE_LABEL),
			'the rsvelte pair should sort after the bare binary'
		);
	});

	test('tsv "builds smaller artifacts for the same capability" than Oxc and Biome', () => {
		// The TLDR's size claim, like for like within each capability group: tsv's
		// wasm build against the wasm competitor, its native builds against the native
		// one (the ffi build stands in where a group has no napi build of tsv)
		const groups = derive_size_groups(benchmarks_json.binary_sizes);
		const bytes = (capability: string, label: string): number => {
			const entry = groups
				.find((g) => g.capability === capability)
				?.entries.find((e) => e.label === label);
			assert(entry && !entry.disabled, `${capability}: ${label} missing`);
			return entry.bytes;
		};
		const PAIRS: Array<[string, string, string]> = [
			['full', 'tsv-wasm', 'biome (wasm)'],
			['full', 'tsv (napi)', OXC_FULL_LABEL],
			['full', 'tsv (ffi)', OXC_FULL_LABEL],
			['formatter', 'tsv format (ffi)', 'oxfmt (napi)'],
			['parser', 'tsv-parse-wasm', 'oxc-parser (wasm)'],
			['parser', 'tsv parse (ffi)', 'oxc-parser (napi)']
		];
		for (const [capability, tsv, other] of PAIRS) {
			assert.isBelow(
				bytes(capability, tsv),
				bytes(capability, other),
				`${capability}: ${tsv} vs ${other}`
			);
		}
	});

	test('the size notes on the js bundles hold: full barely over formatter, and gz flatters them', () => {
		const sizes = benchmarks_json.binary_sizes;
		const bundles = sizes.filter((s) => s.kind === 'js');
		const named = (capability: string) =>
			bundles.find((s) => SIZE_CAPABILITY_BY_LABEL[s.label] === capability);
		const full = named('full');
		const formatter = named('formatter');
		assert(full && formatter, 'the full and formatter bundles are missing');
		// "barely larger": the formatter already contains the Svelte parser
		assert.isAbove(full.bytes, formatter.bytes);
		assert.isBelow(full.bytes, formatter.bytes * 1.01);
		// "minified JS compresses much better than wasm"
		const gz_share = (s: (typeof sizes)[number]) => (s.gzip_bytes ?? NaN) / s.bytes;
		const wasm = sizes.filter((s) => s.kind === 'wasm' && s.gzip_bytes != null);
		assert.isNotEmpty(wasm);
		const best_wasm = Math.min(...wasm.map(gz_share));
		for (const bundle of bundles) {
			assert.isBelow(gz_share(bundle), best_wasm, bundle.label);
		}
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
			'placeholder should sit just above oxfmt (napi)'
		);
	});
});

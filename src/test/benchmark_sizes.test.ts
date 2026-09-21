import { assert, describe, test } from 'vitest';

import {
	categorize_size,
	categorize_size_capability,
	derive_size_groups,
	OXC_FULL_LABEL,
	RSVELTE_INSTALL_LABEL,
	OXFMT_WASM_LABEL,
	type SizeCapability
} from '$routes/docs/benchmarks/benchmark_sizes.ts';
import type { BinarySize } from '$routes/docs/benchmarks/benchmark_data.ts';

// Binary-size capability grouping. The heuristic reads the tool's NAME, so the
// tools not named after their job are the ones that can silently land under a
// heading that misdescribes them (a formatter filed as "parse + format").
describe('categorize_size_capability', () => {
	test('reads the job out of a label that names it', () => {
		assert.strictEqual(categorize_size_capability('tsv parse (ffi)'), 'parser');
		assert.strictEqual(categorize_size_capability('tsv-format-wasm'), 'formatter');
		assert.strictEqual(categorize_size_capability('oxfmt (napi)'), 'formatter');
		assert.strictEqual(categorize_size_capability(OXC_FULL_LABEL), 'full');
		assert.strictEqual(categorize_size_capability('tsv (napi)'), 'full');
	});

	test('the tools whose names say nothing are stated, not guessed', () => {
		// each of these would otherwise fall through to `full` — a "parse + format"
		// heading over four builds, two shipping only a formatter and two no formatter
		assert.strictEqual(categorize_size_capability('dprint (wasm)'), 'formatter');
		assert.strictEqual(categorize_size_capability('malva (wasm)'), 'formatter');
		assert.strictEqual(categorize_size_capability('swc (napi)'), 'parser');
		assert.strictEqual(categorize_size_capability('rsvelte compiler (napi)'), 'parser');
	});

	test('the canonical js bundles land one per capability, colored as canonical', () => {
		// by keyword `prettier + parsers` reads as a parser and the prettier bundle as full
		const labels: Array<[string, SizeCapability]> = [
			['svelte + acorn-typescript parsers (js bundle)', 'parser'],
			['prettier + svelte plugin (js bundle)', 'formatter'],
			['prettier + parsers (js bundle)', 'full']
		];
		for (const [label, capability] of labels) {
			assert.strictEqual(categorize_size_capability(label), capability);
			assert.strictEqual(categorize_size(label), 'canonical');
		}
	});

	test('the two dprint plugins share a bucket', () => {
		// only `malva` reads as a formatter by name — see `SIZE_CAPABILITY_BY_LABEL`
		assert.strictEqual(
			categorize_size_capability('dprint (wasm)'),
			categorize_size_capability('malva (wasm)')
		);
	});
});

describe('derive_size_groups', () => {
	const size = (label: string, bytes: number): BinarySize => ({
		label,
		bytes,
		kind: label.includes('wasm') ? 'wasm' : 'native',
		gzip_bytes: null
	});

	test('the oxfmt wasm placeholder sits above its native build', () => {
		const [formatter] = derive_size_groups([
			size('tsv format (ffi)', 10),
			size('oxfmt (napi)', 30),
			size('dprint (wasm)', 20)
		]);
		assert.deepEqual(
			formatter!.entries.map((e) => e.label),
			['tsv format (ffi)', 'dprint (wasm)', OXFMT_WASM_LABEL, 'oxfmt (napi)']
		);
		assert.isTrue(formatter!.entries[2]!.disabled);
	});

	test('the placeholder trails the group when there is no native oxfmt to sit above', () => {
		const [formatter] = derive_size_groups([size('tsv format (ffi)', 10)]);
		assert.deepEqual(
			formatter!.entries.map((e) => e.label),
			['tsv format (ffi)', OXFMT_WASM_LABEL]
		);
	});

	test('a synthesized sum carries gzip only when both halves do', () => {
		const full = (sizes: Array<BinarySize>) =>
			derive_size_groups(sizes)
				.find((g) => g.capability === 'full')
				?.entries.find((e) => e.label === OXC_FULL_LABEL);
		const both = full([
			{ ...size('oxc-parser (napi)', 5), gzip_bytes: 2 },
			{ ...size('oxfmt (napi)', 7), gzip_bytes: 3 }
		]);
		assert.strictEqual(both?.bytes, 12);
		assert.strictEqual(both?.gzip_bytes, 5);
		const one = full([{ ...size('oxc-parser (napi)', 5), gzip_bytes: 2 }, size('oxfmt (napi)', 7)]);
		assert.strictEqual(one?.bytes, 12);
		assert.isNull(one?.gzip_bytes);
	});

	test('synthesized sums need both halves', () => {
		const groups = derive_size_groups([size('oxc-parser (napi)', 5)]);
		assert.isFalse(groups.some((g) => g.entries.some((e) => e.label === OXC_FULL_LABEL)));
	});

	test('the rsvelte-fmt install sums its binary with the oxfmt it needs over a directory', () => {
		const install = (sizes: Array<BinarySize>) =>
			derive_size_groups(sizes)
				.flatMap((g) => g.entries)
				.find((e) => e.label === RSVELTE_INSTALL_LABEL);
		const both = install([
			{ ...size('rsvelte-fmt (binary)', 5), gzip_bytes: 2 },
			{ ...size('oxfmt (napi)', 7), gzip_bytes: 3 }
		]);
		assert.strictEqual(both?.bytes, 12);
		assert.strictEqual(both?.gzip_bytes, 5);
		assert.isUndefined(install([size('rsvelte-fmt (binary)', 5)]));
	});
});

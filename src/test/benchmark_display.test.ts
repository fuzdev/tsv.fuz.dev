import { assert, describe, test } from 'vitest';

import {
	format_corpus_source_files,
	format_count,
	format_label,
	format_memory_ratio,
	format_ns,
	format_ratio_approx,
	format_ratio_range
} from '$routes/docs/benchmarks/benchmark_display.ts';

describe('format_label', () => {
	test('overrides name the runtime and binding', () => {
		assert.strictEqual(format_label('tsv-json-no-locations'), 'tsv json no-locs (node napi)');
		assert.strictEqual(format_label('biome-wasm'), 'biome (wasm)');
	});

	test('hyphenated tool names keep their hyphens, only the suffix is spaced', () => {
		assert.strictEqual(format_label('tsv-wasm-json'), 'tsv-wasm json');
		assert.strictEqual(format_label('acorn-typescript'), 'acorn-typescript');
		assert.strictEqual(format_label('tsv-format-wasm'), 'tsv-format-wasm');
	});

	test('anything else is spaced out, and names without hyphens pass through', () => {
		assert.strictEqual(format_label('some-new-tool'), 'some new tool');
		assert.strictEqual(format_label('svelte/compiler'), 'svelte/compiler');
	});
});

describe('format_ns', () => {
	test('the µs tier never prints 1000', () => {
		assert.deepEqual(format_ns(999_499), { value: '999', unit: 'µs' });
		assert.deepEqual(format_ns(999_500), { value: '1.0', unit: 'ms' });
		assert.deepEqual(format_ns(1_000_000), { value: '1.0', unit: 'ms' });
	});

	test('the ms tier keeps one decimal under 10 ms and never prints 10.0', () => {
		// a 3.9 ms row against an 11.3 ms anchor must not print as `4` and `11`
		assert.deepEqual(format_ns(3_900_000), { value: '3.9', unit: 'ms' });
		assert.deepEqual(format_ns(9_949_999), { value: '9.9', unit: 'ms' });
		assert.deepEqual(format_ns(9_950_000), { value: '10', unit: 'ms' });
		assert.deepEqual(format_ns(1_234_000_000), { value: '1,234', unit: 'ms' });
	});
});

describe('prose ratio formatting', () => {
	test('approximate formatting drops digits as the ratio grows', () => {
		assert.strictEqual(format_ratio_approx(1.66), '1.7x');
		assert.strictEqual(format_ratio_approx(26.241), '26x');
		assert.strictEqual(format_ratio_approx(undefined), '—');
	});

	test('a range is floored at both ends so the claim never overstates either bound', () => {
		assert.strictEqual(format_ratio_range(3.001, 9.89), '3.0–9.8x');
		assert.strictEqual(format_ratio_range(2.95, 4.62), '2.9–4.6x');
		// from 10 the decimal goes, as `format_ratio_approx` drops it
		assert.strictEqual(format_ratio_range(6.54, 21.21), '6.5–21x');
	});
});

describe('format_memory_ratio', () => {
	test('keeps one decimal at every magnitude', () => {
		assert.strictEqual(format_memory_ratio(1), '1.0x');
		assert.strictEqual(format_memory_ratio(6.5436), '6.5x');
		assert.strictEqual(format_memory_ratio(21.2122), '21.2x');
		assert.strictEqual(format_memory_ratio(0.2915), '0.3x');
	});
});

describe('format_count', () => {
	test('groups thousands in the pinned locale', () => {
		assert.strictEqual(format_count(44_220), '44,220');
		assert.strictEqual(format_count(7), '7');
	});
});

describe('format_corpus_source_files', () => {
	test('lists languages largest first, dropping empty ones', () => {
		assert.strictEqual(
			format_corpus_source_files({
				path: 'x',
				files: 1_170,
				by_language: { svelte: 15, typescript: 1_124, css: 31, html: 0 }
			}),
			'1,124 typescript, 31 css, 15 svelte'
		);
	});

	test('falls back to the total without a usable per-language split', () => {
		assert.strictEqual(format_corpus_source_files({ path: 'x', files: 1_500 }), '1,500 files');
		assert.strictEqual(
			format_corpus_source_files({ path: 'x', files: 3, by_language: { css: 0 } }),
			'3 files'
		);
	});
});

import { assert, describe, test } from 'vitest';

import {
	baseline_ratio_color,
	compute_baseline_ratio,
	format_baseline_ratio,
	format_speedup_signed,
	to_baseline_key
} from '$routes/docs/benchmarks/benchmark_baseline.ts';

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

describe('format_baseline_ratio', () => {
	test('speed is signed, size is a plain multiple', () => {
		assert.strictEqual(format_baseline_ratio('speed', 0.5), '-2.00x');
		assert.strictEqual(format_baseline_ratio('size', 0.5), '0.5x');
		assert.strictEqual(format_baseline_ratio('size', 12.34), '12.3x');
	});
});

describe('baseline_ratio_color', () => {
	test('the two directions run opposite ways: a big speedup is good, a big size is bad', () => {
		assert.strictEqual(baseline_ratio_color('speed', 10), 'var(--color_j_50)');
		assert.strictEqual(baseline_ratio_color('size', 10), 'var(--color_c_50)');
		assert.strictEqual(baseline_ratio_color('speed', 0.4), 'var(--color_c_50)');
		assert.strictEqual(baseline_ratio_color('size', 0.4), 'var(--color_b_50)');
	});

	test('each band starts at its threshold', () => {
		assert.notStrictEqual(baseline_ratio_color('speed', 0.99), baseline_ratio_color('speed', 1));
		assert.notStrictEqual(baseline_ratio_color('speed', 1.99), baseline_ratio_color('speed', 2));
		assert.notStrictEqual(baseline_ratio_color('speed', 4.99), baseline_ratio_color('speed', 5));
		assert.notStrictEqual(baseline_ratio_color('size', 0.99), baseline_ratio_color('size', 1));
		assert.notStrictEqual(baseline_ratio_color('size', 2.99), baseline_ratio_color('size', 3));
		assert.notStrictEqual(baseline_ratio_color('size', 9.99), baseline_ratio_color('size', 10));
	});
});

describe('to_baseline_key', () => {
	// the tests run without a DOM, so the event target is the two members the read touches
	const event = (row: { dataset: Record<string, string> } | null): Event =>
		({ target: { closest: () => row } }) as unknown as Event;

	test('reads the key off the row under the pointer', () => {
		assert.strictEqual(
			to_baseline_key(event({ dataset: { baselineKey: 'prettier' } })),
			'prettier'
		);
	});

	test('no row under the pointer, or no target at all, is no key', () => {
		assert.isUndefined(to_baseline_key(event(null)));
		assert.isUndefined(to_baseline_key({ target: null } as unknown as Event));
	});
});

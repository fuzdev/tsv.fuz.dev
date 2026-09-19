import { assert, describe, test } from 'vitest';

import {
	compute_baseline_ratio,
	format_speedup_signed
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

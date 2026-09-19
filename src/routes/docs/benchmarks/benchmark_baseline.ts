// The hover-to-rebaseline ratios behind `BenchmarksBaselineGroup.svelte`: the
// shared row shape, and the per-direction ratio, formatting, and color scales for
// the speed (format/parse) and size groups.

import type { ImplementationCategory } from './benchmark_data.ts';
import { format_ratio_plain, type FormattedUnit } from './benchmark_display.ts';

/**
 * Signed speedup: entries at or above the anchor read as a plain multiple
 * (`2.50x`), while slower entries show the reciprocal negated (`0.15x` → `-6.67x`)
 * so "how many times slower" is directly legible instead of a fraction the reader
 * has to invert. The minus is a convention for "times slower", not a literal
 * negative rate. Used for the format/parse speed bars, where entries span widely
 * on both sides of the anchor; the near-parity cross-runtime table and the
 * bigger-is-worse size ratios stay on the plain fractional `format_speedup`.
 */
export const format_speedup_signed = (ratio: number): string => {
	const magnitude = ratio >= 1 ? ratio : 1 / ratio;
	const digits = magnitude >= 10 ? 1 : 2;
	return `${ratio < 1 ? '-' : ''}${magnitude.toFixed(digits)}x`;
};

/** Returns a CSS color variable for the speedup ratio. */
const speedup_color = (ratio: number): string => {
	if (ratio < 0.5) return 'var(--color_c_50)'; // red — much slower
	if (ratio < 1) return 'var(--color_h_50)'; // orange — slower
	if (ratio < 2) return 'var(--color_e_50)'; // yellow — modest
	if (ratio < 5) return 'var(--color_b_50)'; // green — fast
	return 'var(--color_j_50)'; // teal — exceptional
};

/**
 * Returns a CSS color variable for a size ratio (inverted — bigger is worse).
 * Green is reserved for builds smaller than the baseline (ratio < 1, only reachable
 * once a hover re-baselines onto a larger build); any build at or above the baseline
 * reads yellow at the floor, ramping through orange to red as it grows.
 */
const size_ratio_color = (ratio: number): string => {
	if (ratio < 1) return 'var(--color_b_50)'; // green — smaller than baseline
	if (ratio < 3) return 'var(--color_e_50)'; // yellow — larger
	if (ratio < 10) return 'var(--color_h_50)'; // orange — much larger
	return 'var(--color_c_50)'; // red — enormous
};

/**
 * Which way a group's ratio runs, so re-anchoring on hover stays consistent. A
 * `speed` group (format/parse) reads its anchor as a reference speed — faster
 * entries are positive multiples, slower ones negative (`format_speedup_signed` /
 * `speedup_color`). A `size` group reads its anchor as a reference size — bigger
 * builds are multiples ≥ 1 (`format_ratio_plain` / `size_ratio_color`). The two
 * ratios are reciprocals, which is exactly why one direction flag suffices.
 */
export type BaselineDirection = 'speed' | 'size';

/** An entry's ratio against its group's anchor, in the group's direction. */
export const compute_baseline_ratio = (
	direction: BaselineDirection,
	entry_raw: number,
	anchor_raw: number
): number => (direction === 'speed' ? anchor_raw / entry_raw : entry_raw / anchor_raw);

/** Formats a baseline ratio for display in the given direction. */
export const format_baseline_ratio = (direction: BaselineDirection, ratio: number): string =>
	direction === 'speed' ? format_speedup_signed(ratio) : format_ratio_plain(ratio);

/** Color for a baseline ratio in the given direction. */
export const baseline_ratio_color = (direction: BaselineDirection, ratio: number): string =>
	direction === 'speed' ? speedup_color(ratio) : size_ratio_color(ratio);

/**
 * A normalized row for `BenchmarksBaselineGroup` — the shared hover-to-rebaseline
 * column behind the format, parse, and binary-size groups. `raw` is the number the
 * ratio derives from (sweep mean ns for speed, bytes for size); `value` is the
 * row's displayed measurement (the whole-sweep mean — total time over the group's
 * iterated corpus — for speed, bytes for size). Flattening the group-specific
 * display entries to this one shape lets a single component own the anchor state
 * for all three sections.
 */
export interface BaselineRow {
	// stable identity for `#each` and anchor matching (the entry name / size label)
	key: string;
	// raw name/label; `BenchmarksBar` formats it for display
	label: string;
	category: ImplementationCategory;
	bar_fraction: number;
	value: FormattedUnit;
	// the number the ratio derives from — mean ns (speed) or bytes (size)
	raw: number;
	annotation: string | undefined;
	// grayed-out, inert placeholder — never an anchor, no hover highlight
	disabled: boolean;
	// inert because the tool was measured for COVERAGE but deliberately never
	// timed, not because it sat the group out — the bar reads `not timed` instead
	// of `n/a` so the two aren't conflated. See `BenchmarkDisplayEntry.coverage_only`.
	coverage_only?: boolean;
}

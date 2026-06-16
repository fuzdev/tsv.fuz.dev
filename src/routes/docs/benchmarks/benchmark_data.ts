// Raw types matching the tsv bench.ts `Baseline` format

export interface BenchmarkBaseline {
	version: number;
	timestamp: string;
	git_commit: string;
	corpus: Record<string, number>;
	versions: BaselineVersions;
	binary_sizes: Array<BinarySize>;
	entries: Array<BaselineEntry>;
	// Counts of silenced third-party stderr noise, keyed by message pattern.
	// Present from baseline `version` 4 on; not rendered, kept for parity.
	suppressed_noise?: Record<string, number>;
}

export interface BaselineEntry {
	name: string;
	group: string;
	mean_ns: number;
	p50_ns: number;
	p75_ns: number;
	p90_ns: number;
	p95_ns: number;
	p99_ns: number;
	min_ns: number;
	max_ns: number;
	std_dev_ns: number;
	cv: number;
	ops_per_second: number;
	sample_size: number;
	// Per-implementation preflight coverage: files this impl processed / the
	// language's total discovered files. Present from baseline `version` 3 on;
	// absent (or `null`) in older baselines.
	files_processed?: number | null;
	files_total?: number | null;
	// Files this impl was actually timed on (the per-group intersection in
	// default mode). Present from baseline `version` 4 on.
	files_iterated?: number | null;
}

export interface BaselineVersions {
	tsv: string;
	svelte: string;
	acorn: string;
	acorn_ts: string;
	prettier: string;
	prettier_svelte: string;
	oxc_parser?: string;
	oxfmt?: string;
	biome?: string;
}

export interface BinarySize {
	label: string;
	bytes: number;
	kind: 'native' | 'wasm';
	// Gzipped on-disk size (≈ npm-tarball wire size); `null` when `gzip` was
	// unavailable on the machine that generated the baseline.
	gzip_bytes: number | null;
}

// Display types

export type ImplementationCategory =
	| 'canonical'
	| 'tsv_native'
	| 'tsv_native_json'
	| 'tsv_wasm'
	| 'tsv_wasm_json'
	| 'biome'
	| 'oxc';

export interface BenchmarkGroup {
	operation: string;
	language: string;
	entries: Array<BenchmarkDisplayEntry>;
	canonical_entry: BenchmarkDisplayEntry | undefined;
	// files the timed benchmark actually iterated (the per-group intersection);
	// null on older baselines (< version 4) that don't carry `files_iterated`
	files_iterated: number | null;
}

export interface BenchmarkDisplayEntry {
	name: string;
	mean_ns: number;
	bar_fraction: number;
	speedup_vs_canonical: number | undefined;
	category: ImplementationCategory;
	files_processed: number | null;
	files_total: number | null;
}

export interface SpeedupRow {
	variant: string;
	format_svelte: number | undefined;
	format_typescript: number | undefined;
	format_css: number | undefined;
}

// Implementation categorization

const CATEGORY_BY_NAME: Record<string, ImplementationCategory> = {
	prettier: 'canonical',
	'svelte/compiler': 'canonical',
	'acorn-typescript': 'canonical',
	tsv: 'tsv_native',
	'tsv-json': 'tsv_native_json',
	'tsv-internal': 'tsv_native',
	tsv_wasm: 'tsv_wasm',
	'tsv_wasm-json': 'tsv_wasm_json',
	'tsv_wasm-internal': 'tsv_wasm',
	'biome-wasm': 'biome',
	'oxc-parser': 'oxc',
	'oxc-parser-wasm': 'oxc',
	oxfmt: 'oxc',
};

const categorize_name = (name: string): ImplementationCategory => CATEGORY_BY_NAME[name] ?? 'oxc';

export const categorize_size = (label: string): ImplementationCategory => {
	// covers `tsv_wasm` plus the `tsv_format_wasm`/`tsv_parse_wasm` subsets
	if (label.startsWith('tsv') && label.includes('wasm')) return 'tsv_wasm';
	if (label.startsWith('tsv')) return 'tsv_native';
	if (label.startsWith('biome')) return 'biome';
	if (label.includes('oxc') || label.includes('oxfmt')) return 'oxc';
	return 'oxc';
};

// Canonical entry names per group
const CANONICAL_BY_GROUP: Record<string, string> = {
	'parse/svelte': 'svelte/compiler',
	'parse/typescript': 'acorn-typescript',
	'parse/css': 'svelte/compiler',
	'format/svelte': 'prettier',
	'format/typescript': 'prettier',
	'format/css': 'prettier',
};

// Primary tsv entry names for speedup summary (fair comparisons)
const PRIMARY_NATIVE_FORMAT = 'tsv';
const PRIMARY_WASM_FORMAT = 'tsv_wasm';

// Derivation functions

export const derive_benchmark_groups = (baseline: BenchmarkBaseline): Array<BenchmarkGroup> => {
	const grouped: Map<string, Array<BaselineEntry>> = new Map();
	for (const entry of baseline.entries) {
		let group = grouped.get(entry.group);
		if (!group) {
			group = [];
			grouped.set(entry.group, group);
		}
		group.push(entry);
	}

	const result: Array<BenchmarkGroup> = [];

	for (const [group_key, entries] of grouped) {
		const parts = group_key.split('/');
		const operation = parts[0]!;
		const language = parts[1]!;
		const canonical_name = CANONICAL_BY_GROUP[group_key];
		const canonical_entry_raw = entries.find((e) => e.name === canonical_name);
		const slowest = Math.max(...entries.map((e) => e.mean_ns));

		const display_entries: Array<BenchmarkDisplayEntry> = entries.map((e) => ({
			name: e.name,
			mean_ns: e.mean_ns,
			bar_fraction: slowest > 0 ? e.mean_ns / slowest : 0,
			speedup_vs_canonical:
				canonical_entry_raw && e.name !== canonical_name
					? canonical_entry_raw.mean_ns / e.mean_ns
					: undefined,
			category: categorize_name(e.name),
			files_processed: e.files_processed ?? null,
			files_total: e.files_total ?? null,
		}));

		// Sort: canonical first, then by mean_ns descending (slowest first for visual)
		display_entries.sort((a, b) => {
			if (a.category === 'canonical' && b.category !== 'canonical') return -1;
			if (b.category === 'canonical' && a.category !== 'canonical') return 1;
			return b.mean_ns - a.mean_ns;
		});

		const iterated_counts = entries
			.map((e) => e.files_iterated)
			.filter((v): v is number => v != null);
		result.push({
			operation,
			language,
			entries: display_entries,
			canonical_entry: display_entries.find((e) => e.category === 'canonical'),
			files_iterated: iterated_counts.length > 0 ? Math.max(...iterated_counts) : null,
		});
	}

	// Sort groups: format before parse, then by language
	const LANG_ORDER: Record<string, number> = {svelte: 0, typescript: 1, css: 2};
	const OP_ORDER: Record<string, number> = {format: 0, parse: 1};
	result.sort(
		(a, b) =>
			(OP_ORDER[a.operation] ?? 9) - (OP_ORDER[b.operation] ?? 9) ||
			(LANG_ORDER[a.language] ?? 9) - (LANG_ORDER[b.language] ?? 9),
	);

	return result;
};

export const derive_speedup_summary = (groups: Array<BenchmarkGroup>): Array<SpeedupRow> => {
	const find_speedup = (
		operation: string,
		language: string,
		primary_name: string,
	): number | undefined => {
		const group = groups.find((g) => g.operation === operation && g.language === language);
		if (!group?.canonical_entry) return undefined;
		const entry = group.entries.find((e) => e.name === primary_name);
		if (!entry) return undefined;
		return group.canonical_entry.mean_ns / entry.mean_ns;
	};

	return [
		{
			variant: 'native',
			format_svelte: find_speedup('format', 'svelte', PRIMARY_NATIVE_FORMAT),
			format_typescript: find_speedup('format', 'typescript', PRIMARY_NATIVE_FORMAT),
			format_css: find_speedup('format', 'css', PRIMARY_NATIVE_FORMAT),
		},
		{
			variant: 'wasm',
			format_svelte: find_speedup('format', 'svelte', PRIMARY_WASM_FORMAT),
			format_typescript: find_speedup('format', 'typescript', PRIMARY_WASM_FORMAT),
			format_css: find_speedup('format', 'css', PRIMARY_WASM_FORMAT),
		},
	];
};

// Formatting utilities

export interface FormattedUnit {
	value: string;
	unit: string;
}

export const format_ns = (ns: number): FormattedUnit => {
	if (ns < 1_000) return {value: `${Math.round(ns)}`, unit: 'ns'};
	if (ns < 1_000_000)
		return {
			value: (ns / 1_000).toFixed(ns < 10_000 ? 2 : ns < 100_000 ? 1 : 0),
			unit: 'µs',
		};
	const ms = Math.round(ns / 1_000_000);
	return {value: ms.toLocaleString('en-US'), unit: 'ms'};
};

export const format_bytes = (bytes: number): FormattedUnit => {
	if (bytes < 1_024) return {value: `${bytes}`, unit: 'B'};
	if (bytes < 1_048_576) return {value: (bytes / 1_024).toFixed(0), unit: 'KB'};
	return {value: (bytes / 1_048_576).toFixed(1), unit: 'MB'};
};

/**
 * Formats per-implementation corpus coverage as `processed/total`, or
 * `undefined` when either value is missing (older baselines without coverage).
 */
export const format_coverage = (
	processed: number | null | undefined,
	total: number | null | undefined,
): string | undefined => {
	if (processed == null || total == null) return undefined;
	return `${processed}/${total}`;
};

/**
 * Formats a gzipped binary size as a bar annotation (e.g. `716.6 KB gz`), or
 * `undefined` when the baseline lacks it (older runs, or no `gzip` available
 * on the generating machine).
 */
export const format_gzip_size = (gzip_bytes: number | null | undefined): string | undefined => {
	if (gzip_bytes == null) return undefined;
	const {value, unit} = format_bytes(gzip_bytes);
	return `${value} ${unit} gz`;
};

/** Matches the bench report generator's ratio formatting so the site and report.md agree digit for digit. */
export const format_speedup = (ratio: number): string =>
	ratio >= 10 ? `${ratio.toFixed(1)}x` : `${ratio.toFixed(2)}x`;

/** Hyphenated tool names that should preserve their hyphens in display labels. */
const HYPHENATED_NAMES = ['acorn-typescript', 'oxc-parser'];

export const format_label = (name: string): string => {
	for (const tool of HYPHENATED_NAMES) {
		if (name.startsWith(tool)) {
			return tool + name.slice(tool.length).replaceAll('-', ' ');
		}
	}
	return name.replaceAll('-', ' ');
};

/** Returns a CSS background color variable for a category. */
export const category_color = (category: ImplementationCategory): string => {
	switch (category) {
		case 'canonical':
			return 'var(--color_h_40)';
		case 'tsv_native':
			return 'var(--color_g_40)';
		case 'tsv_native_json':
			return 'var(--color_e_40)';
		case 'tsv_wasm':
			return 'var(--color_d_40)';
		case 'tsv_wasm_json':
			return 'var(--color_f_40)';
		case 'biome':
			return 'var(--color_a_40)';
		case 'oxc':
			return 'var(--color_i_40)';
	}
};

/** Returns a CSS color variable for a size ratio (inverted — bigger is worse). */
export const size_ratio_color = (ratio: number): string => {
	if (ratio < 2) return 'var(--color_b_50)'; // green — similar
	if (ratio < 5) return 'var(--color_e_50)'; // yellow — notably larger
	return 'var(--color_c_50)'; // red — much larger
};

/** Returns a CSS color variable for the speedup ratio. */
export const speedup_color = (ratio: number): string => {
	if (ratio < 0.5) return 'var(--color_c_50)'; // red — much slower
	if (ratio < 1) return 'var(--color_h_50)'; // orange — slower
	if (ratio < 2) return 'var(--color_e_50)'; // yellow — modest
	if (ratio < 5) return 'var(--color_b_50)'; // green — fast
	return 'var(--color_j_50)'; // teal — exceptional
};

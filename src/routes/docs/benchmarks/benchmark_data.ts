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
	// A placeholder entry mirrored from another language's group for a tool that
	// doesn't run in this one (e.g. `oxc-parser` under svelte/css parse) — rendered
	// grayed-out and inert so the parse groups share one entry order. Absent on real,
	// measured entries.
	disabled?: boolean;
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

export const categorize_name = (name: string): ImplementationCategory =>
	CATEGORY_BY_NAME[name] ?? 'oxc';

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

	// `oxc-parser` only parses TypeScript/JS, so the svelte and css parse groups
	// lack it. Mirror its entries in as disabled placeholders — slotted just after
	// the JS-materializing `*-json` entries, the same position they hold in the
	// typescript group — so all three parse groups scan with one shared entry order.
	const ts_parse = result.find((g) => g.operation === 'parse' && g.language === 'typescript');
	const oxc_templates = ts_parse?.entries.filter((e) => e.category === 'oxc') ?? [];
	if (oxc_templates.length > 0) {
		for (const group of result) {
			if (group.operation !== 'parse' || group.language === 'typescript') continue;
			if (group.entries.some((e) => e.category === 'oxc')) continue;
			// index just past the last `*-json` entry (fall back to just below the
			// canonical row if none), matching oxc's slot in the typescript group
			const insert_at = group.entries.reduce(
				(idx, e, i) => (e.name.endsWith('-json') ? i + 1 : idx),
				1,
			);
			const placeholders: Array<BenchmarkDisplayEntry> = oxc_templates.map((e) => ({
				...e,
				bar_fraction: 0,
				speedup_vs_canonical: undefined,
				files_processed: null,
				files_total: null,
				disabled: true,
			}));
			group.entries.splice(insert_at, 0, ...placeholders);
		}
	}

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

// Binary-size grouping by capability

/** What a build actually does, used to group binary sizes for like-for-like comparison. */
export type SizeCapability = 'full' | 'formatter' | 'parser';

/**
 * Buckets a binary-size label by capability so each build lands next to its
 * closest competitor: `parser` (tsv's parse-only build, `oxc-parser`),
 * `formatter` (tsv's format-only build, `oxfmt`), else `full` (the flagship
 * parse+format builds and `biome`).
 */
export const categorize_size_capability = (label: string): SizeCapability => {
	if (label.includes('parse')) return 'parser'; // tsv parse (ffi), tsv_parse_wasm, oxc-parser
	if (label.includes('format') || label.includes('fmt')) return 'formatter'; // tsv format, oxfmt
	return 'full'; // tsv (napi/ffi), tsv_wasm, biome
};

export interface SizeDisplayEntry extends BinarySize {
	bar_fraction: number;
	// size relative to tsv's build of the SAME kind (wasm vs wasm, native vs
	// native) — undefined for the anchor itself and where tsv has no same-kind build
	ratio_vs_tsv: number | undefined;
	category: ImplementationCategory;
}

export interface SizeCapabilityGroup {
	capability: SizeCapability;
	heading: string;
	entries: Array<SizeDisplayEntry>;
}

const SIZE_CAPABILITY_ORDER: ReadonlyArray<{capability: SizeCapability; heading: string}> = [
	{capability: 'full', heading: 'Full toolchain (parse + format)'},
	{capability: 'formatter', heading: 'Formatter'},
	{capability: 'parser', heading: 'Parser'},
];

/**
 * Groups the binary sizes by capability (full / formatter / parser), each group
 * mixing wasm and native builds sorted smallest-first. Bars scale to the group's
 * largest build; the `vs tsv` ratio anchors on tsv's build of the same kind
 * (matching the node report's `tsv_wasm` / `tsv (napi)` anchors) so wasm compares
 * against wasm and native against native.
 */
export const derive_size_groups = (sizes: Array<BinarySize>): Array<SizeCapabilityGroup> => {
	const groups: Array<SizeCapabilityGroup> = [];
	for (const {capability, heading} of SIZE_CAPABILITY_ORDER) {
		const items = sizes.filter((s) => categorize_size_capability(s.label) === capability);
		if (items.length === 0) continue;
		const sorted = items.toSorted((a, b) => a.bytes - b.bytes);
		const max = Math.max(0, ...items.map((s) => s.bytes));
		const anchor_of = (kind: BinarySize['kind']): BinarySize | undefined => {
			const pool = sorted.filter((s) => s.kind === kind);
			return (
				pool.find((s) => s.label === 'tsv_wasm' || s.label === 'tsv (napi)') ??
				pool.find((s) => s.label.startsWith('tsv'))
			);
		};
		const wasm_anchor = anchor_of('wasm');
		const native_anchor = anchor_of('native');
		const entries: Array<SizeDisplayEntry> = sorted.map((s) => {
			const anchor = s.kind === 'wasm' ? wasm_anchor : native_anchor;
			return {
				...s,
				bar_fraction: max > 0 ? s.bytes / max : 0,
				ratio_vs_tsv: anchor && s !== anchor ? s.bytes / anchor.bytes : undefined,
				category: categorize_size(s.label),
			};
		});
		groups.push({capability, heading, entries});
	}
	return groups;
};

// Cross-runtime combined report (the bench composer's `report.json`, `kind: 'combined'`)

export type BenchmarkRuntime = 'deno' | 'node' | 'bun';

export interface CrossRuntimeRow {
	group: string;
	name: string;
	ops_per_second: Partial<Record<BenchmarkRuntime, number>>;
	mean_ns: Partial<Record<BenchmarkRuntime, number>>;
	files_iterated: Partial<Record<BenchmarkRuntime, number | null>>;
}

export interface CrossRuntimeReport {
	version: number;
	kind: 'combined';
	generated: string;
	runtimes: Array<BenchmarkRuntime>;
	sources: Array<{
		runtime: BenchmarkRuntime;
		timestamp: string;
		git_commit: string | null;
		tsv: string | null;
	}>;
	rows: Array<CrossRuntimeRow>;
}

export interface CrossRuntimeDisplayRow {
	name: string;
	category: ImplementationCategory;
	ops_per_second: Partial<Record<BenchmarkRuntime, number>>;
	// ratio of each runtime vs the base (first present) runtime; `> 1` = faster
	ratio_vs_base: Partial<Record<BenchmarkRuntime, number>>;
}

export interface CrossRuntimeGroup {
	group: string;
	operation: string;
	language: string;
	rows: Array<CrossRuntimeDisplayRow>;
}

const CROSS_RUNTIME_LANG_ORDER: Record<string, number> = {svelte: 0, typescript: 1, css: 2};
const CROSS_RUNTIME_OP_ORDER: Record<string, number> = {format: 0, parse: 1};

/**
 * Groups the combined report's rows by benchmark group, in the same display
 * order as `derive_benchmark_groups` (format before parse, then svelte /
 * typescript / css). The ratio base is the first runtime in `report.runtimes`
 * (deno in a full run), matching the bench's `report.md`.
 */
export const derive_cross_runtime_groups = (
	report: CrossRuntimeReport,
): Array<CrossRuntimeGroup> => {
	const base = report.runtimes[0];
	const grouped: Map<string, Array<CrossRuntimeDisplayRow>> = new Map();
	for (const row of report.rows) {
		let rows = grouped.get(row.group);
		if (!rows) {
			rows = [];
			grouped.set(row.group, rows);
		}
		const base_ops = base ? row.ops_per_second[base] : undefined;
		const ratio_vs_base: Partial<Record<BenchmarkRuntime, number>> = {};
		for (const runtime of report.runtimes) {
			const ops = row.ops_per_second[runtime];
			if (ops != null && base_ops != null && base_ops > 0) {
				ratio_vs_base[runtime] = ops / base_ops;
			}
		}
		rows.push({
			name: row.name,
			category: categorize_name(row.name),
			ops_per_second: row.ops_per_second,
			ratio_vs_base,
		});
	}

	const result: Array<CrossRuntimeGroup> = [];
	for (const [group, rows] of grouped) {
		const [operation, language] = group.split('/');
		result.push({group, operation: operation!, language: language!, rows});
	}
	result.sort(
		(a, b) =>
			(CROSS_RUNTIME_OP_ORDER[a.operation] ?? 9) - (CROSS_RUNTIME_OP_ORDER[b.operation] ?? 9) ||
			(CROSS_RUNTIME_LANG_ORDER[a.language] ?? 9) - (CROSS_RUNTIME_LANG_ORDER[b.language] ?? 9),
	);
	return result;
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

/**
 * Cross-runtime ratio cell background: a stable fuz_css red (`color_c`) / green
 * (`color_b`) whose ALPHA varies with distance from parity. Fully transparent at ratio
 * `1.0` (parity recedes), ramping to `0.3` alpha at ratio `0.8` and below (red) or `1.2`
 * and above (green). The hue stays constant — only opacity moves — so it reads
 * consistently in light and dark themes while the cell's text keeps the default color.
 * Deliberately its own scale — NOT the shared `speedup_color` — because cross-runtime
 * deltas cluster tightly near 1.0 and this must not bleed into the other displays.
 */
export const cross_runtime_ratio_background = (ratio: number): string => {
	// 0 alpha at ratio 1.0, up to 0.3 at ratio ≤ 0.8 (red) or ≥ 1.2 (green)
	const alpha = Math.min(1, Math.abs(ratio - 1) / 0.2) * 0.3;
	const color = ratio < 1 ? 'var(--color_c_50)' : 'var(--color_b_50)';
	return `color-mix(in srgb, ${color} ${(alpha * 100).toFixed(1)}%, transparent)`;
};

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
	// name of the entry the ratios anchor on by default — the canonical reference
	// (Prettier for format, the JS baseline for parse), the group's first row. The
	// hover-to-rebaseline UI restores this anchor when the pointer leaves the group.
	anchor_name: string | undefined;
	// files the timed benchmark actually iterated (the per-group intersection);
	// null on older baselines (< version 4) that don't carry `files_iterated`
	files_iterated: number | null;
}

export interface BenchmarkDisplayEntry {
	name: string;
	mean_ns: number;
	bar_fraction: number;
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
		// The group's default ratio anchor is its canonical reference — Prettier for
		// format, the JS baseline (svelte/compiler, acorn-typescript) for parse — which
		// the sort below pins first, so each group's leading row reads 1.0x and the rest
		// read relative to it. (Size groups anchor on their smallest build; see
		// `derive_size_groups`.) It's recorded as `anchor_name`; the shared component
		// owns every ratio, and hovering a row re-baselines the group onto that row.
		const canonical_name = CANONICAL_BY_GROUP[group_key];
		const canonical_entry_raw = entries.find((e) => e.name === canonical_name);
		const slowest = Math.max(...entries.map((e) => e.mean_ns));

		const display_entries: Array<BenchmarkDisplayEntry> = entries.map((e) => ({
			name: e.name,
			mean_ns: e.mean_ns,
			bar_fraction: slowest > 0 ? e.mean_ns / slowest : 0,
			category: categorize_name(e.name),
			files_processed: e.files_processed ?? null,
			files_total: e.files_total ?? null,
		}));

		// Sort: canonical (the anchor) first so every group's 1.0x row leads, then the
		// rest by mean_ns descending (slowest first for visual)
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
			anchor_name: canonical_entry_raw?.name,
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

	// Neither `biome` nor (for svelte/css) `oxc-parser` has a real entry in every
	// parse group. `biome`'s `@biomejs/js-api` never exposes a parser to JS at all
	// (only formatting and linting), so no parse group has a real biome entry;
	// `oxc-parser` only parses TypeScript/JS, so the svelte and css parse groups
	// lack it. Mirror both in as disabled placeholders — biome always, oxc-parser
	// only where it's missing — slotted just after the JS-materializing `*-json`
	// entries (the same position oxc's entries hold in the typescript group), so
	// all three parse groups scan with one shared entry order.
	const ts_parse = result.find((g) => g.operation === 'parse' && g.language === 'typescript');
	const oxc_templates = ts_parse?.entries.filter((e) => e.category === 'oxc') ?? [];
	for (const group of result) {
		if (group.operation !== 'parse') continue;
		// index just past the last `*-json` entry (fall back to just below the
		// canonical row if none), matching oxc's slot in the typescript group
		const insert_at = group.entries.reduce(
			(idx, e, i) => (e.name.endsWith('-json') ? i + 1 : idx),
			1,
		);
		const biome_placeholder: BenchmarkDisplayEntry = {
			name: 'biome-wasm',
			mean_ns: 0,
			bar_fraction: 0,
			category: 'biome',
			files_processed: null,
			files_total: null,
			disabled: true,
		};
		const needs_oxc =
			group.language !== 'typescript' && !group.entries.some((e) => e.category === 'oxc');
		const oxc_placeholders: Array<BenchmarkDisplayEntry> = needs_oxc
			? oxc_templates.map((e) => ({
					...e,
					bar_fraction: 0,
					files_processed: null,
					files_total: null,
					disabled: true,
				}))
			: [];
		group.entries.splice(insert_at, 0, biome_placeholder, ...oxc_placeholders);
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
 * parse+format builds, `biome`, and the combined `oxc-parser + oxfmt` entry).
 */
export const categorize_size_capability = (label: string): SizeCapability => {
	const has_parse = label.includes('parse');
	const has_format = label.includes('format') || label.includes('fmt');
	// a build that does both is a full toolchain (e.g. the combined oxc-parser + oxfmt entry)
	if (has_parse && has_format) return 'full';
	if (has_parse) return 'parser'; // tsv parse (ffi), tsv_parse_wasm, oxc-parser
	if (has_format) return 'formatter'; // tsv format, oxfmt
	return 'full'; // tsv (napi/ffi), tsv_wasm, biome
};

export interface SizeDisplayEntry extends BinarySize {
	bar_fraction: number;
	category: ImplementationCategory;
	// a grayed-out, inert placeholder for a build that doesn't exist (e.g. oxfmt's
	// absent wasm build) — no bar, no size, just the label held in its slot. Absent
	// on real, measured entries.
	disabled?: boolean;
}

export interface SizeCapabilityGroup {
	capability: SizeCapability;
	heading: string;
	// label of the group's smallest build — the default ratio anchor (reads 1.0x).
	// The hover-to-rebaseline UI restores it when the pointer leaves the group.
	anchor_label: string | undefined;
	entries: Array<SizeDisplayEntry>;
}

const SIZE_CAPABILITY_ORDER: ReadonlyArray<{capability: SizeCapability; heading: string}> = [
	{capability: 'full', heading: 'Full toolchain (parse + format)'},
	{capability: 'formatter', heading: 'Formatter'},
	{capability: 'parser', heading: 'Parser'},
];

/** Display label for the synthesized combined oxc full-toolchain build. */
export const OXC_FULL_LABEL = 'oxc-parser + oxfmt (napi)';

/** Display label for oxfmt's absent wasm build placeholder — see `derive_size_groups`. */
export const OXFMT_WASM_LABEL = 'oxfmt (wasm)';

/**
 * Synthesizes oxc's full-toolchain native build by summing its separately-shipped
 * parser (`oxc-parser (napi)`) and formatter (`oxfmt (napi)`) packages — together
 * they're the closest equivalent to tsv's single parse+format build, so the entry
 * stands beside `tsv (napi)` in the full-toolchain group. Returns `undefined` when
 * either half is missing (older baselines), and sums gzip only when both carry it.
 */
const synthesize_oxc_full = (sizes: Array<BinarySize>): BinarySize | undefined => {
	const parser = sizes.find((s) => s.label === 'oxc-parser (napi)');
	const formatter = sizes.find((s) => s.label === 'oxfmt (napi)');
	if (!parser || !formatter) return undefined;
	return {
		label: OXC_FULL_LABEL,
		bytes: parser.bytes + formatter.bytes,
		kind: 'native',
		gzip_bytes:
			parser.gzip_bytes != null && formatter.gzip_bytes != null
				? parser.gzip_bytes + formatter.gzip_bytes
				: null,
	};
};

/**
 * Groups the binary sizes by capability (full / formatter / parser), each group
 * mixing wasm and native builds sorted smallest-first. Bars scale to the group's
 * largest build; the `vs` ratio anchors on the group's single smallest build, so
 * exactly one entry reads 1.0x and every other is a multiple of it. (In the current
 * data that smallest build is always one of tsv's, so tsv reads 1.0x and the heavier
 * competitors read >1.0x.) A combined `oxc-parser + oxfmt` entry is
 * synthesized into the full-toolchain group, since oxc ships parse and format apart.
 * oxfmt has no wasm build, so the formatter group gets a disabled `oxfmt (wasm)`
 * placeholder slotted just above its real `oxfmt (napi)` entry, holding the slot
 * rather than omitting it.
 */
export const derive_size_groups = (sizes: Array<BinarySize>): Array<SizeCapabilityGroup> => {
	const oxc_full = synthesize_oxc_full(sizes);
	const all_sizes = oxc_full ? [...sizes, oxc_full] : sizes;
	const groups: Array<SizeCapabilityGroup> = [];
	for (const {capability, heading} of SIZE_CAPABILITY_ORDER) {
		const items = all_sizes.filter((s) => categorize_size_capability(s.label) === capability);
		if (items.length === 0) continue;
		const sorted = items.toSorted((a, b) => a.bytes - b.bytes);
		const max = Math.max(0, ...items.map((s) => s.bytes));
		// one baseline per group: the smallest build reads 1.0x and every other build a
		// multiple of it, so a mixed wasm/native group has a single anchor rather than
		// the confusing pair a per-kind anchor produced (`sorted` is ascending, so its
		// first entry is the smallest)
		const anchor = sorted[0];
		const entries: Array<SizeDisplayEntry> = sorted.map((s) => ({
			...s,
			bar_fraction: max > 0 ? s.bytes / max : 0,
			category: categorize_size(s.label),
		}));
		if (capability === 'formatter' && !entries.some((e) => e.label === OXFMT_WASM_LABEL)) {
			const native_index = entries.findIndex((e) => e.label === 'oxfmt (napi)');
			const placeholder: SizeDisplayEntry = {
				label: OXFMT_WASM_LABEL,
				bytes: 0,
				kind: 'wasm',
				gzip_bytes: null,
				bar_fraction: 0,
				category: categorize_size(OXFMT_WASM_LABEL),
				disabled: true,
			};
			entries.splice(native_index === -1 ? entries.length : native_index, 0, placeholder);
		}
		groups.push({capability, heading, anchor_label: anchor?.label, entries});
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

/** Hyphenated tool names that should preserve their hyphens in display labels. */
const HYPHENATED_NAMES = ['acorn-typescript', 'oxc-parser'];

/**
 * Display labels for the raw benchmark entry names, annotating each with the
 * runtime binding it runs under in the Node report — native builds load the N-API
 * addon (`napi`), and the third-party wasm builds are marked `(wasm)`. Mirrors the
 * parenthesized suffixes the binary-size section's labels already carry. tsv's own
 * wasm entries keep their `tsv_wasm` package-name style, as in the size groups, so
 * they aren't listed here. The already-parenthesized size labels aren't keys, so
 * they fall through to the generic formatting below unchanged.
 */
const LABEL_OVERRIDES: Record<string, string> = {
	tsv: 'tsv (napi)',
	'tsv-json': 'tsv json (napi)',
	'tsv-internal': 'tsv internal (napi)',
	'oxc-parser': 'oxc-parser (napi)',
	oxfmt: 'oxfmt (napi)',
	'biome-wasm': 'biome (wasm)',
	'oxc-parser-wasm': 'oxc-parser (wasm)',
};

export const format_label = (name: string): string => {
	const override = LABEL_OVERRIDES[name];
	if (override) return override;
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

/**
 * Returns a CSS color variable for a size ratio (inverted — bigger is worse).
 * Green is reserved for builds smaller than the baseline (ratio < 1, only reachable
 * once a hover re-baselines onto a larger build); any build at or above the baseline
 * reads yellow at the floor, ramping through orange to red as it grows.
 */
export const size_ratio_color = (ratio: number): string => {
	if (ratio < 1) return 'var(--color_b_50)'; // green — smaller than baseline
	if (ratio < 3) return 'var(--color_e_50)'; // yellow — larger
	if (ratio < 10) return 'var(--color_h_50)'; // orange — much larger
	return 'var(--color_c_50)'; // red — enormous
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

// Interactive baseline (hover-to-rebaseline)

/**
 * Which way a group's ratio runs, so re-anchoring on hover stays consistent. A
 * `speed` group (format/parse) reads its anchor as a reference speed — faster
 * entries are positive multiples, slower ones negative (`format_speedup_signed` /
 * `speedup_color`). A `size` group reads its anchor as a reference size — bigger
 * builds are multiples ≥ 1 (`format_size_ratio` / `size_ratio_color`). The two
 * ratios are reciprocals, which is exactly why one direction flag suffices.
 */
export type BaselineDirection = 'speed' | 'size';

/** An entry's ratio against its group's anchor, in the group's direction. */
export const compute_baseline_ratio = (
	direction: BaselineDirection,
	entry_raw: number,
	anchor_raw: number,
): number => (direction === 'speed' ? anchor_raw / entry_raw : entry_raw / anchor_raw);

/** Plain size ratio (`2.3x`) — its own formatter since sizes never take the signed treatment. */
export const format_size_ratio = (ratio: number): string => `${ratio.toFixed(1)}x`;

/** Formats a baseline ratio for display in the given direction. */
export const format_baseline_ratio = (direction: BaselineDirection, ratio: number): string =>
	direction === 'speed' ? format_speedup_signed(ratio) : format_size_ratio(ratio);

/** Color for a baseline ratio in the given direction. */
export const baseline_ratio_color = (direction: BaselineDirection, ratio: number): string =>
	direction === 'speed' ? speedup_color(ratio) : size_ratio_color(ratio);

/**
 * A normalized row for `BenchmarksBaselineGroup` — the shared hover-to-rebaseline
 * column behind the format, parse, and binary-size groups. `raw` is the number the
 * ratio derives from (mean ns for speed, bytes for size); `value` is its formatted
 * display. Flattening the group-specific display entries to this one shape lets a
 * single component own the anchor state for all three sections.
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
}

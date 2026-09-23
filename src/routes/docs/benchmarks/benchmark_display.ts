// Display helpers shared by the benchmarks and conformance pages: value formatters for
// times, sizes, and ratios, the row labels, and the per-category colors.

import type {
	BenchmarkBaseline,
	GroupOmissions,
	ImplementationCategory
} from './benchmark_data.ts';

/** A count with thousands separators (`44,220`), pinned to one locale so prerendered and hydrated output agree. */
export const format_count = (n: number): string => n.toLocaleString('en-US');

/**
 * A report timestamp as a date (`September 23, 2026`), pinned to one locale and
 * to UTC so the prerendering machine's zone doesn't pick the day.
 */
export const format_report_date = (timestamp: string): string =>
	new Date(timestamp).toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
		timeZone: 'UTC'
	});

/** `format_count` for prose over a figure the report may lack: `—` rather than a throw mid-sentence. */
export const format_count_maybe = (n: number | null | undefined): string =>
	n == null ? '—' : format_count(n);

export interface FormattedUnit {
	value: string;
	unit: string;
}

export const format_ns = (ns: number): FormattedUnit => {
	if (ns < 1_000) return { value: `${Math.round(ns)}`, unit: 'ns' };
	// the µs tier ends where its rounding would print `1000`, not at 1 ms exactly,
	// and each decimal step inside it where its rounding would print a digit more
	if (ns < 999_500)
		return {
			value: (ns / 1_000).toFixed(ns < 9_995 ? 2 : ns < 99_950 ? 1 : 0),
			unit: 'µs'
		};
	// one decimal under 10 ms, so the short CSS rows print values that still
	// reproduce the ratios beside them (`3.9 ms` against `11.3 ms`, not `4` and `11`);
	// the tier ends where its rounding would print `10.0`
	if (ns < 9_950_000) return { value: (ns / 1_000_000).toFixed(1), unit: 'ms' };
	const ms = Math.round(ns / 1_000_000);
	return { value: format_count(ms), unit: 'ms' };
};

/**
 * A byte count in decimal units (1 KB = 1,000 B), as tsv's own report reckons
 * its binary sizes — but rounded to whole KB below the MB tier, where the report
 * keeps a decimal, so the same artifact reads `966 KB` here and `966.4 KB` there.
 * These are bar annotations, not a size table.
 */
export const format_bytes = (bytes: number): FormattedUnit => {
	if (bytes < 1_000) return { value: `${bytes}`, unit: 'B' };
	// the KB tier ends where its rounding would print `1000`, as `format_ns`'s tiers do
	if (bytes < 999_500) return { value: (bytes / 1_000).toFixed(0), unit: 'KB' };
	return { value: (bytes / 1_000_000).toFixed(1), unit: 'MB' };
};

/**
 * A CLI run's duration, as the harness reports it in milliseconds: whole `ms`
 * under a second, one decimal of `s` from there (`62 ms`, `1.6 s`). The `ms` tier
 * ends where its rounding would print `1000`, as `format_ns`'s tiers do.
 */
export const format_ms = (ms: number): string =>
	ms < 999.5 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;

/**
 * A rounded millisecond span for prose (`28–34 ms`), collapsing to its rounded
 * midpoint when the ends round at most 1 ms apart, a spread too fine to quote;
 * `—` for a missing one, as `format_ratio_approx`.
 */
export const format_ms_range = (range: { min: number; max: number } | undefined): string => {
	if (!range) return '—';
	const low = Math.round(range.min);
	const high = Math.round(range.max);
	return high - low <= 1 ? `${Math.round((range.min + range.max) / 2)} ms` : `${low}–${high} ms`;
};

/** Peak memory in whole MiB (`50 MiB`); `—` when the harness measured none. */
export const format_mib = (mib: number | null | undefined): string =>
	mib == null ? '—' : `${Math.round(mib)} MiB`;

/**
 * Formats a gzipped binary size as a bar annotation (e.g. `717 KB gz`), or
 * `undefined` when `gzip` was unavailable on the generating machine.
 */
export const format_gzip_size = (gzip_bytes: number | null | undefined): string | undefined => {
	if (gzip_bytes == null) return undefined;
	const { value, unit } = format_bytes(gzip_bytes);
	return `${value} ${unit} gz`;
};

/**
 * How many times better a row is than its reference, for every chart and table on
 * the page: at or above the reference it reads as a plain multiple (`2.50x`), while
 * a worse row shows the reciprocal negated (`0.15x` → `-6.67x`) so "how many times
 * slower, or bigger" is directly legible instead of a fraction the reader has to
 * invert. The minus is a convention for "times worse", not a literal negative rate,
 * so a worse row that rounds to `1.00x` prints unsigned — no direction to show.
 * Two decimals under 10 and one from there, as the bench report's own ratios print.
 */
export const format_speedup = (ratio: number): string => {
	const magnitude = ratio >= 1 ? ratio : 1 / ratio;
	const digits = magnitude >= 10 ? 1 : 2;
	const text = magnitude.toFixed(digits);
	return `${ratio < 1 && text !== '1.00' ? '-' : ''}${text}x`;
};

/**
 * Loose ratio formatting for prose, which reads better with fewer digits than a
 * table column (`1.7x`, `26x`) — always paired with a `~` in the copy. Renders
 * `—` for a missing ratio rather than throwing mid-sentence; the benchmark tests
 * assert every ratio the page quotes actually resolves.
 */
export const format_ratio_approx = (ratio: number | undefined): string =>
	// the tier is read off the rounded figure, so 9.97 reads `10x` rather than `10.0x`
	ratio === undefined ? '—' : ratio >= 9.95 ? `${Math.round(ratio)}x` : `${ratio.toFixed(1)}x`;

/**
 * Formats a coverage fraction as a percentage with two decimals (`99.85%`),
 * FLOORED rather than rounded — rounding would render e.g. 44219/44220 as
 * `100.00%` next to a visibly non-total count. Only exact totality reads 100%
 * (matching the harness's own `coverage_pct` convention in tsv's report.ts).
 */
export const format_coverage_percent = (fraction: number): string =>
	// the epsilon is for the already-divided fraction: scaling it back up reintroduces
	// representation error BELOW the floor, which reads an exact hundredth one low
	// (`0.57` floors to `56.99%`). Far above that error, far below a real hundredth.
	`${(Math.floor(fraction * 10_000 + 1e-9) / 100).toFixed(2)}%`;

/** `cv 47.8%, raw cv 52.0%, drift +38.0%` — the readings behind an unstable row, absent ones omitted. */
export const format_unstable_readings = (entry: {
	cv: number | null;
	cv_raw?: number | null;
	drift?: number | null;
}): string => {
	const parts: Array<string> = [];
	if (entry.cv != null) parts.push(`cv ${(entry.cv * 100).toFixed(1)}%`);
	if (entry.cv_raw != null) parts.push(`raw cv ${(entry.cv_raw * 100).toFixed(1)}%`);
	if (entry.drift != null) {
		parts.push(`drift ${entry.drift >= 0 ? '+' : ''}${(entry.drift * 100).toFixed(1)}%`);
	}
	return parts.join(', ');
};

/**
 * A fraction as a whole-number percentage for prose (`38%`), always paired with
 * a `~` in the copy; `—` for a missing one, as `format_ratio_approx`.
 */
export const format_share_approx = (fraction: number | undefined): string =>
	fraction === undefined ? '—' : `${Math.round(fraction * 100)}%`;

/**
 * A part of a whole as a percentage with one decimal (`11.2%`). Rounded, with both
 * edges clamped so neither can lie: a nonzero part never reads `0.0%` (`<0.1%`) and a
 * partial one never reads `100.0%` (`>99.9%`). Not floored like
 * `format_coverage_percent` — there only the top edge can mislead, where a share has
 * two, and flooring would understate it. `0%` for an empty whole.
 */
export const format_percent = (part: number, whole: number): string => {
	if (whole <= 0 || part <= 0) return '0%';
	if (part >= whole) return '100%';
	const percent = (part / whole) * 100;
	if (percent < 0.05) return '<0.1%';
	if (percent >= 99.95) return '>99.9%';
	return `${percent.toFixed(1)}%`;
};

/**
 * An inclusive ratio range for prose (`2.9–4.6x`, `6–21x`), FLOORED at both ends
 * — to one decimal under 10, to a whole number from 10 — so a "less memory" claim
 * never overstates either bound while keeping the precision `format_ratio_approx`
 * gives a single ratio. Two ends that floor to the same figure collapse to it
 * (`2.9x`, never `2.9–2.9x`). `—` for a missing range, as `format_ratio_approx`.
 */
export const format_ratio_range = (range: { min: number; max: number } | undefined): string => {
	if (!range) return '—';
	const low = floor_ratio(range.min);
	const high = floor_ratio(range.max);
	return low === high ? `${low}x` : `${low}–${high}x`;
};

const floor_ratio = (ratio: number): string =>
	ratio >= 10 ? `${Math.floor(ratio)}` : (Math.floor(ratio * 10) / 10).toFixed(1);

/**
 * Hyphenated tool and package names that keep their hyphens in display labels —
 * only the suffix after the name is spaced out (`tsv-wasm-json` → `tsv-wasm json`).
 */
const HYPHENATED_NAMES = [
	'acorn-typescript',
	'oxc-parser',
	'rsvelte-fmt',
	'yuku-parser',
	'tsv-wasm',
	'tsv-format-wasm',
	'tsv-parse-wasm'
];

/**
 * Display labels for the raw benchmark entry names in the main (Node) tables,
 * annotating each with the runtime **and** binding it runs under — the native
 * builds load the N-API addon under Node, so they read `(node napi)` to
 * distinguish them from the same rows under Deno, which loads the C-FFI library
 * instead (see the cross-runtime table); the third-party wasm builds are marked
 * `(wasm)`, mirroring the suffixes the binary-size labels already carry. The
 * cross-runtime table neutralizes the `(node napi)` suffix per row (its
 * columns span runtimes) via `format_cross_runtime_label`.
 */
const LABEL_OVERRIDES: Record<string, string> = {
	tsv: 'tsv (node napi)',
	'tsv-json': 'tsv json (node napi)',
	// `no-locs` (not `no-locations`) — the full word eats too much column width.
	'tsv-json-no-locations': 'tsv json no-locs (node napi)',
	// the one tsv-wasm entry listed here: the generic formatting below would
	// break the `no-locs` hyphen its native sibling deliberately keeps
	'tsv-wasm-json-no-locations': 'tsv-wasm json no-locs',
	'tsv-internal': 'tsv internal (node napi)',
	'oxc-parser': 'oxc-parser (node napi)',
	oxfmt: 'oxfmt (node napi)',
	'biome-wasm': 'biome (wasm)',
	'dprint-wasm': 'dprint (wasm)',
	'malva-wasm': 'malva (wasm)',
	'oxc-parser-wasm': 'oxc-parser (wasm)',
	'yuku-parser': 'yuku-parser (node napi)',
	'yuku-parser-wasm': 'yuku-parser (wasm)',
	swc: 'swc (node napi)',
	// both rsvelte parse rows are the same N-API addon, distinguished by the option
	// the second one passes — kept in the label, since that option IS the row
	'rsvelte-parse': 'rsvelte-parse (node napi)',
	'rsvelte-parse-skip-expr-loc': 'rsvelte-parse skip-expr-loc (node napi)'
	// `postcss` needs no entry: it's plain JS with no binding to name, like `prettier`
};

/** The report's language keys as the page prints them, shared by every group heading. */
const LANGUAGE_LABELS: Record<string, string> = {
	svelte: 'Svelte',
	// the group parses plain JS as well as TypeScript
	typescript: 'TypeScript/JS',
	css: 'CSS'
};

/** A report language key for display (`typescript` → `TypeScript/JS`), verbatim when unknown. */
export const format_language = (language: string): string => LANGUAGE_LABELS[language] ?? language;

/** A group's name as its headings and table labels print it (`Format TypeScript/JS`). */
export const format_group_label = (operation: string, language: string): string =>
	`${operation === 'format' ? 'Format' : 'Parse'} ${format_language(language)}`;

/**
 * Display names for the report's version keys whose underscore form isn't just
 * hyphenation — mostly scoped npm packages whose bare tool name would point at a
 * different release line. Everything absent here hyphenates (`oxc_parser` →
 * `oxc-parser`) through `format_version_label`.
 */
export const VERSION_LABELS: Record<string, string> = {
	// Svelte's fork, a different npm package from the unscoped `acorn-typescript`
	acorn_ts: '@sveltejs/acorn-typescript',
	prettier_svelte: 'prettier-plugin-svelte',
	// the tool name would read as the dprint CLI, which is a different version line
	dprint: '@dprint/typescript',
	rsvelte_fmt: '@rsvelte/fmt',
	// the oxc-parser wasm row's binding, its own scoped package
	oxc_parser_wasm: '@oxc-parser/binding-wasm32-wasi',
	// the wasm binding is its own scoped package, not a hyphenated suffix
	yuku_parser_wasm: '@yuku-parser/wasm',
	malva: 'dprint-plugin-malva',
	// the wasm engine's release line, not `@biomejs/js-api`'s separate one
	biome: '@biomejs/wasm-bundler',
	swc: '@swc/core',
	// the Svelte PARSE rows come from a package whose name says "vite plugin" —
	// it's the N-API addon, and a different package from `@rsvelte/fmt`
	rsvelte_parse: '@rsvelte/vite-plugin-svelte-native',
	// not a tool version at all: the upstream Svelte that addon targets, worth
	// showing beside the svelte pin the oracle row uses
	rsvelte_parse_svelte_target: "rsvelte's upstream svelte",
	// the package behind the `tsc` row, which runs its parser, not the CLI
	tsc: 'typescript'
};

/** Formats a report version key for the meta panel, hyphenating the ones `VERSION_LABELS` doesn't name. */
export const format_version_label = (key: string): string =>
	VERSION_LABELS[key] ?? key.replaceAll('_', '-');

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

/**
 * A bar row's label. Biome's disabled placeholder drops the parenthesized binding
 * suffix, which says how a tool ran and biome ships one build, so there is nothing
 * to tell apart; oxc-parser keeps it, since its two placeholder rows (napi and
 * wasm) would otherwise read the same.
 */
export const format_row_label = (
	name: string,
	category: ImplementationCategory,
	disabled: boolean
): string => {
	const label = format_label(name);
	return disabled && category === 'biome' ? label.replace(/ \([^)]*\)$/, '') : label;
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
		case 'dprint':
			return 'var(--color_b_40)';
		case 'oxc':
			return 'var(--color_i_40)';
		case 'rsvelte':
			return 'var(--color_c_40)';
		case 'yuku':
			return 'var(--color_j_40)';
		// The palette has ten hues and the categories above spend all ten, so these
		// two reuse a hue at a lighter shade. The pairing is chosen so a colored
		// collision can't show up in a speed group: `swc` and `postcss` are
		// parse-only, `biome` and `dprint` format-only, and the biome/dprint rows
		// the parse groups do carry are disabled placeholders (see
		// `derive_benchmark_groups`), which `BenchmarksBar` draws with no fill. They
		// DO meet in the binary-size table, which lists both operations' tools —
		// hence the distinct shade rather than a bare reuse. A real biome/dprint
		// parse row (or an swc formatter) would break that, and would need a hue
		// freed up.
		case 'swc':
			return 'var(--color_a_50)'; // biome's hue, lighter
		case 'postcss':
			return 'var(--color_b_50)'; // dprint's hue, lighter
	}
};

/**
 * The runtime a per-runtime report was measured under and its major version, for
 * prose: `Node v24`.
 */
export const format_runtime_display = (
	baseline: Pick<BenchmarkBaseline, 'runtime' | 'machine'>
): string => {
	const name = baseline.runtime.charAt(0).toUpperCase() + baseline.runtime.slice(1);
	return `${name} v${baseline.machine.runtime_version.split('.')[0]}`;
};

/**
 * The note under a timed group whose intersection left files out. Bytes beside the
 * count, since one large file is a bigger share of the work than its count suggests.
 * `by_tool` counts are per row and `omitted_files` is their union, so two rows failing
 * one file sum past it — the copy says "by row" and flags the overlap when there can be one.
 * Rows are named as the chart labels them (`format_label`).
 */
export const format_group_omissions = (omissions: GroupOmissions): string => {
	const is_one = omissions.omitted_files === 1;
	const tools = omissions.by_tool
		.map((t) => `${format_label(t.name)} ${format_count(t.files)}`)
		.join(', ');
	return `${format_count(omissions.omitted_files)} of ${format_count(omissions.files_total)} files (${format_percent(omissions.omitted_bytes, omissions.bytes_total)} of this group's bytes) left out of every row's timed set, because a row here fails ${
		is_one ? 'it' : 'them'
	} in this harness — files failed, by row${
		omissions.by_tool.length > 1 ? ' (rows can overlap)' : ''
	}: ${tools}`;
};

// Display helpers shared across the benchmarks page: value formatters for
// times, sizes, and ratios, the row labels, and the per-category colors.

import type { CorpusSource, ImplementationCategory } from './benchmark_data.ts';

/** A count with thousands separators (`44,220`), pinned to one locale so prerendered and hydrated output agree. */
export const format_count = (n: number): string => n.toLocaleString('en-US');

export interface FormattedUnit {
	value: string;
	unit: string;
}

export const format_ns = (ns: number): FormattedUnit => {
	if (ns < 1_000) return { value: `${Math.round(ns)}`, unit: 'ns' };
	// the µs tier ends where its rounding would print `1000`, not at 1 ms exactly
	if (ns < 999_500)
		return {
			value: (ns / 1_000).toFixed(ns < 10_000 ? 2 : ns < 100_000 ? 1 : 0),
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
 * Formats a corpus source's file count as a per-language breakdown
 * (`124 typescript, 15 svelte, 31 css`), largest language first and dropping
 * zero-count languages. Falls back to the plain `N files` total when the report
 * predates the per-language split (or every language's count is zero).
 */
export const format_corpus_source_files = (source: CorpusSource): string => {
	const total = `${format_count(source.files)} files`;
	if (!source.by_language) return total;
	const parts = Object.entries(source.by_language)
		.filter((entry): entry is [string, number] => (entry[1] ?? 0) > 0)
		.sort((a, b) => b[1] - a[1])
		.map(([language, count]) => `${format_count(count)} ${language}`);
	return parts.length > 0 ? parts.join(', ') : total;
};

/**
 * Formats a gzipped binary size as a bar annotation (e.g. `717 KB gz`), or
 * `undefined` when the baseline lacks it (older runs, or no `gzip` available
 * on the generating machine).
 */
export const format_gzip_size = (gzip_bytes: number | null | undefined): string | undefined => {
	if (gzip_bytes == null) return undefined;
	const { value, unit } = format_bytes(gzip_bytes);
	return `${value} ${unit} gz`;
};

/** Matches the bench report generator's ratio formatting so the site and report.md agree digit for digit. */
export const format_speedup = (ratio: number): string =>
	ratio >= 10 ? `${ratio.toFixed(1)}x` : `${ratio.toFixed(2)}x`;

/**
 * Plain ratio formatting at one decimal for every magnitude (`2.3x`, `21.2x`) —
 * the CLI tables' peak-RSS column and the binary-size groups' ratios. Peak RSS
 * moves several percent run to run, so a second decimal would print noise as if
 * it were measured, and sizes never take the signed treatment speeds do.
 */
export const format_ratio_plain = (ratio: number): string => `${ratio.toFixed(1)}x`;

/**
 * Loose ratio formatting for prose, which reads better with fewer digits than a
 * table column (`1.7x`, `26x`) — always paired with a `~` in the copy. Renders
 * `—` for a missing ratio rather than throwing mid-sentence; the benchmark tests
 * assert every ratio the page quotes actually resolves.
 */
export const format_ratio_approx = (ratio: number | undefined): string =>
	ratio === undefined ? '—' : ratio >= 10 ? `${Math.round(ratio)}x` : `${ratio.toFixed(1)}x`;

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
 * (`2.9x`, never `2.9–2.9x`).
 */
export const format_ratio_range = (min: number, max: number): string => {
	const low = floor_ratio(min);
	const high = floor_ratio(max);
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
 * `(wasm)`. Mirrors
 * the parenthesized suffixes the binary-size section's labels already carry.
 * tsv's own wasm entries keep their `tsv-wasm` package-name prefix through
 * `HYPHENATED_NAMES`, so they aren't listed here. The size labels aren't keys
 * either: the parenthesized ones fall through the generic formatting unchanged and
 * the hyphenated wasm packages keep their hyphens the same way.
 * The cross-runtime table neutralizes the `(node napi)` suffix per row (its
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
	typescript: 'TypeScript',
	css: 'CSS'
};

/** A report language key for display (`typescript` → `TypeScript`), verbatim when unknown. */
export const format_language = (language: string): string => LANGUAGE_LABELS[language] ?? language;

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
	rsvelte_parse_svelte_target: "rsvelte's upstream svelte"
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

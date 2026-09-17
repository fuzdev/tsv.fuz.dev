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
	const ms = Math.round(ns / 1_000_000);
	return { value: format_count(ms), unit: 'ms' };
};

export const format_bytes = (bytes: number): FormattedUnit => {
	if (bytes < 1_024) return { value: `${bytes}`, unit: 'B' };
	if (bytes < 1_048_576) return { value: (bytes / 1_024).toFixed(0), unit: 'KB' };
	return { value: (bytes / 1_048_576).toFixed(1), unit: 'MB' };
};

/**
 * Formats a corpus source's file count as a per-language breakdown
 * (`124 typescript, 15 svelte, 31 css`), largest language first and dropping
 * zero-count languages. Falls back to the plain `N files` total when the report
 * predates the per-language split (or lists no recognized language).
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
 * Formats a gzipped binary size as a bar annotation (e.g. `716.6 KB gz`), or
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
 * Ratio formatting for the CLI tables' peak-RSS column: one decimal at every
 * magnitude. Peak RSS moves several percent run to run, so a second decimal
 * would print noise as if it were measured.
 */
export const format_memory_ratio = (ratio: number): string => `${ratio.toFixed(1)}x`;

/**
 * Loose ratio formatting for prose, which reads better with fewer digits than a
 * table column (`1.7x`, `26x`) — always paired with a `~` in the copy. Renders
 * `—` for a missing ratio rather than throwing mid-sentence; the benchmark tests
 * assert every ratio the page quotes actually resolves.
 */
export const format_ratio_approx = (ratio: number | undefined): string =>
	ratio === undefined ? '—' : ratio >= 10 ? `${Math.round(ratio)}x` : `${ratio.toFixed(1)}x`;

/**
 * An inclusive ratio range for prose (`3–9x`), FLOORED at both ends so a
 * "3–9x less memory" claim never overstates either bound.
 */
export const format_ratio_range = (min: number, max: number): string =>
	`${Math.floor(min)}–${Math.floor(max)}x`;

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
		// two reuse a hue at a lighter shade. The pairing is chosen so a collision
		// can't show up in a speed group: `swc` and `postcss` are parse-only, while
		// `biome` and `dprint` are format-only, and placeholder rows mirror only
		// within an operation. They DO meet in the binary-size table, which lists
		// both operations' tools — hence the distinct shade rather than a bare reuse.
		// A future biome/dprint parse row (or an swc formatter) would break that, and
		// would need a real hue freed up.
		case 'swc':
			return 'var(--color_a_50)'; // biome's hue, lighter
		case 'postcss':
			return 'var(--color_b_50)'; // dprint's hue, lighter
	}
};

// The in-process pairings the benchmarks page's copy names, as `[group, slower,
// faster]` in the direction each sentence reads. The page renders a ratio for each
// and `benchmark_data.prose.test.ts` gates that every one resolves and still runs
// that way — one table rather than two hand-kept lists, so a pairing added to the
// copy can't go ungated.

/** A claim the copy makes: `faster` leads `slower` in `group`, so the ratio reads above 1. */
export type InProcessPair = readonly [group: string, slower: string, faster: string];

/**
 * Keyed by the name the page gives each ratio, so the copy reads by key and the
 * test iterates the values. Native-vs-native pairs tsv with oxfmt, wasm-vs-wasm
 * pairs tsv-wasm with biome-wasm; the parse comparisons use tsv's span-only wire,
 * the shape oxc-parser and yuku-parser also emit.
 */
export const IN_PROCESS_PAIRS = {
	format_ts_vs_oxfmt: ['format/typescript', 'oxfmt', 'tsv'],
	format_ts_vs_prettier: ['format/typescript', 'prettier', 'tsv'],
	format_ts_vs_biome: ['format/typescript', 'biome-wasm', 'tsv-wasm'],
	format_svelte_vs_prettier: ['format/svelte', 'prettier', 'tsv'],
	format_svelte_vs_biome: ['format/svelte', 'biome-wasm', 'tsv-wasm'],
	format_css_vs_oxfmt: ['format/css', 'oxfmt', 'tsv'],
	format_css_vs_biome: ['format/css', 'biome-wasm', 'tsv-wasm'],
	parse_ts_vs_oxc: ['parse/typescript', 'oxc-parser', 'tsv-json-no-locations'],
	// "carrying it costs ~Nx the hand-off time" — the loc-bearing wire over the span-only one
	parse_ts_loc_cost: ['parse/typescript', 'tsv-json', 'tsv-json-no-locations'],
	// the one entry that leads tsv's span-only wire, quoted in the direction the data runs
	parse_ts_yuku_vs_tsv: ['parse/typescript', 'tsv-json-no-locations', 'yuku-parser'],
	// the wasm pairing runs wider, so the tldr quotes both rather than the friendlier one
	parse_ts_yuku_vs_tsv_wasm: ['parse/typescript', 'tsv-wasm-json-no-locations', 'yuku-parser-wasm'],
	parse_svelte_vs_compiler: ['parse/svelte', 'svelte/compiler', 'tsv-json'],
	parse_svelte_vs_rsvelte: ['parse/svelte', 'rsvelte-parse', 'tsv-json'],
	parse_css_compiler_vs_tsv: ['parse/css', 'tsv-json', 'svelte/compiler'],
	parse_css_postcss_vs_tsv: ['parse/css', 'tsv-json', 'postcss'],
	// Gated but not rendered: "tsv's default AST ... puts it behind Oxc" is a composite
	// of `parse_ts_vs_oxc` and `parse_ts_loc_cost`, true only while the loc cost
	// outruns tsv's span-only lead, so the sentence is gated as its own pair. Same
	// for "(and swc ...)" against swc's span-only AST.
	parse_ts_default_vs_oxc: ['parse/typescript', 'tsv-json', 'oxc-parser'],
	parse_ts_default_vs_swc: ['parse/typescript', 'tsv-json', 'swc']
} as const satisfies Record<string, InProcessPair>;

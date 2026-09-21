// The binary-size domain of the benchmarks page: category and capability
// grouping, and the synthesized combined builds. The report shapes these read live
// in `benchmark_data.ts`; the size-ratio color scale lives with the other ratio
// scale in `benchmark_baseline.ts`.

import type { BinarySize, ImplementationCategory } from './benchmark_data.ts';

// Binary-size categorization

/**
 * The color category for a binary-size label — the size table's analog of
 * `categorize_name`, read off the label prefix since size labels carry a
 * parenthesized build kind rather than a report row name.
 */
export const categorize_size = (label: string): ImplementationCategory => {
	// covers `tsv-wasm` plus the `tsv-format-wasm`/`tsv-parse-wasm` subsets
	if (label.startsWith('tsv') && label.includes('wasm')) return 'tsv_wasm';
	if (label.startsWith('tsv')) return 'tsv_native';
	if (label.startsWith('biome')) return 'biome';
	if (label.startsWith('dprint')) return 'dprint';
	if (label.startsWith('malva')) return 'dprint'; // dprint's CSS plugin — see `categorize_name`
	// Covers both `rsvelte-fmt (binary)` and `rsvelte compiler (napi)`.
	if (label.startsWith('rsvelte')) return 'rsvelte';
	if (label.startsWith('swc')) return 'swc';
	if (label.startsWith('yuku')) return 'yuku';
	return 'oxc'; // oxc-parser / oxfmt, and any unrecognized label
};

// Binary-size grouping by capability

/** What a build actually does, used to group binary sizes for like-for-like comparison. */
export type SizeCapability = 'full' | 'formatter' | 'parser';

/**
 * Capability for the labels whose NAME doesn't say what the build does, so the
 * keyword heuristic below can't reach them.
 *
 * The heuristic reads `parse`/`format`/`fmt` out of the label, which works only
 * while a tool is named after its job. These four aren't, and the fallback for an
 * unreadable label is `full` — a heading that reads "parse + format" over builds
 * that ship no formatter at all, or none but a formatter. So each one is stated
 * instead:
 *
 * - `dprint` and `malva` are the SAME kind of artifact and must land in the same
 *   bucket: both are dprint plugins loaded over the one `@dprint/formatter` host,
 *   and neither exposes a parser. dprint's covers TypeScript/JS, malva's CSS —
 *   each a slice of what tsv's format-only build does, so pair both against
 *   `tsv-format-wasm` and read the gap as scope before engine.
 * - `swc` and rsvelte's addon back parse rows and ship no formatter. Both are far
 *   wider than what the rows measure — swc's `.node` is an entire compiler
 *   (transforms, minifier, bundler) and rsvelte's carries the compiler plus
 *   svelte2tsx, HMR diffing and a resolver — so `parser` is the least-wrong
 *   heading rather than a claim of scope match. The notes beside the table say so.
 *
 * `biome` is deliberately NOT here, though its js-api exposes no parser either: the
 * bucket sizes what an ARTIFACT ships, and Biome's wasm build really is the whole
 * toolchain (parser, formatter, linter) whether or not this page calls all of it.
 * A dprint plugin is a formatter that happens to parse internally — the opposite
 * shape, and the reason it can't ride the same fallback.
 */
export const SIZE_CAPABILITY_BY_LABEL: Record<string, SizeCapability> = {
	'dprint (wasm)': 'formatter',
	'malva (wasm)': 'formatter',
	'swc (napi)': 'parser',
	'rsvelte compiler (napi)': 'parser'
};

/**
 * Buckets a binary-size label by capability so each build lands next to its
 * closest competitor: `parser` (tsv's parse-only build, `oxc-parser`),
 * `formatter` (tsv's format-only build, `oxfmt`), else `full` (the flagship
 * parse+format builds, `biome`, and the combined `oxc-parser + oxfmt` entry).
 *
 * A label naming neither job is looked up in `SIZE_CAPABILITY_BY_LABEL` first —
 * the keyword read below can only answer for tools named after what they do.
 */
export const categorize_size_capability = (label: string): SizeCapability => {
	const stated = SIZE_CAPABILITY_BY_LABEL[label];
	if (stated) return stated;
	const has_parse = label.includes('parse');
	const has_format = label.includes('format') || label.includes('fmt');
	// a build that does both is a full toolchain (e.g. the combined oxc-parser + oxfmt entry)
	if (has_parse && has_format) return 'full';
	if (has_parse) return 'parser'; // tsv parse (ffi), tsv-parse-wasm, oxc-parser
	if (has_format) return 'formatter'; // tsv format, oxfmt
	// Reaching here must be a DECISION, not a name the heuristic couldn't read:
	// every label that lands in `full` this way ships both operations (biome's whole
	// toolchain included). Anything else belongs in the table above.
	return 'full'; // tsv (napi/ffi), tsv-wasm, biome (wasm)
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
	// sorted smallest-first, so the leading entry is the default ratio anchor (1.0x)
	entries: Array<SizeDisplayEntry>;
}

const SIZE_CAPABILITY_ORDER: ReadonlyArray<{
	capability: SizeCapability;
	heading: string;
}> = [
	{ capability: 'full', heading: 'Full toolchain (parse + format)' },
	{ capability: 'formatter', heading: 'Formatter' },
	{ capability: 'parser', heading: 'Parser' }
];

/** The measured oxfmt native addon — the label the tsv harness emits, half of both synthesized sums. */
export const OXFMT_NATIVE_LABEL = 'oxfmt (napi)';

/** The measured oxc-parser native addon — the label the tsv harness emits. */
const OXC_PARSER_NATIVE_LABEL = 'oxc-parser (napi)';

/** Display label for the synthesized combined oxc full-toolchain build. */
export const OXC_FULL_LABEL = 'oxc-parser + oxfmt (napi)';

/** Display label for oxfmt's absent wasm build placeholder — see `derive_size_groups`. */
export const OXFMT_WASM_LABEL = 'oxfmt (wasm)';

/**
 * A synthesized native entry summing two measured builds — `undefined` when
 * either is missing (an older baseline), gzip summed only when both carry it.
 */
const sum_binary_sizes = (
	sizes: Array<BinarySize>,
	label: string,
	label_a: string,
	label_b: string
): BinarySize | undefined => {
	const a = sizes.find((s) => s.label === label_a);
	const b = sizes.find((s) => s.label === label_b);
	if (!a || !b) return undefined;
	return {
		label,
		bytes: a.bytes + b.bytes,
		kind: 'native',
		gzip_bytes: a.gzip_bytes != null && b.gzip_bytes != null ? a.gzip_bytes + b.gzip_bytes : null
	};
};

/**
 * Synthesizes oxc's full-toolchain native build by summing its separately-shipped
 * parser (`oxc-parser (napi)`) and formatter (`oxfmt (napi)`) packages — together
 * they're the closest equivalent to tsv's single parse+format build, so the entry
 * stands beside `tsv (napi)` in the full-toolchain group. Returns `undefined` when
 * either half is missing (older baselines), and sums gzip only when both carry it.
 */
const synthesize_oxc_full = (sizes: Array<BinarySize>): BinarySize | undefined =>
	sum_binary_sizes(sizes, OXC_FULL_LABEL, OXC_PARSER_NATIVE_LABEL, OXFMT_NATIVE_LABEL);

/** The rsvelte-fmt binary on its own — the label the tsv harness emits. */
export const RSVELTE_LABEL = 'rsvelte-fmt (binary)';

/** Display label for the rsvelte-fmt + oxfmt install — see `synthesize_rsvelte_install`. */
export const RSVELTE_INSTALL_LABEL = 'rsvelte-fmt + oxfmt (binary)';

/**
 * Synthesizes what installing rsvelte-fmt to format a project actually costs, by
 * summing its own binary with the `oxfmt` it declares as a peer dependency.
 *
 * Both figures are shown because which one is honest depends on how you invoke
 * it, and the difference is verifiable: pointed at a **single `.svelte` file** (or
 * stdin) rsvelte-fmt needs no oxfmt at all — it formats the embedded
 * `<script>` and `<style>` through its own linked-in oxc engines, byte-identically
 * whether or not oxfmt is reachable. But pointed at a **directory** — how a
 * formatter is actually run over a project, and what the CLI benchmark times — it
 * formats the Svelte, JS/TS, CSS, and JSON files itself, hands the rest (Markdown,
 * YAML, …) to a single oxfmt run, and exits non-zero without oxfmt, even when that
 * directory holds nothing but `.svelte`. So the bare binary is the
 * single-file/editor figure and the sum is the project figure.
 *
 * Returns `undefined` when either half is missing (an older baseline predating the
 * rsvelte row), and sums gzip only when both carry it — same posture as
 * `synthesize_oxc_full`.
 */
const synthesize_rsvelte_install = (sizes: Array<BinarySize>): BinarySize | undefined =>
	sum_binary_sizes(sizes, RSVELTE_INSTALL_LABEL, RSVELTE_LABEL, OXFMT_NATIVE_LABEL);

/**
 * Groups the binary sizes by capability (full / formatter / parser), each group
 * mixing wasm and native builds sorted smallest-first. Bars scale to the group's
 * largest ENTRY, synthesized sums included — so the `+` rows below set the scale in
 * the groups that carry one, and every real build reads against an install footprint
 * rather than against another single artifact. The `vs` ratio anchors on the group's
 * single smallest build, so exactly one entry reads 1.0x and every other is a
 * multiple of it — whichever tool that is. (It is not always tsv: yuku-parser's
 * parse-only builds undercut tsv's, which carry Svelte and CSS parsers besides, and
 * malva's CSS-only plugin undercuts tsv's three-language format-only wasm build.) A
 * combined `oxc-parser + oxfmt` entry is synthesized into the full-toolchain group,
 * since oxc ships parse and format apart.
 * oxfmt has no wasm build, so the formatter group gets a disabled `oxfmt (wasm)`
 * placeholder slotted just above its real `oxfmt (napi)` entry, holding the slot
 * rather than omitting it. The formatter group likewise carries both rsvelte-fmt
 * figures — the bare binary and the `+ oxfmt` install it needs to format a
 * project (see `synthesize_rsvelte_install`).
 */
export const derive_size_groups = (sizes: Array<BinarySize>): Array<SizeCapabilityGroup> => {
	const oxc_full = synthesize_oxc_full(sizes);
	const rsvelte_install = synthesize_rsvelte_install(sizes);
	const all_sizes = [...sizes, oxc_full, rsvelte_install].filter((s) => s != null);
	const groups: Array<SizeCapabilityGroup> = [];
	for (const { capability, heading } of SIZE_CAPABILITY_ORDER) {
		const items = all_sizes.filter((s) => categorize_size_capability(s.label) === capability);
		if (items.length === 0) continue;
		const sorted = items.toSorted((a, b) => a.bytes - b.bytes);
		const max = Math.max(0, ...items.map((s) => s.bytes));
		// `sorted` is ascending, so the smallest build leads the group — its single
		// default ratio anchor (1.0x), one baseline whether or not the group mixes wasm
		// and native. The shared component reads every ratio from that leading row.
		const entries: Array<SizeDisplayEntry> = sorted.map((s) => ({
			...s,
			bar_fraction: max > 0 ? s.bytes / max : 0,
			category: categorize_size(s.label)
		}));
		if (capability === 'formatter' && !entries.some((e) => e.label === OXFMT_WASM_LABEL)) {
			const native_index = entries.findIndex((e) => e.label === OXFMT_NATIVE_LABEL);
			const placeholder: SizeDisplayEntry = {
				label: OXFMT_WASM_LABEL,
				bytes: 0,
				kind: 'wasm',
				gzip_bytes: null,
				bar_fraction: 0,
				category: categorize_size(OXFMT_WASM_LABEL),
				disabled: true
			};
			entries.splice(native_index === -1 ? entries.length : native_index, 0, placeholder);
		}
		groups.push({ capability, heading, entries });
	}
	return groups;
};

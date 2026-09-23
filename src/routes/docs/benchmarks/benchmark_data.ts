// Raw types matching the tsv bench's per-runtime report format
// (`benches/js/results/report.<runtime>.json` — the site's flagship detailed
// view is the Node report, the N-API native path), with the format/parse,
// stability, and corpus derivations the page builds on them.
//
// Sibling modules own what reads these: `benchmark_sizes.ts` the binary-size
// tables, the conformance page's `conformance_data.ts` the parse-coverage tables,
// `benchmark_cross_runtime.ts` the combined report, `benchmark_display.ts` the value
// formatters, labels, and category colors, and `benchmark_baseline.ts` the
// hover-to-rebaseline ratios. This module imports none of them.

export interface BenchmarkBaseline {
	version: number;
	// The runtime that produced this report (`node` for the flagship view).
	runtime: string;
	timestamp: string;
	git_commit: string;
	corpus: Record<string, number>;
	versions: BaselineVersions;
	binary_sizes: Array<BinarySize>;
	entries: Array<BaselineEntry>;
	// Counts of silenced third-party stderr noise, keyed by message pattern. Not
	// rendered, kept for parity.
	suppressed_noise: Record<string, number>;
	// Same-engine native/wasm pairs whose pre-flight accept sets or output bytes
	// disagreed — `[]` when healthy. A non-empty list is a binding-boundary bug in
	// the producing bench (see tsv's `check_variant_parity`), caught at review time
	// in the copied report's diff; not rendered, kept for parity.
	variant_parity: Array<VariantParityFinding>;
	// Which corpus/surface produced the report: `perf` (real-world corpus,
	// format + parse) or `conformance` (the deliberately-hard fixture suites,
	// disjoint from the perf corpus, parse only).
	corpus_kind: 'perf' | 'conformance';
	// Per-entry corpus composition (path + loaded file count) — discloses which
	// sources were present on the machine that produced the report.
	corpus_sources: Array<CorpusSource>;
	// The exclusion caches the conformance view applied, by label, each its size —
	// `null` for an absent one, which only a tolerated (`BENCH_ALLOW_MISSING=1`),
	// not-comparable run publishes. Conformance reports only; not rendered, the
	// shape test refuses a `null`.
	exclusion_caches?: Record<string, number | null>;
	// The real-code snapshot every `real`/`framework` source was read from — the
	// `fuzdev/corpora` checkout at its commit (`subpath` empty), one roll-up commit
	// for the whole real-code corpus. Absent on conformance-only reports (no real code).
	corpus_snapshot?: CorpusRepoRef;
	// The machine that produced the report — CPU model, OS/arch, runtime version.
	// The throughput numbers are machine-relative, so this is the environment the
	// meta panel discloses.
	machine: Machine;
	// Per-corpus-source coverage — `group → source → impl → {processed, total}`,
	// the machine-readable half of the per-source tables in tsv's own markdown
	// report, rendered by `conformance_data.ts`'s per-source matrices. Conformance
	// reports only (the perf surface is 100% by construction).
	coverage_by_source?: Record<string, Record<string, Record<string, SourceCoverageCell>>>;
	// Artifacts the size table reached for and didn't find. That table's
	// COMPOSITION varies by the producing machine — a row exists only for a built
	// artifact — so this is what tells a missing row apart from an artifact that
	// stopped being produced. Not rendered, kept for parity.
	binary_sizes_absent: Array<string>;
	// Implementations that failed to initialize on the producing machine, as
	// `{impl, reason, rows}`. An impl that doesn't load contributes NO row, so
	// without this a tool that broke upstream is indistinguishable from one that was
	// never measured (`[]` in every committed report, which the shape tests pin for the
	// perf report). Not rendered here, kept for parity.
	unavailable: Array<UnavailableImpl>;
	// Files a byte-graded row ACCEPTED whose output the producing bench's
	// byte-parity check could not digest, as `{"<group>/<row>": count}` — `{}` when
	// every accepted output was gradeable, which is the healthy state. The one known
	// cause is a pathologically deep AST overflowing V8's recursive `JSON.stringify`.
	// Unlike every other field here it records a measurement the run could NOT make,
	// so a growing count means that check is quietly covering less. Not rendered,
	// kept for parity.
	output_digest_ungraded: Record<string, number>;
	// Per timed group, the files and BYTES its intersection left out and the rows
	// that left them. A file any timed row fails leaves EVERY row's timed set, so one
	// tool's omit moves every number in the group — and a file count understates it
	// (a harvested per-collection stylesheet is one file). A group nothing failed is
	// listed with zeroes. Perf surface, intersection mode, timed runs only — absent on
	// a `BENCH_MODE=union` run and on the conformance surface.
	omissions?: Array<GroupOmissions>;
}

// One timed group's omissions (see `BenchmarkBaseline.omissions`). Mirrors the
// bench's `GroupOmissions`: `omitted_*` is the UNION over rows, `by_tool` is per
// row, so its counts can sum past it.
export interface GroupOmissions {
	// `operation/language`, the same key `BaselineEntry.group` carries.
	group: string;
	files_total: number;
	bytes_total: number;
	omitted_files: number;
	omitted_bytes: number;
	by_tool: Array<ToolOmissions>;
}

// One row's share of a group's omissions. `categories` counts its failed files by
// the bench's omit category (`tool_limit`, `unsupported_syntax`,
// `harness_path_threading`, `harvest_artifact`, `tsv_failure`), plus `unlisted` for a
// failure no omit entry claims — unreachable on a run the bench's coverage gate
// passed, and named so the counts always sum to `files`. Keys arrive in that order.
export interface ToolOmissions {
	name: string;
	files: number;
	bytes: number;
	categories: Record<string, number>;
}

// What a PARSE row hands JS (see `BaselineEntry.payload`). Mirrors the bench's
// `PayloadTier`.
export type PayloadTier = 'drop_in' | 'span_only' | 'own_shape' | 'none';

// Whether a ratio between two parse rows compares the same PRODUCT: their tiers are
// equal and neither is `own_shape`. `null` when either row carries no tier — a
// format row, where the question does not arise.
export const is_payload_matched = (
	a: Pick<BaselineEntry, 'payload'>,
	b: Pick<BaselineEntry, 'payload'>
): boolean | null =>
	a.payload == null || b.payload == null
		? null
		: a.payload === b.payload && a.payload !== 'own_shape';

// Per-impl coverage for one corpus source (see `coverage_by_source`).
export interface SourceCoverageCell {
	processed: number;
	total: number;
	// of `processed`, files accepted only on the Script-goal retry a source allows
	// (Prettier's JS and TypeScript suites); absent when there was none — carried, not rendered
	script_only?: number;
}

// One implementation that failed to load on the machine that produced a report
// (see `BenchmarkBaseline.unavailable`). Mirrors the bench's `UnavailableImpl`.
//
// `impl` is the bench's init-line LABEL (`Biome`, `OXC WASM`) and matches no row
// name — `rows` is the joinable identity, and the only one to look a row up by.
export interface UnavailableImpl {
	impl: string;
	reason: string;
	// The row names this failure removed from the tables.
	rows: Array<string>;
}

// A same-engine pair that disagreed — one engine behind two bindings
// (native/wasm), or one binding under two options. Mirrors the bench's
// `VariantParityFinding` (see `BenchmarkBaseline.variant_parity`).
export interface VariantParityFinding {
	group: string;
	impl: string;
	sibling: string;
	// files only `impl` accepted
	impl_only: number;
	// files only `sibling` accepted
	sibling_only: number;
	// files BOTH accepted whose outputs differ byte-for-byte, and up to three of
	// their paths. Only tsv's own native/wasm pair is graded on bytes, and a
	// non-zero count fails the producing bench outright, so these are absent
	// here in practice — kept for parity with the report shape.
	output_mismatch: number;
	output_mismatch_examples: Array<string>;
}

// The hardware/runtime a report was measured on. Excludes hostname (the reports
// are published) and volatile fields (free memory, load) that would churn.
export interface Machine {
	cpu_model: string;
	os: string;
	arch: string;
	// The producing runtime's own version (`node`/`deno`/`bun` version string).
	runtime_version: string;
}

export interface CorpusSource {
	path: string;
	files: number;
	// Per-language split of `files` (svelte/typescript/css counts summing to
	// `files`).
	by_language?: Partial<Record<string, number>>;
	// The source's GitHub origin, detected by the bench at report-build time (URL +
	// commit + subpath): for a `fuzdev/corpora` collection the UPSTREAM its manifest
	// names, read from that manifest; for any other checkout, git. Absent on
	// sources with no GitHub remote.
	repo?: CorpusRepoRef;
}

// A corpus source's GitHub origin — see `CorpusSource.repo` and `corpus_source_url`.
export interface CorpusRepoRef {
	// Canonical https GitHub URL, e.g. `https://github.com/sveltejs/svelte`.
	url: string;
	// `owner/name` (e.g. `sveltejs/svelte`) — a compact label.
	slug: string;
	// The commit the corpus was loaded at (full SHA); `''` for a harvested cache
	// linked at its canonical upstream root (no pin).
	commit: string;
	// Path within the repo to this source (`''` = repo root).
	subpath: string;
}

/**
 * The GitHub URL for a repo ref, pinned to its commit + subpath
 * (`…/tree/<commit>/<subpath>`), or the repo root when the ref carries no commit
 * (a canonical-upstream cache).
 */
export const corpus_repo_ref_url = (repo: CorpusRepoRef): string => {
	if (!repo.commit) return repo.url;
	return repo.subpath
		? `${repo.url}/tree/${repo.commit}/${repo.subpath}`
		: `${repo.url}/tree/${repo.commit}`;
};

const COMMIT_LABEL_LENGTH = 9;

/** A repo ref's commit as prose and tables print it, `undefined` for an unpinned ref. */
export const corpus_repo_ref_commit = (repo: CorpusRepoRef): string | undefined =>
	repo.commit ? repo.commit.slice(0, COMMIT_LABEL_LENGTH) : undefined;

/**
 * The GitHub URL for a corpus source, pinned to the measured commit + subpath when
 * detected. `undefined` when the source has no detected origin (the local
 * `svelte_styles` cache).
 */
export const corpus_source_url = (source: CorpusSource): string | undefined =>
	source.repo ? corpus_repo_ref_url(source.repo) : undefined;

export interface BaselineEntry {
	name: string;
	group: string;
	// Timing stats are `null` on a coverage-only report (the conformance surface
	// the site refreshes from — parse coverage measured, timed phase skipped). A
	// perf report always carries real numbers, and only the perf path
	// (`derive_benchmark_groups`) reads these, so the nulls are unreachable there
	// but must be expressed for the shared cast to stay sound.
	mean_ns: number | null;
	p50_ns: number | null;
	p75_ns: number | null;
	p90_ns: number | null;
	p95_ns: number | null;
	p99_ns: number | null;
	min_ns: number | null;
	max_ns: number | null;
	std_dev_ns: number | null;
	cv: number | null;
	ops_per_second: number | null;
	sample_size: number | null;
	// Stability read from the RAW timings: the cv before
	// outlier removal and the second-half-over-first-half `drift`, which see a cost
	// that moved WHILE the row was measured — the cleaned `cv` above cannot, since
	// the bench's outlier cleaner deletes or blends a second mode rather than
	// reporting it. With them: the timing count before cleaning, the share removed,
	// the protocol the row ran under, and a hash of the timed path set. `null` on an
	// untimed row.
	cv_raw: number | null;
	drift: number | null;
	raw_sample_size: number | null;
	outlier_ratio: number | null;
	warmup_iterations: number | null;
	min_iterations: number | null;
	// The JS heap the row's warmup began from, which shows whether two runs of a row
	// started from the same place; not rendered. `null` on an untimed row.
	settled_heap_bytes: number | null;
	files_iterated_digest: string | null;
	// Per-implementation preflight coverage: files this impl processed / the
	// language's total discovered files.
	files_processed: number | null;
	files_total: number | null;
	// Files this impl was actually timed on (the per-group intersection in
	// default mode); `null` on an untimed row.
	files_iterated: number | null;
	// What a parse row hands JS — the canonical parser's own AST shape (`drop_in`),
	// a `start`/`end`-only tree (`span_only`), the tool's own dialect or reduction
	// (`own_shape`), or nothing materialized (`none`). Most of a parse row's time is
	// building that product, so a ratio between two rows integrates it
	// (`is_payload_matched`). `null` on format rows.
	payload: PayloadTier | null;
	// Matches the report's top-level `runtime`; not rendered, kept for parity.
	runtime: string;
}

export interface BaselineVersions {
	tsv: string;
	svelte: string;
	acorn: string;
	acorn_ts: string;
	prettier: string;
	prettier_svelte: string;
	oxc_parser?: string;
	// `@oxc-parser/binding-wasm32-wasi` — the binding behind the `oxc-parser-wasm`
	// row, pinned apart from `oxc-parser` (its newer versions fail to load), so the
	// two can differ.
	oxc_parser_wasm?: string;
	oxfmt?: string;
	// `yuku-parser` (N-API) and `@yuku-parser/wasm` — one Zig engine behind two
	// bindings, versioned in lockstep upstream.
	yuku_parser?: string;
	yuku_parser_wasm?: string;
	biome?: string;
	// `@dprint/typescript` — the plugin version (the host `@dprint/formatter` is
	// just the Wasm loader).
	dprint?: string;
	// `@rsvelte/fmt` — the coverage-only Svelte formatter row.
	rsvelte_fmt?: string;
	// `dprint-plugin-malva` — dprint's CSS formatter plugin, over the same Wasm
	// host as `dprint` above.
	malva?: string;
	// `postcss` — the CSS parser row.
	postcss?: string;
	// `@rsvelte/vite-plugin-svelte-native` — the N-API addon behind the Svelte
	// PARSE rows, a different package from `@rsvelte/fmt` above and versioned
	// independently.
	rsvelte_parse?: string;
	// The upstream Svelte version that addon targets (its own `VERSION` export),
	// which is not its package version — a drift from the `svelte` pin means those
	// rows parse to a different Svelte than the svelte/compiler row beside them.
	rsvelte_parse_svelte_target?: string;
	// `@swc/core` — the TypeScript/JS parser row.
	swc?: string;
	// `typescript` — the engine behind the `tsc` row, which runs on the conformance
	// surface alone, so the perf reports never carry it.
	tsc?: string;
}

export interface BinarySize {
	label: string;
	bytes: number;
	// `js` is a minified JS bundle the tsv harness builds
	// itself — the canonical toolchain's rows, which no package ships as one file.
	kind: 'native' | 'wasm' | 'js';
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
	| 'dprint'
	| 'oxc'
	| 'postcss'
	| 'rsvelte'
	| 'swc'
	| 'yuku';

export interface BenchmarkGroup {
	operation: string;
	language: string;
	entries: Array<BenchmarkDisplayEntry>;
	canonical_entry: BenchmarkDisplayEntry | undefined;
	// files the timed benchmark actually iterated (the per-group intersection);
	// null when no row in the group was timed
	files_iterated: number | null;
	// what the intersection left out, when it left anything out; null when nothing
	// was omitted or the report carries no `omissions`
	omissions: GroupOmissions | null;
}

export interface BenchmarkDisplayEntry {
	name: string;
	mean_ns: number;
	bar_fraction: number;
	category: ImplementationCategory;
	files_processed: number | null;
	files_total: number | null;
	// A placeholder entry mirrored from another language's group for a tool that
	// doesn't run in this one (e.g. `oxc-parser` under css parse) — rendered
	// grayed-out and inert so the parse groups share one entry order. Absent on real,
	// measured entries. Also set on a `coverage_only` row, which shares the inert
	// rendering for a different reason (see below).
	disabled?: boolean;
	// The harness measured this tool's COVERAGE but deliberately never timed it —
	// it ships no in-process API, so a per-file row would have measured process
	// spawn rather than format work (`rsvelte-fmt`; see the tsv harness's
	// §Coverage-only rows). Distinct from a plain `disabled` placeholder: that one
	// never ran here at all, while this one ran over the whole corpus and has real
	// `files_processed`/`files_total` to show. Both render inert; only this one
	// carries a coverage annotation and needs the page to explain itself.
	coverage_only?: boolean;
}

// Implementation categorization

const CATEGORY_BY_NAME: Record<string, ImplementationCategory> = {
	prettier: 'canonical',
	'svelte/compiler': 'canonical',
	'acorn-typescript': 'canonical',
	tsv: 'tsv_native',
	'tsv-json': 'tsv_native_json',
	'tsv-json-no-locations': 'tsv_native_json',
	'tsv-internal': 'tsv_native',
	'tsv-wasm': 'tsv_wasm',
	'tsv-wasm-json': 'tsv_wasm_json',
	'tsv-wasm-json-no-locations': 'tsv_wasm_json',
	'tsv-wasm-internal': 'tsv_wasm',
	'biome-wasm': 'biome',
	'dprint-wasm': 'dprint',
	// malva is dprint's own CSS plugin, loaded through the same Wasm host, so it
	// shares dprint's category rather than claiming a hue of its own — the palette
	// has ten and all ten are spoken for.
	'malva-wasm': 'dprint',
	'oxc-parser': 'oxc',
	'oxc-parser-wasm': 'oxc',
	oxfmt: 'oxc',
	postcss: 'postcss',
	'rsvelte-fmt': 'rsvelte',
	// The parse rows come from a different package than `rsvelte-fmt`, but the same
	// tool, so one category covers all three.
	'rsvelte-parse': 'rsvelte',
	'rsvelte-parse-skip-expr-loc': 'rsvelte',
	swc: 'swc',
	'yuku-parser': 'yuku',
	'yuku-parser-wasm': 'yuku'
};

export const categorize_name = (name: string): ImplementationCategory =>
	CATEGORY_BY_NAME[name] ?? 'oxc';

// Derivation functions

// Shared display order for benchmark groups: format before parse, then by
// language — used by the detailed, conformance, and cross-runtime views alike.
const OPERATION_ORDER: Record<string, number> = { format: 0, parse: 1 };
const LANGUAGE_ORDER: Record<string, number> = {
	svelte: 0,
	typescript: 1,
	css: 2
};

/** Splits an `operation/language` group key (`format/svelte`) into its halves. */
export const parse_group_key = (group: string): { operation: string; language: string } => {
	const [operation = '', language = ''] = group.split('/');
	return { operation, language };
};

/** Orders groups by `OPERATION_ORDER` then `LANGUAGE_ORDER`, unknowns last. */
export const compare_group_order = (
	a: { operation: string; language: string },
	b: { operation: string; language: string }
): number =>
	(OPERATION_ORDER[a.operation] ?? 9) - (OPERATION_ORDER[b.operation] ?? 9) ||
	(LANGUAGE_ORDER[a.language] ?? 9) - (LANGUAGE_ORDER[b.language] ?? 9);

/** The fixed slots ahead of tsv's own rows — see `speed_entry_rank`. */
const CROSS_TOOL_RANK: Partial<Record<ImplementationCategory, number>> = {
	canonical: 0,
	biome: 1,
	dprint: 2,
	oxc: 3,
	postcss: 4,
	rsvelte: 5,
	swc: 6,
	yuku: 7
};
// tsv's own rows follow every cross-tool slot
const TSV_RANK_BASE = Object.keys(CROSS_TOOL_RANK).length;

/**
 * Fixed slot for a format/parse row, applied in place of a size-ordered sort so the
 * rows read in a stable, meaningful sequence across every group: the canonical
 * reference first (the default 1.00x anchor), then the cross-tool comparisons
 * (alphabetically: biome, dprint — whose category malva shares — oxc, postcss,
 * rsvelte, swc, yuku), then tsv's JSON-materializing
 * wires (the span-only `no-locations` wire before the default `loc`-carrying one),
 * then tsv's own engine rows — `tsv`/`tsv-wasm` in the format groups, the
 * `-internal` rows in the parse groups.
 */
const speed_entry_rank = (entry: BenchmarkDisplayEntry): number => {
	const rank = CROSS_TOOL_RANK[entry.category];
	if (rank !== undefined) return rank;
	if (entry.name.endsWith('-no-locations')) return TSV_RANK_BASE; // tsv json, span-only wire
	if (entry.name.endsWith('-json')) return TSV_RANK_BASE + 1; // tsv json, loc-carrying wire
	return TSV_RANK_BASE + 2; // tsv's engine rows: `tsv`/`tsv-wasm` (format), `-internal` (parse, no JS materialization)
};

/**
 * Orders format/parse rows by their fixed `speed_entry_rank` slot, then wasm before
 * native within a tier (the browser-relevant build leads each pairing), then by name
 * — shared by the initial sort and the re-sort after disabled placeholders are mixed
 * in, so every group scans identically.
 */
const compare_speed_entries = (a: BenchmarkDisplayEntry, b: BenchmarkDisplayEntry): number => {
	const rank = speed_entry_rank(a) - speed_entry_rank(b);
	if (rank !== 0) return rank;
	// wasm before native within a tier
	const kind = (a.name.includes('wasm') ? 0 : 1) - (b.name.includes('wasm') ? 0 : 1);
	if (kind !== 0) return kind;
	return a.name.localeCompare(b.name);
};

/**
 * A grayed-out, inert row for a group the tool doesn't run in — no bar, no
 * coverage, never an anchor. Built from the name and category alone, so nothing a
 * template row measured (a TypeScript mean ~100x any real CSS row, a
 * `coverage_only` flag) can ride into the group it is mirrored into.
 */
const to_placeholder = (
	entry: Pick<BenchmarkDisplayEntry, 'name' | 'category'>
): BenchmarkDisplayEntry => ({
	name: entry.name,
	category: entry.category,
	mean_ns: 0,
	bar_fraction: 0,
	files_processed: null,
	files_total: null,
	disabled: true
});

export const derive_benchmark_groups = (baseline: BenchmarkBaseline): Array<BenchmarkGroup> => {
	const result: Array<BenchmarkGroup> = [];

	for (const [group_key, entries] of Map.groupBy(baseline.entries, (e) => e.group)) {
		const { operation, language } = parse_group_key(group_key);
		// The sort below leads each group with its canonical reference (Prettier for
		// format, the JS baseline for parse), so the first row is the default 1.00x
		// anchor; the shared component reads that default off the first row and
		// recomputes every ratio, re-baselining onto whichever row is hovered. (Size
		// groups lead with their smallest build; see `derive_size_targets`.)
		// An untimed row (see `BenchmarkDisplayEntry.coverage_only`) coerces to 0, so it
		// can't set the bar scale; it renders inert, so the 0 is never shown or divided by.
		const slowest = Math.max(...entries.map((e) => e.mean_ns ?? 0));

		const display_entries: Array<BenchmarkDisplayEntry> = entries.map((e) => {
			// `mean_ns` is the timing the bars and ratios are built from, so its
			// absence — not the tool's identity — is what marks a row untimed. That
			// keeps this independent of which tools happen to be coverage-only.
			const mean_ns = e.mean_ns;
			const untimed = mean_ns == null;
			return {
				name: e.name,
				mean_ns: mean_ns ?? 0,
				bar_fraction: mean_ns == null || slowest <= 0 ? 0 : mean_ns / slowest,
				category: categorize_name(e.name),
				files_processed: e.files_processed,
				files_total: e.files_total,
				...(untimed ? { disabled: true, coverage_only: true } : null)
			};
		});

		// Fixed order (see `compare_speed_entries`): canonical leads as the default 1.0x
		// anchor, then the cross-tool rows, tsv's json wires, then tsv's internal engine
		display_entries.sort(compare_speed_entries);

		// the timed set is the per-group intersection, so every timed row carries the
		// same count (a shape test pins that); the min is the intersection if they
		// ever diverge, where the max would overstate what the slowest row timed
		const iterated_counts = entries
			.map((e) => e.files_iterated)
			.filter((v): v is number => v != null);
		result.push({
			operation,
			language,
			entries: display_entries,
			canonical_entry: display_entries.find((e) => e.category === 'canonical'),
			files_iterated: iterated_counts.length > 0 ? Math.min(...iterated_counts) : null,
			omissions:
				baseline.omissions?.find((o) => o.group === group_key && o.omitted_files > 0) ?? null
		});
	}

	result.sort(compare_group_order);

	// Two tools hold a grayed-out slot in parse groups they don't run in. `biome`'s
	// `@biomejs/js-api` never exposes a parser to JS at all (only formatting and
	// linting), so no parse group has a real biome entry and every one gets a
	// placeholder. `oxc-parser` only parses TypeScript/JS; it is mirrored into the css
	// group alone, since oxc does ship CSS tooling (oxfmt formats it) and a Svelte
	// parser is nothing it claims. Then re-sort so they fall into their fixed slots
	// (biome then oxc, right after the canonical row).
	//
	// A grayed-out slot states a SCOPE gap in a broad web toolchain, so nothing
	// narrower is mirrored: not `yuku-parser`, TypeScript/JS-only by design, and not
	// `@dprint/typescript` into the svelte format group — an empty slot there would
	// invent a shortfall against a promise the tool never made.
	const ts_parse = result.find((g) => g.operation === 'parse' && g.language === 'typescript');
	const oxc_templates = ts_parse?.entries.filter((e) => e.category === 'oxc') ?? [];
	for (const group of result) {
		if (group.operation !== 'parse') continue;
		// guarded like the others, so a report that grows a real biome parse row
		// can't produce a second `biome-wasm` entry (the rows are keyed by name)
		const has = (category: ImplementationCategory) =>
			group.entries.some((e) => e.category === category);
		if (!has('biome'))
			group.entries.push(to_placeholder({ name: 'biome-wasm', category: 'biome' }));
		if (group.language === 'css' && !has('oxc')) {
			group.entries.push(...oxc_templates.map(to_placeholder));
		}
		group.entries.sort(compare_speed_entries);
	}

	return result;
};

// Measurement stability

/**
 * The bench's own instability thresholds, restated: a cleaned cv at or past
 * `UNSTABLE_CV_THRESHOLD`, a raw cv at or past it on a row with fewer than
 * `RAW_CV_SAMPLE_CEILING` raw timings, or a |drift| at or past
 * `UNSTABLE_DRIFT_THRESHOLD`, and the row's mean may be neither of two modes it
 * blended. Mirrors `bench.ts`.
 */
const UNSTABLE_CV_THRESHOLD = 0.1;
const UNSTABLE_DRIFT_THRESHOLD = 0.05;
/**
 * Below this many raw timings the raw cv counts too: with few samples one deviant
 * sweep is a real share of the row; with hundreds it is an isolated pause the
 * cleaner rightly removes, and `drift` (a median-based level shift) is the detector.
 */
const RAW_CV_SAMPLE_CEILING = 30;

/**
 * Whether a timed row's measurement was stable enough to divide by — the gate every
 * headline ratio on the page should pass. A coverage-only row (null timing) is not
 * unstable, it is untimed.
 */
export const is_entry_unstable = (entry: BaselineEntry): boolean =>
	to_unstable_readings(entry).length > 0;

// the readings past their threshold — empty for a stable or an untimed row
const to_unstable_readings = (entry: BaselineEntry): Array<number> => {
	// untimed is `mean_ns`, not `cv` — a timed row missing its cleaned cv still
	// carries a raw cv and a drift to check
	if (entry.mean_ns == null) return [];
	const readings: Array<number> = [];
	if (entry.cv != null && entry.cv >= UNSTABLE_CV_THRESHOLD) readings.push(entry.cv);
	if (
		entry.cv_raw != null &&
		entry.cv_raw >= UNSTABLE_CV_THRESHOLD &&
		entry.raw_sample_size != null &&
		entry.raw_sample_size < RAW_CV_SAMPLE_CEILING
	) {
		readings.push(entry.cv_raw);
	}
	if (entry.drift != null && Math.abs(entry.drift) >= UNSTABLE_DRIFT_THRESHOLD) {
		readings.push(Math.abs(entry.drift));
	}
	return readings;
};

/**
 * The timed rows of a per-runtime report whose measurement was not stable, worst
 * first by the readings that flagged them — the page's disclosure beside the
 * numbers built from that report.
 */
export const derive_unstable_entries = (baseline: BenchmarkBaseline): Array<BaselineEntry> =>
	baseline.entries
		.map((entry) => ({ entry, worst: Math.max(...to_unstable_readings(entry)) }))
		.filter(({ worst }) => worst > 0)
		.sort((a, b) => b.worst - a.worst)
		.map(({ entry }) => entry);

// Corpus source table

/**
 * Reader-facing names for the perf report's corpus sources that have no repo to
 * name them. The shape test fails on a repo-less source missing here, so a cache
 * tsv adds can't reach the page as a raw path unnoticed.
 */
export const CORPUS_SOURCE_LABELS: Record<string, string> = {
	'benches/js/.cache/svelte_styles': 'harvested <style> blocks'
};

/** One corpus source as the corpus table prints it. */
export interface CorpusSourceRow {
	path: string;
	// the hand-stated label, else the repo's `org/name`, else the raw path
	label: string;
	// the path within the repo, only where unlabeled sources share a repo and the
	// `org/name` alone wouldn't tell them apart
	subpath: string | undefined;
	// pinned to the measured commit + subpath when the report detected them
	url: string | undefined;
	// abbreviated SHA; `undefined` for a source with no repo or no pin
	commit: string | undefined;
	files: number;
	// aligned to the table's `languages`; `undefined` where the report lacks the split
	by_language: Array<number | undefined>;
}

export interface CorpusSourceTable {
	// the report's `corpus` keys, in report order
	languages: Array<string>;
	// in report order, which groups the sources by origin
	rows: Array<CorpusSourceRow>;
	// the report's own per-language totals, aligned to `languages`, and their sum
	totals: { files: number; by_language: Array<number> };
}

/**
 * Itemizes a report's corpus: a row per source with its per-language file counts,
 * and the report's own totals alongside. Every link comes from the source's
 * `repo` — for a snapshot collection that is the UPSTREAM the snapshot vendored,
 * so the rows name the projects, not the snapshot repo (which `corpus_snapshot`
 * names once).
 *
 * @param baseline - the report whose `corpus_sources` to itemize
 * @param labels - reader-facing names by source path, for the sources a repo's `org/name` doesn't describe
 */
export const derive_corpus_source_table = (
	baseline: BenchmarkBaseline,
	labels: Record<string, string> = {}
): CorpusSourceTable => {
	const languages = Object.keys(baseline.corpus);
	const unlabeled_per_repo: Map<string, number> = new Map();
	for (const source of baseline.corpus_sources) {
		if (!source.repo || labels[source.path] !== undefined) continue;
		unlabeled_per_repo.set(source.repo.url, (unlabeled_per_repo.get(source.repo.url) ?? 0) + 1);
	}
	const by_language = languages.map((language) => baseline.corpus[language] ?? 0);
	return {
		languages,
		rows: baseline.corpus_sources.map((source): CorpusSourceRow => {
			const label = labels[source.path];
			const repo = source.repo;
			const shared = !!repo && (unlabeled_per_repo.get(repo.url) ?? 0) > 1;
			return {
				path: source.path,
				label: label ?? repo?.slug ?? source.path,
				subpath: label === undefined && shared && repo.subpath ? repo.subpath : undefined,
				url: corpus_source_url(source),
				commit: repo && corpus_repo_ref_commit(repo),
				files: source.files,
				by_language: languages.map((language) => source.by_language?.[language])
			};
		}),
		totals: { files: by_language.reduce((sum, n) => sum + n, 0), by_language }
	};
};

// Prose counts

/** The corpus file counts the prose quotes — see `derive_corpus_counts`. */
export interface CorpusCounts {
	/** Every file across the languages (the report carries per-language counts, not bytes). */
	files: number;
	/**
	 * The harvested `<style>` concatenations inside `files`: the sources with no
	 * upstream repo are the harness's own caches, and their CSS entries are bytes the
	 * Svelte rows already carry. `0` when the report doesn't distinguish them.
	 */
	harvested_css: number;
	/** The CSS files that are files — `undefined` unless the report distinguishes the harvest. */
	standalone_css: number | undefined;
}

export const derive_corpus_counts = (baseline: BenchmarkBaseline): CorpusCounts => {
	const files = Object.values(baseline.corpus).reduce((sum, n) => sum + n, 0);
	const harvested_css = baseline.corpus_sources
		.filter((source) => !source.repo)
		.reduce((sum, source) => sum + (source.by_language?.css ?? 0), 0);
	const css = baseline.corpus.css;
	return {
		files,
		harvested_css,
		standalone_css: harvested_css && css ? css - harvested_css : undefined
	};
};

/**
 * How many timed sweeps stand behind each row — see `derive_sweep_stats`. Every
 * field is `undefined` when no entry carries it, so a report without them can't
 * print `Infinity` mid-sentence.
 */
export interface SweepStats {
	/** The bench's lowest per-row sweep floor. */
	floor: number | undefined;
	/**
	 * The reference rows' floor — theirs is separate, since every default ratio
	 * divides by one. Falls back to `floor` when no reference row carries one.
	 */
	canonical_floor: number | undefined;
	/** The span of cleaned timing counts the report kept per row. */
	sample_size_min: number | undefined;
	sample_size_max: number | undefined;
}

export const derive_sweep_stats = (baseline: BenchmarkBaseline): SweepStats => {
	const min_of = (values: Array<number>): number | undefined =>
		values.length ? Math.min(...values) : undefined;
	const floors = baseline.entries.flatMap((e) => e.min_iterations ?? []);
	const canonical_floors = baseline.entries.flatMap((e) =>
		categorize_name(e.name) === 'canonical' ? (e.min_iterations ?? []) : []
	);
	const sample_sizes = baseline.entries.flatMap((e) => e.sample_size ?? []);
	const floor = min_of(floors);
	return {
		floor,
		canonical_floor: min_of(canonical_floors) ?? floor,
		sample_size_min: min_of(sample_sizes),
		sample_size_max: sample_sizes.length ? Math.max(...sample_sizes) : undefined
	};
};

// Prose ratios

/**
 * How many times faster `faster` is than `slower` within one `operation/language`
 * group, by mean time — the ratio the prose summaries quote.
 *
 * @returns the ratio, or `undefined` when either entry is absent from the report
 */
export const benchmark_speedup = (
	baseline: BenchmarkBaseline,
	group: string,
	slower: string,
	faster: string
): number | undefined => {
	const find = (name: string) => baseline.entries.find((e) => e.group === group && e.name === name);
	// a coverage-only report carries null timings, so both sides must be real
	// (and nonzero: a zero mean is no measurement, not an infinitely fast one)
	const a = find(slower)?.mean_ns;
	const b = find(faster)?.mean_ns;
	if (!a || !b) return undefined;
	return a / b;
};

/**
 * The share of `whole`'s time it spends beyond what `part` takes, within one group
 * — what a row costs over a sibling that stops earlier (the JSON hand-off's share
 * of a parse row, against the internal row that builds the same AST and stops).
 *
 * @returns the fraction, or `undefined` when either entry is absent from the report
 */
export const benchmark_time_share_beyond = (
	baseline: BenchmarkBaseline,
	group: string,
	whole: string,
	part: string
): number | undefined => {
	const ratio = benchmark_speedup(baseline, group, whole, part);
	return ratio === undefined ? undefined : 1 - 1 / ratio;
};

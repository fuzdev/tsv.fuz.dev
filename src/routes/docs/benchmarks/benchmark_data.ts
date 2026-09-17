// Raw types matching the tsv bench's per-runtime report format
// (`benches/js/results/report.<runtime>.json` — the site's flagship detailed
// view is the Node report, the N-API native path), with the format/parse,
// conformance, stability, and corpus derivations the page builds on them.
//
// Sibling modules own what reads these: `benchmark_sizes.ts` the binary-size
// tables, `benchmark_cross_runtime.ts` the combined report, `benchmark_display.ts`
// the value formatters, labels, and category colors, and `benchmark_baseline.ts`
// the hover-to-rebaseline ratios. This module imports none of them.

export interface BenchmarkBaseline {
	version: number;
	// The runtime that produced this report (`node` for the flagship view).
	// Present from report `version` 5 on.
	runtime?: string;
	timestamp: string;
	git_commit: string;
	corpus: Record<string, number>;
	versions: BaselineVersions;
	binary_sizes: Array<BinarySize>;
	entries: Array<BaselineEntry>;
	// Counts of silenced third-party stderr noise, keyed by message pattern.
	// Present from baseline `version` 4 on; not rendered, kept for parity.
	suppressed_noise?: Record<string, number>;
	// Same-engine native/wasm pairs whose pre-flight accept sets or output bytes
	// disagreed — `[]` when healthy. A non-empty list is a binding-boundary bug in
	// the producing bench (see tsv's `check_variant_parity`), caught at review time
	// in the copied report's diff; not rendered, kept for parity. Absent on
	// older reports — treat as optional.
	variant_parity?: Array<VariantParityFinding>;
	// Which corpus/surface produced the report: `perf` (real-world corpus,
	// format + parse) or `conformance` (the deliberately-hard fixture suites,
	// disjoint from the perf corpus, parse only). Present from `version` 6 on.
	corpus_kind?: 'perf' | 'conformance';
	// Per-entry corpus composition (path + loaded file count) — discloses which
	// sources were present on the machine that produced the report. Present
	// from `version` 6 on.
	corpus_sources?: Array<CorpusSource>;
	// The real-code snapshot every `real`/`framework` source was read from — the
	// `fuzdev/corpora` checkout at its commit (`subpath` empty), one roll-up commit
	// for the whole real-code corpus. Present from `version` 14 on; absent on
	// conformance-only reports (no real code).
	corpus_snapshot?: CorpusRepoRef;
	// The machine that produced the report — CPU model, OS/arch, runtime version.
	// The throughput numbers are machine-relative, so this is the environment the
	// meta panel discloses. Present from `version` 7 on (absent on older reports).
	machine?: Machine;
	// Per-corpus-source coverage — `group → source → impl → {processed, total}`,
	// the machine-readable half of the per-source tables in tsv's own markdown
	// report. Conformance reports only (the perf surface is 100% by construction).
	// Present from `version` 8 on; not rendered — this page shows each group's
	// aggregate, which blends corpora answering different questions, so these rows
	// are the sharper view if it ever grows one.
	coverage_by_source?: Record<string, Record<string, Record<string, SourceCoverageCell>>>;
	// Artifacts the size table reached for and didn't find. That table's
	// COMPOSITION varies by the producing machine — a row exists only for a built
	// artifact — so this is what tells a missing row apart from an artifact that
	// stopped being produced. Present from `version` 11 on; not rendered, kept for
	// parity.
	binary_sizes_absent?: Array<string>;
	// Implementations that failed to initialize on the producing machine, as
	// `{impl, reason, rows}`. An impl that doesn't load contributes NO row, so
	// without this a tool that broke upstream is indistinguishable from one that was
	// never measured (the Node report should be `[]`; Bun's carries its known
	// `biome-wasm` load failure). Present from `version` 10 on, `rows` from `version` 12; not
	// rendered here, kept for parity.
	unavailable?: Array<UnavailableImpl>;
	// Files a byte-graded row ACCEPTED whose output the producing bench's
	// byte-parity check could not digest, as `{"<group>/<row>": count}` — `{}` when
	// every accepted output was gradeable, which is the healthy state. The one known
	// cause is a pathologically deep AST overflowing V8's recursive `JSON.stringify`.
	// Unlike every other field here it records a measurement the run could NOT make,
	// so a growing count means that check is quietly covering less. Present from
	// `version` 13 on; not rendered, kept for parity.
	output_digest_ungraded?: Record<string, number>;
}

// Per-impl coverage for one corpus source (see `coverage_by_source`).
export interface SourceCoverageCell {
	processed: number;
	total: number;
}

// One implementation that failed to load on the machine that produced a report
// (see `BenchmarkBaseline.unavailable`). Mirrors the bench's `UnavailableImpl`.
//
// `impl` is the bench's init-line LABEL (`Biome`, `OXC WASM`) and matches no row
// name — `rows` is the joinable identity, and the only one to look a row up by.
export interface UnavailableImpl {
	impl: string;
	reason: string;
	// The row names this failure removed from the tables. Absent on `version` 11
	// and older reports.
	rows?: Array<string>;
}

// A same-engine pair that disagreed — one engine behind two bindings
// (native/wasm), or one binding under two options. Mirrors the bench's
// `VariantParityFinding` (see `BenchmarkBaseline.variant_parity`); the
// neutral keys arrived with report `version` 9, which is also when the check
// started pairing options (older reports spell them `native`/`wasm`).
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
	// here in practice — kept for parity with the report shape. Absent on
	// reports older than the byte check; treat as optional.
	output_mismatch?: number;
	output_mismatch_examples?: Array<string>;
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
	// `files`). Present on reports whose loader emitted it; older reports carry
	// only the `files` total, so treat it as optional.
	by_language?: Partial<Record<string, number>>;
	// The source's GitHub origin, detected by the bench at report-build time (URL +
	// commit + subpath): for a `fuzdev/corpora` collection the UPSTREAM its manifest
	// names, read from that manifest; for any other checkout, git. Absent on older reports and on sources with no
	// GitHub remote — presence keys on the field, not the report `version` (it
	// arrived without one and is not tied to any), so treat it as optional.
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
	// Stability read from the RAW timings (report `version` 15 on): the cv before
	// outlier removal and the second-half-over-first-half `drift`, which see a cost
	// that moved WHILE the row was measured — the cleaned `cv` above cannot, since
	// the bench's outlier cleaner deletes or blends a second mode rather than
	// reporting it. With them: the timing count before cleaning, the share removed,
	// the protocol the row ran under, and a hash of the timed path set. Absent on
	// older reports.
	cv_raw?: number | null;
	drift?: number | null;
	raw_sample_size?: number | null;
	outlier_ratio?: number | null;
	warmup_iterations?: number | null;
	min_iterations?: number | null;
	files_iterated_digest?: string | null;
	// Per-implementation preflight coverage: files this impl processed / the
	// language's total discovered files. Present from baseline `version` 3 on;
	// absent (or `null`) in older baselines.
	files_processed?: number | null;
	files_total?: number | null;
	// Files this impl was actually timed on (the per-group intersection in
	// default mode). Present from baseline `version` 4 on.
	files_iterated?: number | null;
	// Present from report `version` 5 on (matches the report's top-level);
	// not rendered, kept for parity.
	runtime?: string;
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
	// two can differ. Absent on reports produced before the split.
	oxc_parser_wasm?: string;
	oxfmt?: string;
	// `yuku-parser` (N-API) and `@yuku-parser/wasm` — one Zig engine behind two
	// bindings, versioned in lockstep upstream. Absent on reports produced before
	// the yuku rows.
	yuku_parser?: string;
	yuku_parser_wasm?: string;
	biome?: string;
	// `@dprint/typescript` — the plugin version (the host `@dprint/formatter` is
	// just the Wasm loader). Absent on reports produced before the dprint row.
	dprint?: string;
	// `@rsvelte/fmt` — the coverage-only Svelte formatter row. Absent on reports
	// produced before the rsvelte-fmt row.
	rsvelte_fmt?: string;
	// `dprint-plugin-malva` — dprint's CSS formatter plugin, over the same Wasm
	// host as `dprint` above. Absent on reports produced before the malva row.
	malva?: string;
	// `postcss` — the CSS parser row. Absent on reports produced before it.
	postcss?: string;
	// `@rsvelte/vite-plugin-svelte-native` — the N-API addon behind the Svelte
	// PARSE rows, a different package from `@rsvelte/fmt` above and versioned
	// independently. Absent on reports produced before those rows.
	rsvelte_parse?: string;
	// The upstream Svelte version that addon targets (its own `VERSION` export),
	// which is not its package version — a drift from the `svelte` pin means those
	// rows parse to a different Svelte than the svelte/compiler row beside them.
	rsvelte_parse_svelte_target?: string;
	// `@swc/core` — the TypeScript/JS parser row. Absent on reports produced
	// before it.
	swc?: string;
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

// Primary tsv entry names for speedup summary (fair comparisons)
const PRIMARY_NATIVE_FORMAT = 'tsv';
const PRIMARY_WASM_FORMAT = 'tsv-wasm';

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

/**
 * Fixed slot for a format/parse row, applied in place of a size-ordered sort so the
 * rows read in a stable, meaningful sequence across every group: the canonical
 * reference first (the default 1.0x anchor), then the cross-tool comparisons
 * (alphabetically: biome, dprint — whose category malva shares — oxc, postcss,
 * rsvelte, swc, yuku), then tsv's JSON-materializing
 * wires (the span-only `no-locations` wire before the default `loc`-carrying one),
 * then tsv's own engine rows — `tsv`/`tsv-wasm` in the format groups, the
 * `-internal` rows in the parse groups.
 */
const speed_entry_rank = (entry: BenchmarkDisplayEntry): number => {
	const rank = CROSS_TOOL_RANK[entry.category];
	if (rank !== undefined) return rank;
	if (entry.name.endsWith('-no-locations')) return 8; // tsv json, span-only wire
	if (entry.name.endsWith('-json')) return 9; // tsv json, loc-carrying wire
	return 10; // tsv's engine rows: `tsv`/`tsv-wasm` (format), `-internal` (parse, no JS materialization)
};

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
 * A grayed-out, inert copy of a measured entry (or a bare template) for a group the
 * tool doesn't run in — no bar, no coverage, never an anchor.
 */
const to_placeholder = (entry: BenchmarkDisplayEntry): BenchmarkDisplayEntry => ({
	...entry,
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
		// format, the JS baseline for parse), so the first row is the default 1.0x
		// anchor; the shared component reads that default off the first row and
		// recomputes every ratio, re-baselining onto whichever row is hovered. (Size
		// groups lead with their smallest build; see `derive_size_groups`.)
		// `?? 0` coerces a null timing so the display entry's `mean_ns` stays a
		// number. On a perf report the nulls are exactly the COVERAGE-ONLY rows —
		// a tool measured for what it accepts but never timed (see
		// `BenchmarkDisplayEntry.coverage_only`) — and a 0 there is inert: those
		// rows render without a bar, value, or ratio, so the coerced number is
		// never displayed or divided by. It does keep them out of `slowest`, which
		// is what we want — a row with no timing must not set the bar scale.
		const slowest = Math.max(...entries.map((e) => e.mean_ns ?? 0));

		const display_entries: Array<BenchmarkDisplayEntry> = entries.map((e) => {
			// `mean_ns` is the timing the bars and ratios are built from, so its
			// absence — not the tool's identity — is what marks a row untimed. That
			// keeps this independent of which tools happen to be coverage-only.
			const untimed = e.mean_ns == null;
			return {
				name: e.name,
				mean_ns: e.mean_ns ?? 0,
				bar_fraction: untimed || slowest <= 0 ? 0 : (e.mean_ns ?? 0) / slowest,
				category: categorize_name(e.name),
				files_processed: e.files_processed ?? null,
				files_total: e.files_total ?? null,
				...(untimed ? { disabled: true, coverage_only: true } : null)
			};
		});

		// Fixed order (see `compare_speed_entries`): canonical leads as the default 1.0x
		// anchor, then the cross-tool rows, tsv's json wires, then tsv's internal engine
		display_entries.sort(compare_speed_entries);

		const iterated_counts = entries
			.map((e) => e.files_iterated)
			.filter((v): v is number => v != null);
		result.push({
			operation,
			language,
			entries: display_entries,
			canonical_entry: display_entries.find((e) => e.category === 'canonical'),
			files_iterated: iterated_counts.length > 0 ? Math.max(...iterated_counts) : null
		});
	}

	result.sort(compare_group_order);

	// Neither `biome` nor (for svelte/css) `oxc-parser` has a real entry in every
	// parse group. `biome`'s `@biomejs/js-api` never exposes a parser to JS at all
	// (only formatting and linting), so no parse group has a real biome entry;
	// `oxc-parser` only parses TypeScript/JS, so the svelte and css parse groups
	// lack it. Mirror both in as disabled placeholders — biome always, oxc-parser
	// only where it's missing — then re-sort so they fall into their fixed slots
	// (biome then oxc, right after the canonical row), giving all three parse groups
	// one shared entry order.
	//
	// `yuku-parser` is deliberately NOT mirrored, though it is TypeScript/JS-only too.
	// A grayed-out slot states a SCOPE gap: biome and oxc are broad web toolchains, so
	// a missing Svelte or CSS parser is worth showing. yuku claims nothing wider, so
	// an empty slot would invent a shortfall against a promise it never made.
	const ts_parse = result.find((g) => g.operation === 'parse' && g.language === 'typescript');
	const oxc_templates = ts_parse?.entries.filter((e) => e.category === 'oxc') ?? [];
	for (const group of result) {
		if (group.operation !== 'parse') continue;
		// guarded like the others, so a report that grows a real biome parse row
		// can't produce a second `biome-wasm` entry (the rows are keyed by name)
		const biome_placeholders: Array<BenchmarkDisplayEntry> = group.entries.some(
			(e) => e.category === 'biome'
		)
			? []
			: [
					to_placeholder({
						name: 'biome-wasm',
						mean_ns: 0,
						bar_fraction: 0,
						category: 'biome',
						files_processed: null,
						files_total: null
					})
				];
		const needs_oxc =
			group.language !== 'typescript' && !group.entries.some((e) => e.category === 'oxc');
		const oxc_placeholders = needs_oxc ? oxc_templates.map(to_placeholder) : [];
		group.entries.push(...biome_placeholders, ...oxc_placeholders);
		group.entries.sort(compare_speed_entries);
	}

	// The format-side analogue: `@dprint/typescript` formats TypeScript/JS only and
	// rejects Svelte outright, so the svelte FORMAT group has no real dprint entry.
	// Mirror it in as a disabled placeholder so the format groups share one entry
	// order, exactly as oxc-parser is mirrored into the svelte/css parse groups
	// above. css is NOT filled: the bench runs dprint's own CSS plugin, malva,
	// through the same Wasm host, and that row shares dprint's category
	// (`CATEGORY_BY_NAME`), so the "no dprint-category entry" guard below already
	// leaves it alone. Guarded on the template existing, so a report predating the
	// dprint row renders unchanged.
	const ts_format = result.find((g) => g.operation === 'format' && g.language === 'typescript');
	const dprint_templates = ts_format?.entries.filter((e) => e.category === 'dprint') ?? [];
	if (dprint_templates.length > 0) {
		for (const group of result) {
			if (group.operation !== 'format') continue;
			if (group.entries.some((e) => e.category === 'dprint')) continue;
			group.entries.push(...dprint_templates.map(to_placeholder));
			group.entries.sort(compare_speed_entries);
		}
	}

	return result;
};

// Parse-conformance coverage (the conformance report's headline metric)

export interface ConformanceRow {
	name: string;
	// dimmed qualifier rendered beside the name, for the one case where WHICH
	// binding produced the row is worth saying — see `CONFORMANCE_ROW_NOTES`
	note?: string;
	files_processed: number;
	files_total: number;
	// files_processed / files_total, rendered as the coverage percentage
	coverage_fraction: number;
}

export interface ConformanceGroup {
	language: string;
	// the language's total discovered files (every row shares it)
	files_total: number;
	rows: Array<ConformanceRow>;
}

/**
 * One coverage row per ENGINE, not per binding: the conformance headline is
 * "which files does this parser accept," which is identical across a tool's
 * native/wasm/internal variants — so the `-wasm` and `-internal` duplicates
 * are dropped and `tsv-json` stands in for tsv (relabeled plainly, since the
 * JSON-materialization qualifier is a speed concern, not a coverage one).
 *
 * Which binding stands in is therefore arbitrary — except for yuku, where the
 * conformance report carries the wasm row alone: its native binding crashes the
 * host process on this corpus's escaped-identifier tests, so tsv's harness omits
 * that row there. Keying on `yuku-parser` would silently drop the engine.
 */
const CONFORMANCE_ENGINE_NAMES: Record<string, string> = {
	'svelte/compiler': 'svelte/compiler',
	'acorn-typescript': 'acorn-typescript',
	'tsv-json': 'tsv',
	'oxc-parser': 'oxc-parser',
	'yuku-parser-wasm': 'yuku-parser',
	// rsvelte's two parse rows are one engine under two options, so only the
	// default-wire one stands in — the option changes the payload, never the
	// verdict.
	'rsvelte-parse': 'rsvelte',
	swc: 'swc',
	// The TypeScript compiler's own parser, which appears on this surface alone —
	// a verdict rather than a speed, so it carries no throughput row. Its reading
	// changes by corpus source, which the note below spells out.
	tsc: 'tsc',
	postcss: 'PostCSS'
};

/**
 * Qualifiers rendered beside a coverage row, keyed by report entry name. The
 * table is per engine and says nothing about bindings — so a note here is for
 * when the row's reading needs a caveat the coverage number can't carry, whether
 * that's the binding or the grammar being measured.
 */
const CONFORMANCE_ROW_NOTES: Record<string, string> = {
	'yuku-parser-wasm': 'wasm — native segfaults',
	// tsc selected part of this corpus, where it therefore scores 100% by
	// construction — the same shape as svelte/compiler on the Svelte set, but
	// invisible here because it holds for only a SLICE of the TypeScript group
	// rather than the whole of it. Without the note the blended number reads as
	// one achieved result, and its shortfall reads as a defect in the corpus
	// rather than as the corpora tsc never selected. Spelled out below the tables.
	tsc: 'oracle for part of this corpus',
	// The CSS group's reference row is svelte/compiler's `parseCss`, which is not a
	// validity oracle in either direction — so PostCSS sitting slightly above it is
	// a grammar difference, not a conformance verdict. Spelled out in the notes
	// below the tables.
	postcss: 'a different CSS grammar'
};

/**
 * Derives per-language parse-coverage groups from a conformance report
 * (`corpus_kind: 'conformance'` — parse groups only). Rows are ordered by coverage,
 * highest first; entries without coverage data are dropped.
 */
export const derive_conformance_groups = (baseline: BenchmarkBaseline): Array<ConformanceGroup> => {
	const keyed = baseline.entries.flatMap((entry) => {
		const { operation, language } = parse_group_key(entry.group);
		const name = CONFORMANCE_ENGINE_NAMES[entry.name];
		const { files_processed, files_total } = entry;
		if (operation !== 'parse' || !language || !name) return [];
		if (files_processed == null || files_total == null) return [];
		const row: ConformanceRow = {
			name,
			note: CONFORMANCE_ROW_NOTES[entry.name],
			files_processed,
			files_total,
			coverage_fraction: files_total > 0 ? files_processed / files_total : 0
		};
		return [{ language, row }];
	});

	const result: Array<ConformanceGroup> = [];
	for (const [language, keyed_rows] of Map.groupBy(keyed, (k) => k.language)) {
		const rows = keyed_rows.map((k) => k.row);
		// coverage descending (highest acceptance first), name as a stable tiebreak
		rows.sort((a, b) => b.coverage_fraction - a.coverage_fraction || a.name.localeCompare(b.name));
		result.push({
			language,
			files_total: Math.max(0, ...rows.map((r) => r.files_total)),
			rows
		});
	}
	result.sort((a, b) => (LANGUAGE_ORDER[a.language] ?? 9) - (LANGUAGE_ORDER[b.language] ?? 9));
	return result;
};

/**
 * Formats a coverage fraction as a percentage with two decimals (`99.85%`),
 * FLOORED rather than rounded — rounding would render e.g. 44219/44220 as
 * `100.00%` next to a visibly non-total count. Only exact totality reads 100%
 * (matching the harness's own `coverage_pct` convention in tsv's report.ts).
 */
export const format_coverage_percent = (fraction: number): string =>
	`${(Math.floor(fraction * 10_000) / 100).toFixed(2)}%`;

export const derive_speedup_summary = (groups: Array<BenchmarkGroup>): Array<SpeedupRow> => {
	const find_speedup = (
		operation: string,
		language: string,
		primary_name: string
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
			format_css: find_speedup('format', 'css', PRIMARY_NATIVE_FORMAT)
		},
		{
			variant: 'wasm',
			format_svelte: find_speedup('format', 'svelte', PRIMARY_WASM_FORMAT),
			format_typescript: find_speedup('format', 'typescript', PRIMARY_WASM_FORMAT),
			format_css: find_speedup('format', 'css', PRIMARY_WASM_FORMAT)
		}
	];
};

// Measurement stability

/**
 * The bench's own instability thresholds, restated: a cleaned or raw cv at or past
 * `UNSTABLE_CV_THRESHOLD`, or a |drift| at or past `UNSTABLE_DRIFT_THRESHOLD`, and
 * the row's mean may be neither of two modes it blended. Mirrors `bench.ts`.
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
export const is_entry_unstable = (entry: BaselineEntry): boolean => {
	if (entry.cv == null) return false;
	if (entry.cv >= UNSTABLE_CV_THRESHOLD) return true;
	if (
		entry.cv_raw != null &&
		entry.cv_raw >= UNSTABLE_CV_THRESHOLD &&
		entry.raw_sample_size != null &&
		entry.raw_sample_size < RAW_CV_SAMPLE_CEILING
	) {
		return true;
	}
	if (entry.drift != null && Math.abs(entry.drift) >= UNSTABLE_DRIFT_THRESHOLD) return true;
	return false;
};

/**
 * The timed rows of a per-runtime report whose measurement was not stable, worst
 * first — the page's disclosure beside the numbers built from that report.
 */
export const derive_unstable_entries = (baseline: BenchmarkBaseline): Array<BaselineEntry> =>
	baseline.entries
		.filter(is_entry_unstable)
		.sort(
			(a, b) =>
				Math.max(b.cv ?? 0, b.cv_raw ?? 0, Math.abs(b.drift ?? 0)) -
				Math.max(a.cv ?? 0, a.cv_raw ?? 0, Math.abs(a.drift ?? 0))
		);

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

// Corpus source repos

export interface CorpusRepo {
	// public repo URL the entry links to
	url: string;
	// `org/name`, derived from the URL — the linkified display label
	label: string;
}

/**
 * The distinct source repos behind a report's corpus, one entry per URL in
 * first-seen order (the author's ecosystem leads, the upstream framework repos
 * trail, matching the source order). Sources sharing a repo (svelte.dev's several
 * packages) collapse to one entry; a source with no detected repo (the
 * `svelte_styles` CSS cache) is dropped. Every URL comes from the report's own
 * `repo` — for a snapshot collection that is the UPSTREAM the snapshot vendored,
 * so the list still names the projects, not the snapshot repo (which
 * `corpus_snapshot` names once).
 */
export const derive_corpus_repos = (
	sources: Array<CorpusSource> | undefined
): Array<CorpusRepo> => {
	const by_url: Map<string, CorpusRepo> = new Map();
	for (const source of sources ?? []) {
		const repo = source.repo;
		if (!repo || by_url.has(repo.url)) continue;
		by_url.set(repo.url, { url: repo.url, label: repo.slug });
	}
	return [...by_url.values()];
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
	const a = find(slower)?.mean_ns;
	const b = find(faster)?.mean_ns;
	if (a == null || !b) return undefined;
	return a / b;
};

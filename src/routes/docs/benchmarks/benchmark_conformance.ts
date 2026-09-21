// The parse-conformance domain: the coverage tables `BenchmarksConformance.svelte`
// renders and the per-source slices the page's prose reads, derived from the
// conformance report (the per-runtime report shape, `corpus_kind: 'conformance'`).

import {
	compare_group_order,
	parse_group_key,
	type BenchmarkBaseline,
	type SourceCoverageCell
} from './benchmark_data.ts';

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
	// every group here is a parse group, so this orders them by language
	result.sort((a, b) =>
		compare_group_order({ operation: 'parse', ...a }, { operation: 'parse', ...b })
	);
	return result;
};

/**
 * The conformance corpus sources the page's prose reads by name: the two large
 * TypeScript slices each selected by one parser here (test262 by tsv's runner,
 * the TypeScript compiler's cases by tsc), and Prettier's third-party JS suite,
 * which neither scoped. Paths as the report's `coverage_by_source` keys them.
 */
export const CONFORMANCE_SOURCE_PATHS = {
	test262: 'benches/js/.cache/test262_files.json',
	ts_repo: 'benches/js/.cache/ts_repo_files.json',
	prettier_js: '../prettier/tests/format/js',
	// Prettier's HTML fixtures, parsed as Svelte inside the Svelte group
	prettier_html: '../prettier/tests/format/html'
} as const;

/** One source's slice of a conformance group — see `derive_conformance_slice`. */
export interface ConformanceSlice {
	// the slice's files as a fraction of the group's corpus
	share: number;
	// the slice's file count (every engine shares it)
	total: number;
	// accepted counts per engine, keyed by the display names the coverage table uses
	rows: Record<string, SourceCoverageCell>;
}

/**
 * One corpus source's slice of a conformance group: its share of the group's
 * files and each engine's accepted count on it, for prose that reads the
 * aggregate by source rather than as one number. Engines are keyed as
 * `derive_conformance_groups` names them, so a binding duplicate collapses the
 * same way. `undefined` when the report lacks the group or the source.
 */
export const derive_conformance_slice = (
	baseline: BenchmarkBaseline,
	group: string,
	source_path: string
): ConformanceSlice | undefined => {
	const by_impl = baseline.coverage_by_source?.[group]?.[source_path];
	if (!by_impl) return undefined;
	const group_total = baseline.corpus[parse_group_key(group).language];
	const total = Object.values(by_impl)[0]?.total;
	if (!group_total || total == null) return undefined;
	const rows: Record<string, SourceCoverageCell> = {};
	for (const [impl, cell] of Object.entries(by_impl)) {
		const name = CONFORMANCE_ENGINE_NAMES[impl];
		if (name) rows[name] = cell;
	}
	return { share: total / group_total, total, rows };
};

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

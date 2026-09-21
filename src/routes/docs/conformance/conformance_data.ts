// The parse-conformance domain: the per-source coverage matrices
// `ConformanceTable.svelte` renders, derived from the conformance report (the
// per-runtime report shape, `corpus_kind: 'conformance'`).

import {
	compare_group_order,
	corpus_source_url,
	parse_group_key,
	type BenchmarkBaseline,
	type SourceCoverageCell
} from '../benchmarks/benchmark_data.ts';

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
 * Qualifiers rendered beside an engine's name, keyed by report entry name. The
 * table is per engine and says nothing about bindings — so a note here is for
 * the one case where WHICH binding stands in is worth saying.
 */
const CONFORMANCE_ROW_NOTES: Record<string, string> = {
	// the native binding segfaults on this corpus, spelled out in the page's notes
	'yuku-parser-wasm': 'wasm'
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

// The two harvested TypeScript caches a parser here selected, as the report's
// `coverage_by_source` keys them.
const SOURCE_TEST262 = 'benches/js/.cache/test262_files.json';
const SOURCE_TS_REPO = 'benches/js/.cache/ts_repo_files.json';

/**
 * Reader-facing names for the report's corpus source paths. A path missing here
 * renders raw, and the shape test fails on it, so a source tsv adds can't reach
 * the page as a cache path unnoticed.
 */
const CONFORMANCE_SOURCE_LABELS: Record<string, string> = {
	'../prettier-plugin-svelte/test': "prettier-plugin-svelte's tests",
	'../prettier/tests/format/typescript': "Prettier's TypeScript fixtures",
	'../prettier/tests/format/js': "Prettier's JS fixtures",
	'../prettier/tests/format/css': "Prettier's CSS fixtures",
	'../prettier/tests/format/html': "Prettier's HTML fixtures",
	'../svelte/packages/svelte/tests': "Svelte's tests",
	'benches/js/.cache/wpt_css': 'web-platform-tests CSS',
	[SOURCE_TEST262]: 'test262',
	[SOURCE_TS_REPO]: "TypeScript compiler's cases"
};

/**
 * The engine that SELECTED a corpus source, so reads 100% on it by construction
 * rather than by achievement: group key → source path (`*` for every source of
 * the group) → engine display name. Hand-stated because the report carries no
 * such field — svelte/compiler's rejects are excluded from the whole Svelte set,
 * tsc kept only the compiler cases it parses cleanly, and the test262 cache is
 * the expected-valid subset of the tests tsv's runner grades. The shape test
 * holds every entry to the report: it must resolve, and its cell must be full.
 */
export const CONFORMANCE_SELECTORS: Record<string, Record<string, string>> = {
	'parse/svelte': { '*': 'svelte/compiler' },
	'parse/typescript': { [SOURCE_TEST262]: 'tsv', [SOURCE_TS_REPO]: 'tsc' }
};

/** One engine's coverage of one corpus source, or of the whole group. */
export interface ConformanceCell {
	processed: number;
	total: number;
	// total - processed, the magnitude a near-100% percentage compresses
	rejected: number;
	coverage_fraction: number;
	// this engine selected the source, so the cell is 100% by construction
	selected: boolean;
}

/** A matrix column — one engine, named as `derive_conformance_groups` names it. */
export interface ConformanceEngine {
	name: string;
	note?: string;
}

/** A corpus source a matrix row covers, for its linked label. */
export interface ConformanceSourceOrigin {
	path: string;
	// `undefined` for a path `CONFORMANCE_SOURCE_LABELS` lacks, which renders raw
	label: string | undefined;
	url: string | undefined;
}

export interface ConformanceSourceRow {
	// one origin, or several for the folded row
	origins: Array<ConformanceSourceOrigin>;
	// the sources every engine accepts in full, folded into one trailing row
	folded: boolean;
	files: number;
	// `files` as a fraction of the group's corpus
	share: number;
	// aligned to the matrix's `engines`; `undefined` where the report lacks the cell
	cells: Array<ConformanceCell | undefined>;
}

export interface ConformanceMatrix {
	language: string;
	files_total: number;
	// ordered as `derive_conformance_groups` orders its rows
	engines: Array<ConformanceEngine>;
	// largest source first, the folded row last; empty when the report predates
	// `coverage_by_source`
	sources: Array<ConformanceSourceRow>;
	// the whole group per engine, aligned to `engines`
	aggregate: Array<ConformanceCell>;
}

const to_conformance_cell = (
	processed: number,
	total: number,
	selected: boolean
): ConformanceCell => ({
	processed,
	total,
	rejected: total - processed,
	coverage_fraction: total > 0 ? processed / total : 0,
	selected
});

// a source no engine selected and none rejects any of says nothing a reader can
// compare, so two or more of them fold into one row
const is_foldable = (row: ConformanceSourceRow): boolean =>
	row.cells.some((cell) => cell !== undefined) &&
	row.cells.every((cell) => cell === undefined || (!cell.selected && cell.rejected === 0));

const fold_conformance_rows = (
	rows: Array<ConformanceSourceRow>,
	files_total: number
): ConformanceSourceRow => {
	const files = rows.reduce((sum, row) => sum + row.files, 0);
	return {
		origins: rows.flatMap((row) => row.origins),
		folded: true,
		files,
		share: files_total > 0 ? files / files_total : 0,
		cells: (rows[0]?.cells ?? []).map((_, i) => {
			const cells = rows.map((row) => row.cells[i]);
			if (!cells.every((cell) => cell !== undefined)) return undefined;
			return to_conformance_cell(
				cells.reduce((sum, cell) => sum + cell.processed, 0),
				cells.reduce((sum, cell) => sum + cell.total, 0),
				false
			);
		})
	};
};

/**
 * Derives one coverage matrix per language from a conformance report: a row per
 * corpus source and a column per engine, with the group aggregate alongside. The
 * aggregate blends sources that answer different questions, so the rows are the
 * finding — and a cell whose engine selected the source (`CONFORMANCE_SELECTORS`)
 * is flagged rather than left to read as a result. Engines fold and order as in
 * `derive_conformance_groups`.
 */
export const derive_conformance_matrices = (
	baseline: BenchmarkBaseline
): Array<ConformanceMatrix> =>
	derive_conformance_groups(baseline).map((group) => {
		const group_key = `parse/${group.language}`;
		const selectors = CONFORMANCE_SELECTORS[group_key];
		const engines = group.rows.map(({ name, note }): ConformanceEngine => ({ name, note }));

		const rows = Object.entries(baseline.coverage_by_source?.[group_key] ?? {}).map(
			([path, by_impl]): ConformanceSourceRow => {
				const by_engine: Record<string, SourceCoverageCell> = {};
				for (const [impl, cell] of Object.entries(by_impl)) {
					const name = CONFORMANCE_ENGINE_NAMES[impl];
					if (name) by_engine[name] ??= cell;
				}
				const selector = selectors?.[path] ?? selectors?.['*'];
				// every impl shares the slice total, which the shape test holds
				const files = Math.max(0, ...Object.values(by_impl).map((cell) => cell.total));
				const source = baseline.corpus_sources.find((s) => s.path === path);
				return {
					origins: [
						{
							path,
							label: CONFORMANCE_SOURCE_LABELS[path],
							url: source && corpus_source_url(source)
						}
					],
					folded: false,
					files,
					share: group.files_total > 0 ? files / group.files_total : 0,
					cells: engines.map((engine) => {
						const cell = by_engine[engine.name];
						return (
							cell && to_conformance_cell(cell.processed, cell.total, engine.name === selector)
						);
					})
				};
			}
		);

		const foldable = rows.filter(is_foldable);
		const sources = foldable.length > 1 ? rows.filter((row) => !is_foldable(row)) : rows;
		// largest first, path as a stable tiebreak
		sources.sort(
			(a, b) =>
				b.files - a.files || (a.origins[0]?.path ?? '').localeCompare(b.origins[0]?.path ?? '')
		);
		if (foldable.length > 1) sources.push(fold_conformance_rows(foldable, group.files_total));

		return {
			language: group.language,
			files_total: group.files_total,
			engines,
			sources,
			aggregate: group.rows.map((row) =>
				to_conformance_cell(row.files_processed, row.files_total, false)
			)
		};
	});

import { assert, describe, test } from 'vitest';

import { conformance_json } from '$routes/docs/conformance/conformance.ts';
import { derive_corpus_source_table } from '$routes/docs/benchmarks/benchmark_data.ts';
import {
	CONFORMANCE_SOURCE_LABELS,
	derive_conformance_groups,
	derive_conformance_matrices
} from '$routes/docs/conformance/conformance_data.ts';

// Gates the claims the conformance page's prose makes about the committed report,
// as `benchmark_data.prose.test.ts` does for the benchmarks page.
describe('conformance prose reads the report', () => {
	test('the unfiltered CSS sources are the ones some parser falls short of', () => {
		// "the CSS sources keep invalid and out-of-scope inputs ... read a row's parsers
		// against each other, not against 100%" — named for wpt's CSS and Prettier's `.css`
		// fixtures; the note is empty for a row every parser accepts in full (PostCSS,
		// keeping selectors as strings, may well read 100% on the Prettier set)
		const css = derive_conformance_matrices(conformance_json).find((m) => m.language === 'css');
		for (const path of ['benches/js/.cache/wpt_css', '../prettier/tests/format/css']) {
			const row = css?.sources.find((s) => s.origins[0]?.path === path);
			assert(row, `css ${path} is missing`);
			assert.isNotEmpty(row.cells, path);
			assert.isTrue(
				row.cells.some((cell) => (cell?.rejected ?? 0) > 0),
				`${path}: every parser accepts it in full`
			);
		}
	});

	test('"tsv\'s 100% on test262 is a result" the report still carries', () => {
		// no selector flags that cell, so nothing else holds the hand-written figure
		const typescript = derive_conformance_matrices(conformance_json).find(
			(m) => m.language === 'typescript'
		);
		const row = typescript?.sources.find(
			(s) => s.origins[0]?.path === 'benches/js/.cache/test262_files.json'
		);
		const cell = row?.cells[typescript?.engines.findIndex((e) => e.name === 'tsv') ?? -1];
		assert(cell, 'tsv has no test262 cell');
		assert.isFalse(cell.selected);
		assert.strictEqual(cell.rejected, 0);
	});

	test('the CSS conformance note names the order the table shows', () => {
		// "tsv, a drop-in for Svelte's `parseCss`, sits above it by also parsing spec-valid
		// CSS that `parseCss` rejects. PostCSS leads by parsing less, not because tsv falls
		// short"
		const coverage = (language: string, name: string): number => {
			const row = derive_conformance_groups(conformance_json)
				.find((g) => g.language === language)
				?.rows.find((r) => r.name === name);
			assert(row, `${language}/${name} is missing`);
			return row.coverage_fraction;
		};
		assert.isAbove(coverage('css', 'PostCSS'), coverage('css', 'tsv'));
		assert.isAbove(coverage('css', 'tsv'), coverage('css', 'svelte/compiler'));
	});

	test("the conformance note on oxc-parser's two bindings reads the report", () => {
		// "the wasm one, pinned to an older release ..., accepts a couple more files" —
		// both halves are facts about the copied report, and either can go stale on a
		// refresh: the bindings re-aligning makes the note a fiction, a wider gap makes
		// "a couple" an understatement.
		const { versions, entries } = conformance_json;
		assert.isDefined(versions.oxc_parser_wasm);
		assert.notStrictEqual(versions.oxc_parser_wasm, versions.oxc_parser, 'bindings re-aligned');
		const processed = (name: string) => {
			const entry = entries.find((e) => e.group === 'parse/typescript' && e.name === name);
			assert(entry?.files_processed != null, `${name} coverage`);
			return entry.files_processed;
		};
		const gap = processed('oxc-parser-wasm') - processed('oxc-parser');
		assert.isAtLeast(gap, 1, 'the wasm binding accepts no more than the native one');
		assert.isAtMost(gap, 5, 'the accept sets differ by more than "a couple of files"');
	});

	test('the Test corpus section names three harvested suites, linked without a commit', () => {
		// "Each links its upstream at the commit the harness pinned, except the three
		// harvested into caches — test262, web-platform-tests CSS, and the TypeScript
		// compiler's cases — which carry no commit"
		const { rows } = derive_corpus_source_table(conformance_json, CONFORMANCE_SOURCE_LABELS);
		const harvested = rows.filter((row) => row.path.includes('/.cache/'));
		assert.strictEqual(harvested.length, 3);
		for (const row of rows) {
			assert.isDefined(row.url, row.path);
			assert.strictEqual(row.commit === undefined, harvested.includes(row), row.path);
		}
	});

	test("Prettier's CSS fixtures carry no TypeScript/JS files: the spec files are dropped", () => {
		// "From Prettier's suites the harness drops ... the spec files themselves" — the
		// only JS the CSS suite holds is its `format.test.js` harness files, so the suite's
		// TypeScript-language slice is the whole of what that claim removes
		const table = derive_corpus_source_table(conformance_json, CONFORMANCE_SOURCE_LABELS);
		const row = table.rows.find((r) => r.path === '../prettier/tests/format/css');
		assert(row, 'the source is missing');
		assert.strictEqual(row.by_language[table.languages.indexOf('typescript')] ?? 0, 0);
		assert.isAbove(row.by_language[table.languages.indexOf('css')] ?? 0, 0);
	});
});

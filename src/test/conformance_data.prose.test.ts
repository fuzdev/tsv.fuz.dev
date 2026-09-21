import { assert, describe, test } from 'vitest';

import { conformance_json } from '$routes/docs/conformance/conformance.ts';
import {
	CONFORMANCE_SOURCE_PATHS,
	derive_conformance_groups,
	derive_conformance_slice
} from '$routes/docs/conformance/conformance_data.ts';

// Gates the claims the conformance page's prose makes about the committed report,
// as `benchmark_data.prose.test.ts` does for the benchmarks page.
describe('conformance prose reads the report', () => {
	test('the TypeScript conformance slices the note reads by name are present', () => {
		// "~N% of it is the test262 slice and ~M% the TypeScript compiler's ... on
		// Prettier's third-party JS suite tsv accepts A, oxc-parser B, yuku-parser C,
		// and tsc D" — every slice and every engine named must resolve, and the two
		// self-selected slices must still be most of the aggregate for "mostly" to hold
		const slice = (path: string) =>
			derive_conformance_slice(conformance_json, 'parse/typescript', path);
		const test262 = slice(CONFORMANCE_SOURCE_PATHS.test262);
		const ts_repo = slice(CONFORMANCE_SOURCE_PATHS.ts_repo);
		const prettier_js = slice(CONFORMANCE_SOURCE_PATHS.prettier_js);
		assert(test262 && ts_repo && prettier_js, 'a named conformance source is missing');
		// "Prettier's HTML fixtures ride along in the Svelte set ... ~N% of it": a small
		// share, or the "ride along" framing understates them
		const html = derive_conformance_slice(
			conformance_json,
			'parse/svelte',
			CONFORMANCE_SOURCE_PATHS.prettier_html
		);
		assert(html, "Prettier's HTML fixtures are missing from the Svelte conformance corpus");
		assert.isBelow(html.share, 0.05, "Prettier's HTML fixtures are no longer a small share");
		assert.isAbove(test262.share + ts_repo.share, 0.5, 'the self-selected slices are not "mostly"');
		for (const engine of ['tsv', 'oxc-parser', 'yuku-parser', 'tsc']) {
			assert.isDefined(prettier_js.rows[engine], `${engine} on Prettier's JS suite`);
		}
		// "Two rows read 100% on a slice they selected themselves"
		for (const [engine, selected] of [
			['tsv', test262],
			['tsc', ts_repo]
		] as const) {
			const cell = selected.rows[engine];
			assert(cell, `${engine} on its own slice`);
			assert.strictEqual(cell.processed, cell.total, `${engine} no longer reads 100% on its slice`);
		}
	});

	test('the CSS conformance note names the order the table shows', () => {
		// "PostCSS landing a shade above tsv ... tsv, too, lands a little above parseCss",
		// and for Svelte "its number is 100% by construction"
		const coverage = (language: string, name: string): number => {
			const row = derive_conformance_groups(conformance_json)
				.find((g) => g.language === language)
				?.rows.find((r) => r.name === name);
			assert(row, `${language}/${name} is missing`);
			return row.coverage_fraction;
		};
		assert.isAbove(coverage('css', 'PostCSS'), coverage('css', 'tsv'));
		assert.isAbove(coverage('css', 'tsv'), coverage('css', 'svelte/compiler'));
		assert.strictEqual(coverage('svelte', 'svelte/compiler'), 1);
	});

	test("the conformance note on oxc-parser's two bindings reads the report", () => {
		// "its wasm binding is pinned to an older release ... and accepts a couple of
		// files the native one doesn't" — both halves are facts about the copied report,
		// and either can go stale on a refresh: the bindings re-aligning makes the note
		// a fiction, a wider gap makes "a couple" an understatement.
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

	test('the byte check left "one pathologically deep TypeScript file" undigested, on tsv\'s rows', () => {
		// the conformance note excuses exactly one file from tsv's native/wasm byte
		// parity; a growing count is the check quietly covering less
		const ungraded = Object.entries(conformance_json.output_digest_ungraded ?? {});
		assert.isNotEmpty(ungraded, 'the note discloses a file the report no longer carries');
		for (const [row, count] of ungraded) {
			assert.match(row, /^parse\/typescript\/tsv-/, row);
			assert.strictEqual(count, 1, row);
		}
	});
});

import { assert, describe, test } from 'vitest';

import { conformance_json } from '$routes/docs/conformance/conformance.ts';
import {
	derive_conformance_groups,
	derive_conformance_matrices
} from '$routes/docs/conformance/conformance_data.ts';

// Gates the claims the conformance page's prose makes about the committed report,
// as `benchmark_data.prose.test.ts` does for the benchmarks page.
describe('conformance prose reads the report', () => {
	test('the unfiltered sources are the ones no parser fully accepts', () => {
		// "The other sources keep intentionally-invalid and out-of-scope inputs ... so read
		// a row's parsers against each other, not against 100%" — named for wpt's CSS and
		// Prettier's `.css` fixtures, where every parser must fall short for it to hold
		const css = derive_conformance_matrices(conformance_json).find((m) => m.language === 'css');
		for (const path of ['benches/js/.cache/wpt_css', '../prettier/tests/format/css']) {
			const row = css?.sources.find((s) => s.origins[0]?.path === path);
			assert(row, `css ${path} is missing`);
			for (const cell of row.cells) assert.isAbove(cell?.rejected ?? 0, 0, path);
		}
	});

	test('the CSS conformance note names the order the table shows', () => {
		// "PostCSS sitting above tsv is two grammars, not a gap", over a `parseCss`
		// reference tsv is a drop-in for
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

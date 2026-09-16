import { assert, describe, test } from 'vitest';

import { benchmarks_json } from '$routes/docs/benchmarks/benchmarks.ts';
import { benchmarks_cross_runtime_json } from '$routes/docs/benchmarks/benchmarks_cross_runtime.ts';
import { benchmarks_conformance_json } from '$routes/docs/benchmarks/benchmarks_conformance.ts';
import {
	benchmarks_cli,
	cli_memory_ratio_range,
	cli_speedup_vs_tsv,
	CLI_DELIVERY_KEY,
	CLI_TS_REPO_KEY,
	CLI_TSV_NPM_LABEL,
	CLI_TSV_WASM_LABEL
} from '$routes/docs/benchmarks/benchmarks_cli.ts';
import {
	benchmark_speedup,
	derive_unstable_cells,
	derive_unstable_entries,
	is_entry_unstable,
	format_ratio_approx,
	format_ratio_range,
	format_ratio_range_approx
} from '$routes/docs/benchmarks/benchmark_data.ts';

// The page's prose quotes ratios computed from the reports rather than
// hand-written numbers, so a renamed entry or a dropped scenario would render
// `—` mid-sentence instead of failing. These gate every pair the copy names.
describe('prose ratios resolve', () => {
	// `[group, slower, faster]` in the direction each sentence reads — the copy says
	// "X faster than" for the pairs tsv leads and "slower than" / "Y is faster than
	// tsv" for the ones it trails (yuku on TypeScript, the JS parsers on CSS), so
	// every ratio here must land above 1 or the sentence has flipped.
	const IN_PROCESS_PAIRS: Array<[string, string, string]> = [
		['format/typescript', 'oxfmt', 'tsv'],
		['format/typescript', 'prettier', 'tsv'],
		['format/typescript', 'biome-wasm', 'tsv-wasm'],
		['format/svelte', 'prettier', 'tsv'],
		['format/svelte', 'biome-wasm', 'tsv-wasm'],
		['format/css', 'oxfmt', 'tsv'],
		['format/css', 'biome-wasm', 'tsv-wasm'],
		['parse/typescript', 'oxc-parser', 'tsv-json-no-locations'],
		['parse/typescript', 'tsv-json-no-locations', 'yuku-parser'],
		// "carrying it costs ~Nx the hand-off time" — the loc-bearing wire over the span-only one
		['parse/typescript', 'tsv-json', 'tsv-json-no-locations'],
		['parse/svelte', 'svelte/compiler', 'tsv-json'],
		['parse/svelte', 'rsvelte-parse', 'tsv-json'],
		['parse/css', 'tsv-json', 'svelte/compiler'],
		['parse/css', 'tsv-json', 'postcss']
	];

	test('every in-process pair the TLDR quotes is present and runs the way the sentence reads', () => {
		for (const [group, slower, faster] of IN_PROCESS_PAIRS) {
			const ratio = benchmark_speedup(benchmarks_json, group, slower, faster);
			assert.isDefined(ratio, `${group}: ${slower} vs ${faster}`);
			assert.isAbove(ratio, 1, `${group}: ${slower} vs ${faster}`);
		}
	});

	test('oxfmt formats Svelte at Prettier speed, as the note says it delegates', () => {
		// "for Svelte it delegates to Prettier internally" — if a future oxfmt grows its
		// own Svelte path the two rows will part ways and the note is stale
		const ratio = benchmark_speedup(benchmarks_json, 'format/svelte', 'oxfmt', 'prettier');
		assert.isDefined(ratio);
		assert.closeTo(ratio, 1, 0.1, 'oxfmt and prettier should be within 10% on format/svelte');
	});

	test('the CSS parse note reads the internal rows it points at', () => {
		// "the JSON hand-off is most of tsv's time there (compare the internal rows)"
		// — the wire must cost more than the engine, or the explanation is wrong
		const wire_share = benchmark_speedup(benchmarks_json, 'parse/css', 'tsv-json', 'tsv-internal');
		assert.isDefined(wire_share);
		assert.isAbove(wire_share, 2, 'tsv-json should cost at least twice tsv-internal on CSS');
	});

	test('every in-process pair the TLDR quotes was measured stably', () => {
		// A headline ratio divides two means; a row the bench flagged as unstable (a
		// cv past 10%, cleaned or raw, or a drift past 5% — a cost that moved while
		// the row was measured) publishes a mean that may sit between two modes. The
		// bench discloses it in its report; nothing on the page read that field, and
		// a "~10x" once shipped off a row that was 8x by median. Re-run the runtime
		// (`deno task bench:node:run && deno task bench:compose`) and re-publish.
		for (const [group, slower, faster] of IN_PROCESS_PAIRS) {
			for (const name of [slower, faster]) {
				const entry = benchmarks_json.entries.find((e) => e.group === group && e.name === name);
				assert(entry, `${group}/${name} is missing`);
				assert.isFalse(
					is_entry_unstable(entry),
					`${group}/${name} was not measured stably (cv ${entry.cv}, raw cv ${entry.cv_raw}, ` +
						`drift ${entry.drift}, n=${entry.sample_size}) — re-run before publishing`
				);
			}
		}
	});

	test('the unstable disclosures read the report fields they claim to', () => {
		// `derive_unstable_entries` must agree with the per-row predicate over the
		// whole report, and the combined report's `unstable_cells` must name only rows
		// the tables carry — the disclosure can't point at a row a reader can't find.
		const flagged = derive_unstable_entries(benchmarks_json);
		for (const entry of benchmarks_json.entries) {
			assert.strictEqual(
				flagged.includes(entry),
				is_entry_unstable(entry),
				`${entry.group}/${entry.name}`
			);
		}
		const row_keys = new Set(benchmarks_cross_runtime_json.rows.map((r) => `${r.group}/${r.name}`));
		for (const cell of derive_unstable_cells(benchmarks_cross_runtime_json)) {
			assert(row_keys.has(`${cell.group}/${cell.name}`), `${cell.group}/${cell.name}`);
			assert(
				benchmarks_cross_runtime_json.runtimes.includes(cell.runtime),
				`${cell.runtime} is not a runtime the report carries`
			);
		}
	});

	test('every CLI ratio the prose quotes is present', () => {
		for (const [label, metric] of [
			['oxfmt', 'wall_ms'],
			['oxfmt', 'cpu_ms'],
			['biome', 'wall_ms'],
			['biome', 'cpu_ms']
		] as const) {
			assert.isDefined(
				cli_speedup_vs_tsv(CLI_TS_REPO_KEY, label, metric),
				`${CLI_TS_REPO_KEY}: ${label} ${metric}`
			);
		}
		// the TLDR's "less memory than either" range, scoped to the tools it names, and
		// the CLI note's "less than every other tool in every scenario" — both read as
		// "less", so the LOW end must clear 1 or the floored range would print "0–Nx"
		for (const range of [
			cli_memory_ratio_range(CLI_TS_REPO_KEY, ['oxfmt', 'biome']),
			cli_memory_ratio_range()
		]) {
			assert.isDefined(range);
			assert.isAbove(range.min, 1);
		}
		// the delivery note's three ratios, tsv against its own distributions
		for (const [label, metric] of [
			[CLI_TSV_NPM_LABEL, 'wall_ms'],
			[CLI_TSV_WASM_LABEL, 'wall_ms'],
			[CLI_TSV_WASM_LABEL, 'memory_mb']
		] as const) {
			const ratio = cli_speedup_vs_tsv(CLI_DELIVERY_KEY, label, metric);
			assert.isDefined(ratio, `${CLI_DELIVERY_KEY}: ${label} ${metric}`);
			// the copy reads "takes ~Nx as long" / "~Nx the memory", so each must exceed 1
			assert.isAbove(ratio, 1, `${CLI_DELIVERY_KEY}: ${label} ${metric}`);
		}
	});

	test('the CLI CPU-work note reads the way the numbers run', () => {
		// "tsv is ~Nx faster than Oxfmt in wall-clock but ~Mx in CPU work, because tsv
		// spreads its work across more cores than Oxfmt" — that holds only while the
		// wall ratio EXCEEDS the CPU ratio; "against Biome ... Biome spreads wider than
		// tsv but burns more CPU doing it" only while the wall ratio TRAILS it. Either
		// inequality flipping on a refresh leaves the sentence explaining the opposite
		// of what the table shows, so both are pinned in the direction the copy reads.
		const ratio = (label: string, metric: 'wall_ms' | 'cpu_ms') => {
			const value = cli_speedup_vs_tsv(CLI_TS_REPO_KEY, label, metric);
			assert.isDefined(value, `${CLI_TS_REPO_KEY}: ${label} ${metric}`);
			return value;
		};
		assert.isAbove(
			ratio('oxfmt', 'wall_ms'),
			ratio('oxfmt', 'cpu_ms'),
			'oxfmt: wall lead > CPU lead'
		);
		assert.isBelow(
			ratio('biome', 'wall_ms'),
			ratio('biome', 'cpu_ms'),
			'biome: wall lead < CPU lead'
		);
	});

	test('the unscoped memory range spans only the scenarios that face other tools', () => {
		// "less than every other tool in every scenario it faces them" — the tsv-only
		// delivery rows are tsv's own distributions and must not widen or narrow it
		const delivery = benchmarks_cli.scenarios.find((s) => s.key === CLI_DELIVERY_KEY);
		assert(delivery, `no generated scenario has id "${CLI_DELIVERY_KEY}"`);
		assert.isTrue(delivery.tsv_only);
		for (const r of delivery.results) {
			assert.ok(
				r.label === 'tsv' || r.label.startsWith('tsv'),
				`${CLI_DELIVERY_KEY} carries a non-tsv row: ${r.label}`
			);
		}
		const competitor_keys = benchmarks_cli.scenarios.filter((s) => !s.tsv_only).map((s) => s.key);
		assert.isNotEmpty(competitor_keys);
		const ranges = competitor_keys.map((key) => cli_memory_ratio_range(key)).filter((r) => r);
		const expected = {
			min: Math.min(...ranges.map((r) => r!.min)),
			max: Math.max(...ranges.map((r) => r!.max))
		};
		assert.deepStrictEqual(cli_memory_ratio_range(), expected);
		// and the delivery scenario, named explicitly, still spans on its own
		assert.isDefined(cli_memory_ratio_range(CLI_DELIVERY_KEY));
	});

	test('the WASM delivery row is "still ahead of the JS formatters above"', () => {
		// the delivery and large-single-file scenarios time the same parser.ts, so
		// the note's ordering claim is checkable across them
		const delivery = benchmarks_cli.scenarios.find((s) => s.key === CLI_DELIVERY_KEY);
		const single = benchmarks_cli.scenarios.find((s) => s.key === 'large-single-file');
		assert(delivery && single);
		assert.strictEqual(delivery.target.split(',')[0], single.target, 'same corpus file');
		const wasm = delivery.results.find((r) => r.label === CLI_TSV_WASM_LABEL);
		assert(wasm, 'delivery scenario has no tsv-wasm row');
		for (const label of ['prettier', 'prettier + oxc-parser']) {
			const js = single.results.find((r) => r.label === label);
			assert(js, `large-single-file has no ${label} row`);
			assert.isBelow(wasm.wall_ms, js.wall_ms, `tsv-wasm vs ${label}`);
		}
	});

	test("the conformance note on oxc-parser's two bindings reads the report", () => {
		// "its wasm binding is pinned to an older release ... and the two accept sets
		// differ by a couple of files" — both halves are facts about the copied report,
		// and either can go stale on a refresh: the bindings re-aligning makes the note
		// a fiction, a wider gap makes "a couple" an understatement.
		const { versions, entries } = benchmarks_conformance_json;
		assert.isDefined(versions.oxc_parser_wasm);
		assert.notStrictEqual(versions.oxc_parser_wasm, versions.oxc_parser, 'bindings re-aligned');
		const processed = (name: string) => {
			const entry = entries.find((e) => e.group === 'parse/typescript' && e.name === name);
			assert(entry?.files_processed != null, `${name} coverage`);
			return entry.files_processed;
		};
		const gap = Math.abs(processed('oxc-parser') - processed('oxc-parser-wasm'));
		assert.isAtLeast(gap, 1, 'the accept sets agree — the note claims they differ');
		assert.isAtMost(gap, 5, 'the accept sets differ by more than "a couple of files"');
	});

	test('the corpus repos the TLDR names are present', () => {
		// "including Svelte's official repos (svelte, kit, svelte.dev) and the
		// fuz.dev repos" — gate the names so the sentence can't outlive the corpus
		const slugs = new Set(
			(benchmarks_json.corpus_sources ?? []).map((s) => s.repo?.slug).filter(Boolean)
		);
		for (const slug of ['sveltejs/svelte', 'sveltejs/kit', 'sveltejs/svelte.dev']) {
			assert.ok(slugs.has(slug), `TLDR names ${slug} but the corpus lacks it`);
		}
		assert.ok(
			[...slugs].some((slug) => slug?.startsWith('fuzdev/')),
			'TLDR names the fuz.dev repos but the corpus has none'
		);
	});

	test('approximate formatting drops digits as the ratio grows', () => {
		assert.strictEqual(format_ratio_approx(1.66), '1.7x');
		assert.strictEqual(format_ratio_approx(26.241), '26x');
		assert.strictEqual(format_ratio_approx(undefined), '—');
		// floored at both ends so the claim never overstates either bound
		assert.strictEqual(format_ratio_range(3.001, 9.89), '3–9x');
		// the approx variant brackets instead (floor min, ceil max), for ranges
		// flooring both would collapse — the stated range always contains the truth
		assert.strictEqual(format_ratio_range_approx(4.48, 4.86), '4–5x');
		// floor keeps the "at least" end honest where nearest-integer would inflate it
		assert.strictEqual(format_ratio_range_approx(4.6, 4.86), '4–5x');
		assert.strictEqual(format_ratio_range_approx(3.001, 9.89), '3–10x');
	});
});

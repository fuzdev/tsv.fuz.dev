import { assert, describe, test } from 'vitest';

import { benchmarks_json } from '$routes/docs/benchmarks/benchmarks.ts';
import { benchmarks_cross_runtime_json } from '$routes/docs/benchmarks/benchmarks_cross_runtime.ts';
import { benchmarks_conformance_json } from '$routes/docs/benchmarks/benchmarks_conformance.ts';
import { benchmarks_formatters_json } from '$routes/docs/benchmarks/benchmarks_formatters.ts';
import {
	benchmarks_cli,
	cli_comparison_results,
	cli_memory_ratio_range,
	cli_scenario_find,
	cli_speedup_vs_tsv,
	cli_speedup_vs_tsv_npm,
	cli_tsv_npm_memory_mb,
	CLI_DELIVERY_KEY,
	CLI_SINGLE_FILE_KEY,
	CLI_SVELTE_KEY,
	CLI_TS_REPO_KEY,
	CLI_TSV_NPM_LABEL,
	CLI_TSV_WASM_LABEL
} from '$routes/docs/benchmarks/benchmarks_cli.ts';
import { derive_unstable_cells } from '$routes/docs/benchmarks/benchmark_cross_runtime.ts';
import { benchmark_speedup, is_entry_unstable } from '$routes/docs/benchmarks/benchmark_data.ts';

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
		['parse/typescript', 'tsv-wasm-json-no-locations', 'yuku-parser-wasm'],
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
		// the row was measured) publishes a mean that may sit between two modes, so a
		// headline ratio through it is not the median ratio. Re-run the runtime
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

	test('the cross-runtime unstable disclosure names only rows the tables carry', () => {
		// the disclosure can't point at a row or runtime a reader can't find
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
		// (the TypeScript-repo wall/CPU pairs are covered by the CPU-work test below)
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

	test('the like-for-like dispatcher claims read the way the numbers run', () => {
		// The TLDR and the CLI note lead with tsv through its npm dispatcher against the
		// other tools' npm bins: "~Nx faster than Oxfmt and ~Mx faster than Biome ...
		// using A–Bx less memory than either". They render only once the report carries
		// the dispatcher row in both comparison scenarios, so an older report resolves
		// none of them and gates nothing; a partial set would print a sentence with a
		// hole in it, so it is all or none.
		// TODO: require them once the committed report carries the dispatcher row.
		const ratios = [CLI_SINGLE_FILE_KEY, CLI_TS_REPO_KEY].flatMap((key) =>
			['oxfmt', 'biome'].map(
				(label) => [`${key}: ${label}`, cli_speedup_vs_tsv_npm(key, label, 'wall_ms')] as const
			)
		);
		const memory = cli_memory_ratio_range(CLI_TS_REPO_KEY, ['oxfmt', 'biome'], CLI_TSV_NPM_LABEL);
		const resolved = ratios.filter(([, ratio]) => ratio !== undefined);
		assert.include(
			[0, ratios.length],
			resolved.length,
			'the dispatcher row is in some scenarios only'
		);
		assert.strictEqual(memory !== undefined, resolved.length > 0, 'wall ratios without memory');
		for (const [name, ratio] of resolved) {
			assert.isAbove(ratio!, 1, name);
		}
		// the range is floored for display, so "less memory" needs its low end to reach 2
		if (memory) assert.isAtLeast(memory.min, 2);
		// "~Nx on the TypeScript repo": the dispatcher's own cost there, which the
		// delivery note says shrinks against the one-file figure
		const repo_cost = cli_speedup_vs_tsv(CLI_TS_REPO_KEY, CLI_TSV_NPM_LABEL, 'wall_ms');
		if (repo_cost !== undefined) {
			const file_cost = cli_speedup_vs_tsv(CLI_DELIVERY_KEY, CLI_TSV_NPM_LABEL, 'wall_ms');
			assert.isDefined(file_cost);
			assert.isAbove(repo_cost, 1);
			assert.isBelow(repo_cost, file_cost, 'the dispatcher cost does not shrink on the repo');
		}
		// the Svelte bullet's like-for-like pair, when that scenario carries the row
		for (const metric of ['wall_ms', 'memory_mb'] as const) {
			const ratio = cli_speedup_vs_tsv_npm(CLI_SVELTE_KEY, 'rsvelte-fmt', metric);
			if (ratio !== undefined) assert.isAbove(ratio, 1, `${CLI_SVELTE_KEY}: ${metric}`);
		}
	});

	test('the dispatcher\'s peak memory is "still below every other tool\'s"', () => {
		const peak = cli_tsv_npm_memory_mb();
		if (peak === undefined) return; // a report from before the row joined these scenarios
		for (const scenario of benchmarks_cli.scenarios.filter((s) => !s.tsv_only)) {
			for (const r of cli_comparison_results(scenario)) {
				if (r.memory_mb === null) continue;
				assert.isBelow(peak, r.memory_mb, `${scenario.key}: ${r.label}`);
			}
		}
	});

	test('the CLI CPU-work note reads the way the numbers run', () => {
		// "the CPU column narrows tsv's lead: ~Nx faster in wall-clock but ~Mx in CPU
		// work ... part of each wall-clock margin is tsv spreading its work across more
		// cores" — that holds only while each wall ratio EXCEEDS its CPU ratio. Either
		// inequality flipping on a refresh leaves the sentence explaining the opposite
		// of what the table shows, so both are pinned in the direction the copy reads.
		const ratio = (label: string, metric: 'wall_ms' | 'cpu_ms') => {
			const value = cli_speedup_vs_tsv(CLI_TS_REPO_KEY, label, metric);
			assert.isDefined(value, `${CLI_TS_REPO_KEY}: ${label} ${metric}`);
			return value;
		};
		for (const label of ['oxfmt', 'biome']) {
			assert.isAbove(
				ratio(label, 'wall_ms'),
				ratio(label, 'cpu_ms'),
				`${label}: wall lead > CPU lead`
			);
		}
	});

	test('the CPU-work column counts system time, as the note says', () => {
		// "hyperfine's user plus system time" — a refresh that drops either half
		// would relabel a different metric under the same heading
		const scenario = benchmarks_formatters_json.scenarios.find((s) => s.id === CLI_TS_REPO_KEY);
		assert(scenario, `no generated scenario has id "${CLI_TS_REPO_KEY}"`);
		const tsv = scenario.timings.find((t) => t.name === 'tsv');
		assert(tsv);
		assert.isAbove(tsv.system_ms, 0);
		assert.closeTo(
			cli_scenario_find(CLI_TS_REPO_KEY)!.results.find((r) => r.label === 'tsv')!.cpu_ms,
			tsv.user_ms + tsv.system_ms,
			1e-9
		);
	});

	test('the unscoped memory range spans only the scenarios that face other tools', () => {
		// "less than every other tool in every scenario it faces them" — the tsv-only
		// delivery rows are tsv's own distributions and must not widen or narrow it
		const delivery = benchmarks_cli.scenarios.find((s) => s.key === CLI_DELIVERY_KEY);
		assert(delivery, `no generated scenario has id "${CLI_DELIVERY_KEY}"`);
		assert.isTrue(delivery.tsv_only);
		for (const r of delivery.results) {
			assert.ok(r.label.startsWith('tsv'), `${CLI_DELIVERY_KEY} carries a non-tsv row: ${r.label}`);
		}
		const competitor_keys = benchmarks_cli.scenarios.filter((s) => !s.tsv_only).map((s) => s.key);
		assert.isNotEmpty(competitor_keys);
		const ranges = competitor_keys
			.map((key) => cli_memory_ratio_range(key))
			.filter((r) => r !== undefined);
		const expected = {
			min: Math.min(...ranges.map((r) => r.min)),
			max: Math.max(...ranges.map((r) => r.max))
		};
		assert.deepStrictEqual(cli_memory_ratio_range(), expected);
		// and the delivery scenario, named explicitly, still spans on its own
		assert.isDefined(cli_memory_ratio_range(CLI_DELIVERY_KEY));
	});

	test('the WASM delivery row is "still ahead of the JS formatters above"', () => {
		// the delivery and large-single-file scenarios time the same parser.ts, so
		// the note's ordering claim is checkable across them
		const delivery = benchmarks_cli.scenarios.find((s) => s.key === CLI_DELIVERY_KEY);
		const single = benchmarks_cli.scenarios.find((s) => s.key === CLI_SINGLE_FILE_KEY);
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
});

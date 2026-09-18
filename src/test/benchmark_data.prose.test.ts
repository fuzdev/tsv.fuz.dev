import { assert, describe, test } from 'vitest';

import { benchmarks_json } from '$routes/docs/benchmarks/benchmarks.ts';
import { benchmarks_cross_runtime_json } from '$routes/docs/benchmarks/benchmarks_cross_runtime.ts';
import { benchmarks_conformance_json } from '$routes/docs/benchmarks/benchmarks_conformance.ts';
import { benchmarks_formatters_json } from '$routes/docs/benchmarks/benchmarks_formatters.ts';
import { format_ratio_approx } from '$routes/docs/benchmarks/benchmark_display.ts';
import {
	benchmarks_cli,
	cli_comparison_results,
	cli_label_is_tsv,
	cli_memory_ratio_range,
	cli_scenario_find,
	cli_speedup_vs_tsv,
	cli_speedup_vs_tsv_npm,
	cli_tsv_npm_memory_mb,
	cli_tsv_npm_overhead_ms_range,
	cli_tsv_npm_overhead_share,
	CLI_DELIVERY_KEY,
	CLI_SCENARIO_KEYS,
	CLI_SINGLE_FILE_KEY,
	CLI_SVELTE_KEY,
	CLI_TS_REPO_KEY,
	CLI_TSV_NPM_LABEL,
	CLI_TSV_WASM_LABEL
} from '$routes/docs/benchmarks/benchmarks_cli.ts';
import { derive_unstable_cells } from '$routes/docs/benchmarks/benchmark_cross_runtime.ts';
import {
	benchmark_speedup,
	CONFORMANCE_SOURCE_PATHS,
	derive_benchmark_groups,
	derive_conformance_slice,
	is_entry_unstable
} from '$routes/docs/benchmarks/benchmark_data.ts';

// The page's prose quotes ratios computed from the reports rather than
// hand-written numbers, so a renamed entry or a dropped scenario would render
// `—` mid-sentence instead of failing. These gate every pair the copy names.
/**
 * A ratio rendered inside a "~Nx faster than" sentence must clear 1 by enough
 * to print as one: `format_ratio_approx` rounds to one decimal, so a ratio in
 * `[1, 1.05)` passes an `isAbove(1)` gate and still renders "~1.0x faster", a
 * claim of nothing.
 */
const assert_reads_faster = (ratio: number, label: string): void => {
	assert.isAbove(ratio, 1, label);
	assert.notStrictEqual(format_ratio_approx(ratio), '1.0x', `${label} renders as ~1.0x`);
};

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
		// "tsv's default AST ... lands behind" Oxc — a composite of the two pairs above
		// it, true only while the loc cost outruns tsv's span-only lead, so it is gated
		// as its own pair in the direction the sentence reads
		['parse/typescript', 'tsv-json', 'oxc-parser'],
		// "(and behind swc's ...)" — the same composite, against swc's span-only AST
		['parse/typescript', 'tsv-json', 'swc'],
		['parse/svelte', 'svelte/compiler', 'tsv-json'],
		['parse/svelte', 'rsvelte-parse', 'tsv-json'],
		['parse/css', 'tsv-json', 'svelte/compiler'],
		['parse/css', 'tsv-json', 'postcss']
	];

	test('every in-process pair the TLDR quotes is present and runs the way the sentence reads', () => {
		for (const [group, slower, faster] of IN_PROCESS_PAIRS) {
			const ratio = benchmark_speedup(benchmarks_json, group, slower, faster);
			assert.isDefined(ratio, `${group}: ${slower} vs ${faster}`);
			assert_reads_faster(ratio, `${group}: ${slower} vs ${faster}`);
		}
	});

	test('the "faster than Prettier" summary really divides by the prettier row', () => {
		// `BenchmarksSummary` hard-codes "faster than Prettier" while a group's
		// canonical entry is whichever canonical-category row sorts first, so a format
		// group that grew another canonical row would silently re-baseline the table
		for (const group of derive_benchmark_groups(benchmarks_json)) {
			if (group.operation !== 'format') continue;
			assert.strictEqual(group.canonical_entry?.name, 'prettier', group.language);
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
		// "less" and both are floored to one decimal for display, so the LOW end must
		// reach 1.1 or the range would print "1.0–Nx less memory", a claim of nothing
		for (const range of [
			cli_memory_ratio_range(CLI_TS_REPO_KEY, ['oxfmt', 'biome']),
			cli_memory_ratio_range(),
			cli_memory_ratio_range(undefined, undefined, CLI_TSV_NPM_LABEL)
		]) {
			assert.isDefined(range);
			assert.isAtLeast(range.min, 1.1);
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
		// using A–Bx less memory than either". The copy has no bare-binary fallback, so
		// every one must resolve or a sentence prints with a hole in it.
		for (const key of [CLI_SINGLE_FILE_KEY, CLI_TS_REPO_KEY]) {
			for (const label of ['oxfmt', 'biome']) {
				const ratio = cli_speedup_vs_tsv_npm(key, label, 'wall_ms');
				assert.isDefined(ratio, `${key}: ${label}`);
				assert_reads_faster(ratio, `${key}: ${label}`);
			}
		}
		const memory = cli_memory_ratio_range(CLI_TS_REPO_KEY, ['oxfmt', 'biome'], CLI_TSV_NPM_LABEL);
		assert.isDefined(memory);
		// floored to one decimal for display, so "less memory" needs its low end to reach 1.1
		assert.isAtLeast(memory.min, 1.1);
		// "~Nx on the TypeScript repo": the dispatcher's own cost there, which the
		// delivery note says shrinks against the one-file figure
		const repo_cost = cli_speedup_vs_tsv(CLI_TS_REPO_KEY, CLI_TSV_NPM_LABEL, 'wall_ms');
		const file_cost = cli_speedup_vs_tsv(CLI_DELIVERY_KEY, CLI_TSV_NPM_LABEL, 'wall_ms');
		assert.isDefined(repo_cost);
		assert.isDefined(file_cost);
		assert.isAbove(repo_cost, 1);
		assert.isBelow(repo_cost, file_cost, 'the dispatcher cost does not shrink on the repo');
		// the Svelte bullet's like-for-like pair: that scenario may be published
		// aborted, but the copy quotes the dispatcher ratio wherever it quotes the
		// bare-binary one, so the two must resolve together
		for (const metric of ['wall_ms', 'memory_mb'] as const) {
			const ratio = cli_speedup_vs_tsv_npm(CLI_SVELTE_KEY, 'rsvelte-fmt', metric);
			const bare = cli_speedup_vs_tsv(CLI_SVELTE_KEY, 'rsvelte-fmt', metric);
			assert.strictEqual(ratio !== undefined, bare !== undefined, `${CLI_SVELTE_KEY}: ${metric}`);
			if (ratio !== undefined) assert.isAbove(ratio, 1, `${CLI_SVELTE_KEY}: ${metric}`);
		}
	});

	test("the dispatcher row's peak RSS is \"its Node launcher's, not the binary's\"", () => {
		// the harness reports the largest single process in the tree, so the note under
		// each table holds only while the launcher outgrows the binary it spawns
		for (const scenario of benchmarks_cli.scenarios) {
			const npm = scenario.results.find((r) => r.label === CLI_TSV_NPM_LABEL);
			const tsv = scenario.results.find((r) => r.label === 'tsv');
			if (npm?.memory_mb == null || tsv?.memory_mb == null) continue;
			assert.isAbove(npm.memory_mb, tsv.memory_mb, scenario.key);
		}
	});

	test('the dispatcher\'s peak memory is "still below every other tool\'s"', () => {
		const peak = cli_tsv_npm_memory_mb();
		assert.isDefined(peak);
		for (const scenario of benchmarks_cli.scenarios.filter((s) => !s.tsv_only)) {
			for (const r of cli_comparison_results(scenario)) {
				// "every other tool in every scenario": the unscoped memory range skips a
				// row without a figure, so a missed memory pass would narrow the claim
				// silently rather than void it — every competitor row must carry one
				assert.isNotNull(r.memory_mb, `${scenario.key}: ${r.label} has no memory figure`);
				assert.isBelow(peak, r.memory_mb, `${scenario.key}: ${r.label}`);
			}
		}
	});

	test('the CLI CPU-work note reads the way the numbers run', () => {
		// "read like for like, against the dispatcher row, it widens tsv's lead: ~Nx
		// faster in wall-clock and ~Mx in CPU work ... Against the bare binary it
		// narrows instead" — two inequalities per tool, in opposite directions. Either
		// one flipping on a refresh leaves the note explaining the opposite of what the
		// table shows, so both are pinned the way the copy reads.
		const defined = (value: number | undefined, name: string): number => {
			assert.isDefined(value, `${CLI_TS_REPO_KEY}: ${name}`);
			return value;
		};
		for (const label of ['oxfmt', 'biome']) {
			const npm = (metric: 'wall_ms' | 'cpu_ms') =>
				defined(cli_speedup_vs_tsv_npm(CLI_TS_REPO_KEY, label, metric), `${label} ${metric}`);
			const bare = (metric: 'wall_ms' | 'cpu_ms') =>
				defined(cli_speedup_vs_tsv(CLI_TS_REPO_KEY, label, metric), `${label} ${metric}`);
			assert.isAbove(
				npm('cpu_ms'),
				npm('wall_ms'),
				`${label}: like for like, CPU lead > wall lead`
			);
			assert.isAbove(
				bare('wall_ms'),
				bare('cpu_ms'),
				`${label}: bare binary, wall lead > CPU lead`
			);
			// every one of the four renders inside a "~Nx faster than" sentence, and
			// `format_ratio_approx` is direction-blind, so each must also clear 1 — the
			// wall-clock dispatcher ratio is gated above, the other three here
			for (const [ratio, name] of [
				[npm('cpu_ms'), 'dispatcher cpu_ms'],
				[bare('wall_ms'), 'bare wall_ms'],
				[bare('cpu_ms'), 'bare cpu_ms']
			] as const) {
				assert_reads_faster(ratio, `${label}: ${name}`);
			}
		}
		// "which is Node's startup rather than the engines ... a large share of a
		// parallel run's wall-clock and a small share of its CPU total": the dispatcher
		// must cost the repo run relatively more wall-clock than CPU work
		const npm_wall = defined(
			cli_speedup_vs_tsv(CLI_TS_REPO_KEY, CLI_TSV_NPM_LABEL, 'wall_ms'),
			'dispatcher wall_ms'
		);
		const npm_cpu = defined(
			cli_speedup_vs_tsv(CLI_TS_REPO_KEY, CLI_TSV_NPM_LABEL, 'cpu_ms'),
			'dispatcher cpu_ms'
		);
		assert.isAbove(npm_wall, npm_cpu);
		// "even Prettier's CPU time runs above its wall-clock"
		for (const key of [CLI_SINGLE_FILE_KEY, CLI_TS_REPO_KEY]) {
			const prettier = cli_scenario_find(key)?.results.find((r) => r.label === 'prettier');
			assert(prettier, `${key} has no prettier row`);
			assert.isAbove(prettier.cpu_ms, prettier.wall_ms, `${key}: prettier CPU > wall`);
		}
	});

	test('the dispatcher overhead reads as a share of wall-clock far above its share of CPU', () => {
		// "~N% of its wall-clock on the repo but ~M% of its CPU total": the note's point
		// is the asymmetry, so the wall share must clearly exceed the CPU share, and
		// both must be shares — inside (0, 1) — or the sentence prints nonsense
		const share = cli_tsv_npm_overhead_share(CLI_TS_REPO_KEY);
		assert.isDefined(share);
		assert.isAbove(share.wall, 0);
		assert.isBelow(share.wall, 1);
		assert.isAbove(share.cpu, 0);
		assert.isAbove(share.wall, share.cpu * 2, 'the wall-clock share is not clearly larger');
	});

	test('the dispatcher overhead is the "fixed cost" the delivery note calls it', () => {
		// "a fixed cost of ~A–B ms in every scenario here, so its share shrinks against
		// a real repo" — fixed means the absolute figure barely moves between a one-file
		// run and a repo, so the span must stay tight around a positive cost
		const overhead = cli_tsv_npm_overhead_ms_range();
		assert.isDefined(overhead);
		assert.isAbove(overhead.min, 0);
		assert.isAtMost(overhead.max, overhead.min * 1.25, 'the dispatcher cost is not fixed');
	});

	test('the scenario descriptions state facts the report carries', () => {
		// the delivery copy: "the WASM row's CPU time exceeds its wall-clock"
		const wasm = cli_scenario_find(CLI_DELIVERY_KEY)?.results.find(
			(r) => r.label === CLI_TSV_WASM_LABEL
		);
		assert(wasm, 'delivery scenario has no tsv-wasm row');
		assert.isAbove(wasm.cpu_ms, wasm.wall_ms);
		// the Svelte copy: "rsvelte-fmt 0.7.x’s check mode crashes nondeterministically on this corpus"
		const rsvelte_version = benchmarks_cli.versions['rsvelte-fmt'];
		assert.isDefined(rsvelte_version);
		assert.match(rsvelte_version, /^0\.7\./, 'the Svelte copy names rsvelte-fmt 0.7.x');
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
			assert.ok(cli_label_is_tsv(r.label), `${CLI_DELIVERY_KEY} carries a non-tsv row: ${r.label}`);
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

	test('the WASM delivery row is "ahead of both Prettier rows … and behind Oxfmt and Biome"', () => {
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
		// the sentence concedes the native-engine rows, so that half must hold too
		for (const label of ['oxfmt', 'biome']) {
			const native = single.results.find((r) => r.label === label);
			assert(native, `large-single-file has no ${label} row`);
			assert.isAbove(wasm.wall_ms, native.wall_ms, `tsv-wasm vs ${label}`);
		}
	});

	test('the run-order note holds: every scenario runs the dispatcher row, then bare tsv, last', () => {
		// "Every scenario here puts the bare tsv binary last, with its npm dispatcher
		// row just before it" — hyperfine reports commands in the order it ran them,
		// and the generated timings keep that order. An aborted scenario has no timings
		// to order, so its preflight rows, which the harness runs in the same order, stand in.
		for (const key of CLI_SCENARIO_KEYS) {
			const scenario = benchmarks_formatters_json.scenarios.find((s) => s.id === key);
			assert(scenario, `no generated scenario has id "${key}"`);
			const rows = scenario.timings.length ? scenario.timings : scenario.preflight;
			assert.deepStrictEqual(
				rows.slice(-2).map((r) => r.name),
				['tsv-npm', 'tsv'],
				key
			);
		}
	});

	test('the TypeScript conformance slices the note reads by name are present', () => {
		// "~N% of it is the test262 slice and ~M% the TypeScript compiler's ... on
		// Prettier's third-party JS suite tsv accepts A, oxc-parser B, yuku-parser C,
		// and tsc D" — every slice and every engine named must resolve, and the two
		// self-selected slices must still be most of the aggregate for "mostly" to hold
		const slice = (path: string) =>
			derive_conformance_slice(benchmarks_conformance_json, 'parse/typescript', path);
		const test262 = slice(CONFORMANCE_SOURCE_PATHS.test262);
		const ts_repo = slice(CONFORMANCE_SOURCE_PATHS.ts_repo);
		const prettier_js = slice(CONFORMANCE_SOURCE_PATHS.prettier_js);
		assert(test262 && ts_repo && prettier_js, 'a named conformance source is missing');
		assert.isAbove(test262.share + ts_repo.share, 0.5, 'the self-selected slices are not "mostly"');
		for (const engine of ['tsv', 'oxc-parser', 'yuku-parser', 'tsc']) {
			assert.isDefined(prettier_js.rows[engine], `${engine} on Prettier's JS suite`);
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

	test('Prettier "is one of the rows that stop" at the sweep floor, as Benchmarking details says', () => {
		// the disclosure that the headline denominator runs at the bench's per-row floor:
		// each Prettier format row's raw timing count must be exactly its floor
		const prettier_rows = benchmarks_json.entries.filter(
			(e) => e.name === 'prettier' && e.group.startsWith('format/')
		);
		assert.isNotEmpty(prettier_rows);
		for (const entry of prettier_rows) {
			assert.isDefined(entry.min_iterations, entry.group);
			assert.strictEqual(entry.raw_sample_size, entry.min_iterations, `${entry.group}/prettier`);
		}
	});

	test('the corpus repos the TLDR names are present', () => {
		// "Svelte's own repos (svelte, kit, svelte.dev), the fuz.dev repos, and a few
		// of the author's personal SvelteKit sites" — gate the names so the sentence
		// can't outlive the corpus
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

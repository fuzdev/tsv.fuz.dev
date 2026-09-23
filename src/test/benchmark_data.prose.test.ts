import { assert, describe, test } from 'vitest';

import { benchmarks_json } from '$routes/docs/benchmarks/benchmarks.ts';
import { benchmarks_cross_runtime_json } from '$routes/docs/benchmarks/benchmarks_cross_runtime.ts';
import { benchmarks_formatters_json } from '$routes/docs/benchmarks/benchmarks_formatters.ts';
import { format_ratio_approx } from '$routes/docs/benchmarks/benchmark_display.ts';
import {
	benchmarks_cli,
	cli_comparison_results,
	cli_label_is_tsv,
	cli_memory_ratio_range,
	cli_scenario_find,
	cli_ratio_vs_tsv,
	cli_ratio_vs_tsv_npm,
	cli_tsv_npm_overhead_ms_range,
	cli_node_startup_ms,
	CLI_DELIVERY_KEY,
	CLI_SCENARIO_KEYS,
	CLI_SINGLE_FILE_KEY,
	CLI_SVELTE_KEY,
	CLI_TS_REPO_KEY,
	CLI_TSV_NPM_LABEL,
	CLI_TSV_WASM_LABEL
} from '$routes/docs/benchmarks/benchmarks_cli.ts';
import { derive_unstable_cells } from '$routes/docs/benchmarks/benchmark_cross_runtime.ts';
import { IN_PROCESS_PAIRS as IN_PROCESS_PAIRS_BY_KEY } from '$routes/docs/benchmarks/benchmarks_prose.ts';
import {
	benchmark_speedup,
	categorize_name,
	derive_benchmark_groups,
	derive_corpus_counts,
	derive_sweep_stats,
	is_entry_unstable,
	is_payload_matched
} from '$routes/docs/benchmarks/benchmark_data.ts';

// The page's prose quotes ratios computed from the reports rather than
// hand-written numbers, so a renamed entry or a dropped scenario would render
// `—` mid-sentence instead of failing. These gate every pair the copy names.
/**
 * A ratio rendered inside a "~Nx faster than" (or "as long", "the memory") sentence
 * must clear 1 by enough to print as one: `format_ratio_approx` rounds to one decimal, so a ratio in
 * `[1, 1.05)` passes an `isAbove(1)` gate and still renders "~1.0x faster", a
 * claim of nothing.
 */
const assert_reads_faster = (ratio: number, label: string): void => {
	assert.isAbove(ratio, 1, label);
	assert.notStrictEqual(format_ratio_approx(ratio), '1.0x', `${label} renders as ~1.0x`);
};

/** The report's format groups, asserted non-empty so a loop over them can't pass on nothing. */
const format_groups = () => {
	const groups = derive_benchmark_groups(benchmarks_json).filter((g) => g.operation === 'format');
	assert.isNotEmpty(groups);
	return groups;
};

describe('prose ratios resolve', () => {
	// The copy says "X faster than" for the pairs tsv leads and "slower than" / "Y is
	// faster than tsv" for the ones it trails (yuku on TypeScript, the JS parsers on
	// CSS), so every ratio here must land above 1 or the sentence has flipped. The
	// table is the page's own, so a pairing added to the copy is gated by construction.
	const IN_PROCESS_PAIRS = Object.values(IN_PROCESS_PAIRS_BY_KEY);

	test('every in-process pair the TLDR quotes is present and runs the way the sentence reads', () => {
		for (const [group, slower, faster] of IN_PROCESS_PAIRS) {
			const ratio = benchmark_speedup(benchmarks_json, group, slower, faster);
			assert.isDefined(ratio, `${group}: ${slower} vs ${faster}`);
			assert_reads_faster(ratio, `${group}: ${slower} vs ${faster}`);
		}
	});

	test('tsv "formats its three languages faster in every pairing measured here"', () => {
		// The TLDR's absolute claim spans every timed format row, not just the pairs
		// it quotes: dprint and malva are timed too. Like for like is native-vs-native
		// and wasm-vs-wasm, and the JS rows face native tsv; gating tsv-wasm, tsv's
		// slower build, against every non-tsv row is the stronger check and holds
		for (const group of format_groups()) {
			// a disabled row is a mirrored placeholder or coverage-only, timed at 0
			const timed = group.entries.filter((e) => !e.disabled && e.mean_ns > 0);
			const tsv_wasm = timed.find((e) => e.name === 'tsv-wasm');
			assert(tsv_wasm, `${group.language}: no timed tsv-wasm row`);
			const others = timed.filter((e) => !e.name.startsWith('tsv'));
			assert.isNotEmpty(others, `${group.language}: nothing to pair against`);
			for (const other of others) {
				assert_reads_faster(other.mean_ns / tsv_wasm.mean_ns, `${group.language}: ${other.name}`);
			}
		}
	});

	test('a group that runs short of the corpus total has a note saying by how much', () => {
		// "a chart that runs short of the corpus total says beneath it what was left
		// out" — the note renders from `omissions`, so the sentence
		// holds exactly when every shortfall is an omission the report carries
		const groups = derive_benchmark_groups(benchmarks_json);
		assert.isNotEmpty(groups);
		for (const group of groups) {
			const key = `${group.operation}/${group.language}`;
			const total = benchmarks_json.corpus[group.language];
			assert.isDefined(total, group.language);
			assert.isNotNull(group.files_iterated, `${key}: no timed-set count`);
			assert.strictEqual(
				total - group.files_iterated,
				group.omissions?.omitted_files ?? 0,
				`${key}: the shortfall the heading shows is not the one the note states`
			);
		}
	});

	test('rsvelte\'s Svelte target is "a release apart" from the svelte/compiler row\'s', () => {
		// the parse note prints that sentence whenever the two differ, so the gap must
		// stay one minor release at most or the copy understates it
		const { svelte, rsvelte_parse_svelte_target } = benchmarks_json.versions;
		assert.isString(svelte);
		if (!rsvelte_parse_svelte_target || rsvelte_parse_svelte_target === svelte) return;
		const minor_of = (version: string): number => {
			const match = /^(\d+)\.(\d+)\./.exec(version);
			assert(match, `${version} is not a semver`);
			return Number(match[1]) * 1000 + Number(match[2]);
		};
		assert.isAtMost(
			Math.abs(minor_of(rsvelte_parse_svelte_target) - minor_of(svelte)),
			1,
			'more than one minor release apart'
		);
	});

	test('oxfmt formats Svelte at Prettier speed, as the note says it delegates', () => {
		// "delegates Svelte to a Prettier it bundles", which the TLDR leans on to quote
		// only Prettier for Svelte — if a future oxfmt grows its own Svelte path the
		// two rows will part ways and both are stale
		const ratio = benchmark_speedup(benchmarks_json, 'format/svelte', 'oxfmt', 'prettier');
		assert.isDefined(ratio);
		assert.closeTo(ratio, 1, 0.1, 'oxfmt and prettier should be within 10% on format/svelte');
	});

	test('the CSS parse note reads the internal rows it points at', () => {
		// "the JSON hand-off is ~N% of tsv's time there (the gap to the internal row)",
		// offered as why the JS parsers finish ahead — the wire must cost more than the
		// engine, or the explanation is wrong
		const wire_share = benchmark_speedup(benchmarks_json, 'parse/css', 'tsv-json', 'tsv-internal');
		assert.isDefined(wire_share);
		assert.isAbove(wire_share, 2, 'tsv-json should cost at least twice tsv-internal on CSS');
	});

	test('every in-process pair the TLDR quotes was measured stably', () => {
		// a headline ratio divides two means, and an unstable row's mean may sit between
		// two modes (see `is_entry_unstable`) — re-run the runtime
		// (`deno task bench:node:run && deno task bench:compose`) and re-publish
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

	test('the pairings the copy calls payload-matched are, and the ones it excludes are not', () => {
		// The page names four pairings as comparing the same PRODUCT and rules three out
		// ("swc's AST ... matches neither tsv wire", and the `no-locs` entries, not the
		// default wire, "are the payload-matched comparison with oxc-parser"). Those are claims about
		// the report's `payload` tiers, so read them off it rather than trusting prose.
		const entry = (group: string, name: string) => {
			const found = benchmarks_json.entries.find((e) => e.group === group && e.name === name);
			assert(found, `${group}/${name} is missing`);
			return found;
		};
		const matched = (group: string, a: string, b: string) =>
			is_payload_matched(entry(group, a), entry(group, b));

		for (const [group, a, b] of [
			['parse/typescript', 'tsv-json-no-locations', 'oxc-parser'],
			['parse/typescript', 'tsv-json-no-locations', 'yuku-parser'],
			['parse/typescript', 'tsv-wasm-json-no-locations', 'yuku-parser-wasm'],
			['parse/svelte', 'tsv-json', 'rsvelte-parse']
		] as const) {
			assert.isTrue(matched(group, a, b), `${group}: ${a} vs ${b} is no longer payload-matched`);
		}

		for (const [group, a, b] of [
			// swc's own AST shape, ruled out against both wires
			['parse/typescript', 'tsv-json', 'swc'],
			['parse/typescript', 'tsv-json-no-locations', 'swc'],
			// oxc against tsv's default wire — the pairing the copy says is NOT the matched one
			['parse/typescript', 'tsv-json', 'oxc-parser'],
			// rsvelte's reduced wire "sits near tsv's span-only wire without matching it"
			['parse/svelte', 'tsv-json-no-locations', 'rsvelte-parse-skip-expr-loc']
		] as const) {
			assert.isFalse(matched(group, a, b), `${group}: ${a} vs ${b} is now payload-matched`);
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
		// the CLI note's "less than every other tool in every scenario", against the bare
		// binary and the dispatcher — both read as "less" and both are floored to one
		// decimal for display, so the LOW end must reach 1.1 or the range would print
		// "1.0–Nx less memory", a claim of nothing
		for (const range of [
			cli_memory_ratio_range(),
			cli_memory_ratio_range({ baseline_label: CLI_TSV_NPM_LABEL })
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
			const ratio = cli_ratio_vs_tsv(CLI_DELIVERY_KEY, label, metric);
			assert.isDefined(ratio, `${CLI_DELIVERY_KEY}: ${label} ${metric}`);
			// the copy reads "takes ~Nx as long" / "~Nx the memory", so each must exceed 1
			assert_reads_faster(ratio, `${CLI_DELIVERY_KEY}: ${label} ${metric}`);
		}
	});

	test('the like-for-like dispatcher claims read the way the numbers run', () => {
		// The TLDR and the CLI note lead with tsv through its Node dispatcher against the
		// other tools' npm bins: "~Nx faster than Oxfmt and ~Mx faster than Biome ...
		// using less memory than either". The copy has no bare-binary fallback, so
		// every one must resolve or a sentence prints with a hole in it.
		for (const label of ['oxfmt', 'biome']) {
			const ratio = cli_ratio_vs_tsv_npm(CLI_TS_REPO_KEY, label, 'wall_ms');
			assert.isDefined(ratio, `${CLI_TS_REPO_KEY}: ${label}`);
			assert_reads_faster(ratio, `${CLI_TS_REPO_KEY}: ${label}`);
		}
		const memory = cli_memory_ratio_range({
			scenario_key: CLI_TS_REPO_KEY,
			labels: ['oxfmt', 'biome'],
			baseline_label: CLI_TSV_NPM_LABEL
		});
		assert.isDefined(memory);
		assert.isAbove(memory.min, 1);
		// "~Nx the binary's time on the delivery table's one file, but ~Mx on the
		// TypeScript repo": the dispatcher's own cost must shrink on the repo
		const repo_cost = cli_ratio_vs_tsv(CLI_TS_REPO_KEY, CLI_TSV_NPM_LABEL, 'wall_ms');
		const file_cost = cli_ratio_vs_tsv(CLI_DELIVERY_KEY, CLI_TSV_NPM_LABEL, 'wall_ms');
		assert.isDefined(repo_cost);
		assert.isDefined(file_cost);
		assert_reads_faster(repo_cost, `${CLI_TS_REPO_KEY}: dispatcher cost`);
		assert.isBelow(repo_cost, file_cost, 'the dispatcher cost does not shrink on the repo');
		// the Svelte bullet's like-for-like pair: that scenario may be published
		// aborted, but the copy quotes the dispatcher ratio wherever it quotes the
		// bare-binary one, so the two must resolve together
		for (const metric of ['wall_ms', 'memory_mb'] as const) {
			const ratio = cli_ratio_vs_tsv_npm(CLI_SVELTE_KEY, 'rsvelte-fmt', metric);
			const bare = cli_ratio_vs_tsv(CLI_SVELTE_KEY, 'rsvelte-fmt', metric);
			assert.strictEqual(ratio !== undefined, bare !== undefined, `${CLI_SVELTE_KEY}: ${metric}`);
			if (ratio !== undefined) assert_reads_faster(ratio, `${CLI_SVELTE_KEY}: ${metric}`);
		}
	});

	test('the dispatcher row "reads Node\'s peak, not the binary\'s"', () => {
		// the harness reports the largest single process in the tree, so the memory note
		// holds only while the Node launcher outgrows the binary it spawns
		for (const scenario of benchmarks_cli.scenarios) {
			const npm = scenario.results.find((r) => r.label === CLI_TSV_NPM_LABEL);
			const tsv = scenario.results.find((r) => r.label === 'tsv');
			if (npm?.memory_mb == null || tsv?.memory_mb == null) continue;
			assert.isAbove(npm.memory_mb, tsv.memory_mb, scenario.key);
		}
	});

	test('the memory note\'s "every other tool in every scenario" spans every competitor row', () => {
		// the unscoped memory range skips a row without a figure, so a missed memory
		// pass would narrow the claim silently rather than void it — every competitor
		// row must carry one
		for (const scenario of benchmarks_cli.scenarios.filter((s) => !s.tsv_only)) {
			for (const r of cli_comparison_results(scenario)) {
				assert.isNotNull(r.memory_mb, `${scenario.key}: ${r.label} has no memory figure`);
			}
		}
	});

	test('the CLI CPU-work note reads the way the numbers run', () => {
		// "CPU ratios barely move between tsv's two rows ... where wall-clock swings from
		// ~A to ~B" — the two CPU leads must sit inside the wall-clock span: dispatcher
		// wall < dispatcher CPU <= bare CPU < bare wall. Any one flipping on a refresh
		// leaves the note explaining the opposite of what the table shows.
		const defined = (value: number | undefined, name: string): number => {
			assert.isDefined(value, `${CLI_TS_REPO_KEY}: ${name}`);
			return value;
		};
		for (const label of ['oxfmt']) {
			const npm = (metric: 'wall_ms' | 'cpu_ms') =>
				defined(cli_ratio_vs_tsv_npm(CLI_TS_REPO_KEY, label, metric), `${label} ${metric}`);
			const bare = (metric: 'wall_ms' | 'cpu_ms') =>
				defined(cli_ratio_vs_tsv(CLI_TS_REPO_KEY, label, metric), `${label} ${metric}`);
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
			assert.isAtMost(npm('cpu_ms'), bare('cpu_ms'), `${label}: dispatcher CPU lead > bare`);
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
		// "even Prettier's CPU time runs above its wall-clock"
		for (const key of [CLI_SINGLE_FILE_KEY, CLI_TS_REPO_KEY]) {
			const prettier = cli_scenario_find(key)?.results.find((r) => r.label === 'prettier');
			assert(prettier, `${key} has no prettier row`);
			assert.isAbove(prettier.cpu_ms, prettier.wall_ms, `${key}: prettier CPU > wall`);
		}
	});

	test('the Node launch floor sits inside the dispatcher overhead', () => {
		// "a bare node -e '' takes ~N ms on this machine": Node's startup is one part
		// of what the dispatcher row pays over the bare binary, so it must not exceed
		// that gap — a floor above the overhead would mean the two measure different
		// things (a different node, a different PATH)
		const floor = cli_node_startup_ms();
		const overhead = cli_tsv_npm_overhead_ms_range();
		assert.isDefined(overhead);
		assert.isAbove(floor, 0);
		assert.isBelow(floor, overhead.max);
		// "most of it Node's own startup"
		assert.isAbove(floor, overhead.max / 2);
	});

	test('the dispatcher overhead is the "fixed cost" the delivery note calls it', () => {
		// "tsv's dispatcher adds a fixed ~N ms over the bare binary" — fixed means the
		// absolute figure barely moves between a one-file run and a repo, so the span
		// must stay tight around a positive cost
		const overhead = cli_tsv_npm_overhead_ms_range();
		assert.isDefined(overhead);
		assert.isAbove(overhead.min, 0);
		assert.isAtMost(overhead.max, overhead.min * 1.25, 'the dispatcher cost is not fixed');
	});

	test('the scenario descriptions state facts the report carries', () => {
		// the delivery copy: "the wasm row's CPU ratio runs well past its time ratio"
		const cpu = cli_ratio_vs_tsv(CLI_DELIVERY_KEY, CLI_TSV_WASM_LABEL, 'cpu_ms');
		const wall = cli_ratio_vs_tsv(CLI_DELIVERY_KEY, CLI_TSV_WASM_LABEL, 'wall_ms');
		assert.isDefined(cpu, 'delivery scenario has no tsv-wasm row');
		assert.isDefined(wall);
		assert.isAbove(cpu, wall * 1.5, 'the wasm CPU ratio no longer runs well past its time ratio');
		// the Svelte abort context: "rsvelte-fmt 0.7.x can abort when its output and stderr share a pipe"
		const rsvelte_version = benchmarks_cli.versions['rsvelte-fmt'];
		assert.isDefined(rsvelte_version);
		assert.match(rsvelte_version, /^0\.7\./, 'the Svelte copy names rsvelte-fmt 0.7.x');
	});

	test('the delivery note places the wasm row among the single-file tools', () => {
		// "still well ahead of both Prettier rows there, but behind Oxfmt and Biome" —
		// the delivery and single-file scenarios time the same file (the shape test
		// holds them to one corpus revision), so the wasm row reads against the other
		// tools' single-file times across the two tables
		const wasm = cli_scenario_find(CLI_DELIVERY_KEY)?.results.find(
			(r) => r.label === CLI_TSV_WASM_LABEL
		);
		assert(wasm, `${CLI_DELIVERY_KEY} has no ${CLI_TSV_WASM_LABEL} row`);
		const single = cli_scenario_find(CLI_SINGLE_FILE_KEY);
		assert(single, `no generated scenario has id "${CLI_SINGLE_FILE_KEY}"`);
		const wall = (label: string): number => {
			const row = single.results.find((r) => r.label === label);
			assert(row, `${CLI_SINGLE_FILE_KEY} has no ${label} row`);
			return row.wall_ms;
		};
		for (const label of ['prettier', 'prettier + oxc-parser']) {
			assert.isAbove(
				wall(label),
				wasm.wall_ms * 2,
				`${label}: the wasm row is no longer well ahead`
			);
		}
		for (const label of ['oxfmt', 'biome']) {
			assert.isBelow(wall(label), wasm.wall_ms, `${label}: the wasm row is no longer behind`);
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
			assert.ok(cli_label_is_tsv(r.label), `${CLI_DELIVERY_KEY} carries a non-tsv row: ${r.label}`);
		}
		const competitor_keys = benchmarks_cli.scenarios.filter((s) => !s.tsv_only).map((s) => s.key);
		assert.isNotEmpty(competitor_keys);
		const ranges = competitor_keys
			.map((key) => cli_memory_ratio_range({ scenario_key: key }))
			.filter((r) => r !== undefined);
		const expected = {
			min: Math.min(...ranges.map((r) => r.min)),
			max: Math.max(...ranges.map((r) => r.max))
		};
		assert.deepStrictEqual(cli_memory_ratio_range(), expected);
		// and the delivery scenario, named explicitly, still spans on its own
		assert.isDefined(cli_memory_ratio_range({ scenario_key: CLI_DELIVERY_KEY }));
	});

	test('the wasm delivery row is "ahead of both Prettier rows … and behind Oxfmt and Biome"', () => {
		// the delivery and large-single-file scenarios time the same parser.ts, so
		// the note's ordering claim is checkable across them
		const delivery = benchmarks_cli.scenarios.find((s) => s.key === CLI_DELIVERY_KEY);
		const single = benchmarks_cli.scenarios.find((s) => s.key === CLI_SINGLE_FILE_KEY);
		assert(delivery && single);
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
		// "Every scenario puts the bare binary last, with its Node dispatcher row just
		// before it" — hyperfine reports commands in the order it ran them,
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

	test('the "only parser here besides" notes still describe their groups', () => {
		// "rsvelte's is the only Svelte parser here besides tsv's and the svelte/compiler
		// reference" and "PostCSS is the only CSS parser here besides tsv's and the
		// parseCss reference" — a row added to either group makes its note wrong
		const others = (group: string): Array<string> => [
			...new Set(
				benchmarks_json.entries
					.filter((e) => e.group === group)
					.map((e) => categorize_name(e.name))
					.filter((category) => category !== 'canonical' && !category.startsWith('tsv_'))
			)
		];
		assert.deepStrictEqual(others('parse/svelte'), ['rsvelte']);
		assert.deepStrictEqual(others('parse/css'), ['postcss']);
	});

	test('the corpus figures the Corpus section quotes resolve', () => {
		// the page has no fallback copy for them
		const counts = derive_corpus_counts(benchmarks_json);
		assert.isAbove(counts.harvested_css, 0);
		assert(counts.standalone_css !== undefined);
		assert.isAbove(counts.standalone_css, 0);
	});

	test("the parse note on oxc-parser's wasm row running an older release reads the report", () => {
		// "oxc-parser's wasm row runs an older release than its native row ... so the wasm-vs-wasm
		// pairing crosses oxc versions" — the bindings re-aligning makes the note a fiction
		const { versions } = benchmarks_json;
		assert.isDefined(versions.oxc_parser_wasm);
		assert.notStrictEqual(versions.oxc_parser_wasm, versions.oxc_parser, 'bindings re-aligned');
	});

	test('Prettier sits at the sweep floor, as Benchmarking details says', () => {
		// the disclosure that Prettier, every format chart's default anchor, runs at the bench's per-row floor:
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

	test('the slowest rows have "too few timings" for the cross-runtime noise check', () => {
		// tsv's report composer judges a delta against noise only where both sides kept
		// at least 10 cleaned timings, so the Cross-runtime section's caveat holds while
		// some row here keeps fewer
		const { sample_size_min } = derive_sweep_stats(benchmarks_json);
		assert.isDefined(sample_size_min);
		assert.isBelow(sample_size_min, 10);
	});

	test('the higher sweep floor is "each group\'s reference row"\'s, and only theirs', () => {
		// Benchmarking details quotes the lowest floor for every row and a second one in
		// parentheses for the reference rows, so exactly those rows may sit above it
		const timed = benchmarks_json.entries.filter((e) => e.min_iterations != null);
		const floor = Math.min(...timed.map((e) => e.min_iterations!));
		for (const entry of timed) {
			assert.strictEqual(
				entry.min_iterations! > floor,
				categorize_name(entry.name) === 'canonical',
				`${entry.group}/${entry.name}: floor ${entry.min_iterations}`
			);
		}
	});

	test('the corpus repos the Corpus section names are present', () => {
		// "the fuz.dev ecosystem ... and upstream framework source (Svelte, SvelteKit, and
		// the svelte.dev site)" — gate the names so the sentence can't outlive the corpus
		const slugs = new Set(
			(benchmarks_json.corpus_sources ?? []).map((s) => s.repo?.slug).filter(Boolean)
		);
		for (const slug of ['sveltejs/svelte', 'sveltejs/kit', 'sveltejs/svelte.dev']) {
			assert.ok(slugs.has(slug), `the page names ${slug} but the corpus lacks it`);
		}
		assert.ok(
			[...slugs].some((slug) => slug?.startsWith('fuzdev/')),
			'the page names the fuz.dev repos but the corpus has none'
		);
	});

	test('the corpus is "the author\'s own and Svelte\'s", as the tldr and Corpus section say', () => {
		// every source is one of the author's repos or Svelte's, or the `<style>` harvest
		// drawn from their components, which carries no repo — named by path, so a new
		// repo-less cache has to be checked against the claim before it passes
		const sources = benchmarks_json.corpus_sources ?? [];
		assert.isNotEmpty(sources);
		for (const source of sources) {
			const slug = source.repo?.slug;
			if (!slug) {
				assert.strictEqual(
					source.path,
					'benches/js/.cache/svelte_styles',
					'unknown repo-less source'
				);
				continue;
			}
			assert.match(
				slug,
				/^(fuzdev|ryanatkn|sveltejs)\//,
				`${slug} is neither the author's nor Svelte's`
			);
		}
	});
});

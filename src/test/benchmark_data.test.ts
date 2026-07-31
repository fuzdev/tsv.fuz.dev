import { assert, describe, test } from 'vitest';

import { benchmarks_json } from '$routes/docs/benchmarks/benchmarks.ts';
import { benchmarks_conformance_json } from '$routes/docs/benchmarks/benchmarks_conformance.ts';
import { benchmarks_cross_runtime_json } from '$routes/docs/benchmarks/benchmarks_cross_runtime.ts';
import { benchmarks_formatters_json } from '$routes/docs/benchmarks/benchmarks_formatters.ts';
import {
	benchmarks_cli,
	CLI_LABELS,
	CLI_SCENARIO_KEYS,
	cli_memory_ratio_range,
	cli_speedup_vs_tsv,
	CLI_TS_REPO_KEY
} from '$routes/docs/benchmarks/benchmarks_cli.ts';
import {
	benchmark_speedup,
	categorize_size_capability,
	compute_baseline_ratio,
	derive_benchmark_groups,
	derive_conformance_groups,
	derive_corpus_repos,
	derive_cross_runtime_groups,
	derive_size_groups,
	derive_speedup_summary,
	format_coverage_percent,
	format_ratio_approx,
	format_ratio_range,
	format_ratio_range_approx,
	format_speedup_signed,
	order_cross_runtime_runtimes,
	OXC_FULL_LABEL,
	OXFMT_WASM_LABEL
} from '$routes/docs/benchmarks/benchmark_data.ts';

// Shape gate for the committed benchmarks.json: the bench report format drifts
// (it once went 3 months stale across a key rename that rendered as `undefined`),
// and `benchmarks.ts` casts the JSON, so typechecking alone won't catch it.
// When `npm run update-benchmarks` pulls in a new shape, these fail loudly.
describe('benchmarks.json shape', () => {
	test('baseline version is current', () => {
		// version 5 is the first per-runtime report shape (carries `runtime`)
		assert.isAtLeast(benchmarks_json.version, 5);
	});

	test('binary sizes include the flagship tsv builds', () => {
		const labels = benchmarks_json.binary_sizes.map((s) => s.label);
		assert.include(labels, 'tsv (napi)'); // flagship N-API build (perf report anchor)
		assert.include(labels, 'tsv_wasm'); // the full wasm build — smallest full-toolchain, size baseline
	});

	test('versions carries the keys the meta component renders', () => {
		const { versions } = benchmarks_json;
		assert.isString(versions.svelte);
		assert.isString(versions.acorn_ts);
		assert.isString(versions.prettier);
		assert.isString(versions.prettier_svelte);
	});

	test('corpus covers every benchmarked language', () => {
		for (const language of ['svelte', 'typescript', 'css']) {
			assert.isAbove(benchmarks_json.corpus[language] ?? 0, 0, language);
		}
	});

	test('every group leads with its canonical entry (the default anchor) and a timed-set count', () => {
		const groups = derive_benchmark_groups(benchmarks_json);
		assert.isAtLeast(groups.length, 6); // format+parse × svelte/typescript/css
		for (const group of groups) {
			const key = `${group.operation}/${group.language}`;
			assert.ok(group.canonical_entry, `${key} has no canonical entry`);
			// the canonical reference sorts first, so it's the default 1.0x anchor the
			// shared component reads off the leading row
			assert.strictEqual(group.entries[0]?.category, 'canonical', `${key} canonical leads`);
			assert.isNotNull(group.files_iterated, `${key} has no files_iterated`);
			for (const entry of group.entries) {
				if (entry.disabled) continue;
				// measured entries render the whole-sweep mean (total corpus time); a
				// zero would misread as an instantaneous run
				assert.isAbove(entry.mean_ns, 0, `${key}/${entry.name} has no mean`);
			}
		}
	});

	test('svelte/css parse groups get disabled oxc placeholders, typescript keeps real ones', () => {
		const groups = derive_benchmark_groups(benchmarks_json);
		const parse = (language: string) =>
			groups.find((g) => g.operation === 'parse' && g.language === language);

		// typescript actually runs oxc-parser — its oxc entries are real, not placeholders
		const ts = parse('typescript');
		const ts_oxc = ts?.entries.filter((e) => e.category === 'oxc') ?? [];
		assert.isNotEmpty(ts_oxc);
		for (const e of ts_oxc) assert.isNotOk(e.disabled, `${e.name} should be a real entry`);

		// svelte and css mirror those oxc entries in, disabled, in the same fixed slot:
		// directly after the biome placeholder (both lead the cross-tool comparisons,
		// right after the canonical row) and before tsv's json wires
		for (const language of ['svelte', 'css']) {
			const group = parse(language);
			assert.ok(group, `${language} parse group missing`);
			const oxc = group.entries.filter((e) => e.category === 'oxc');
			assert.strictEqual(oxc.length, ts_oxc.length, `${language} oxc placeholder count`);
			for (const e of oxc) {
				assert.ok(e.disabled, `${language} ${e.name} should be disabled`);
				assert.strictEqual(e.bar_fraction, 0, `${language} ${e.name} bar`);
			}
			const names = group.entries.map((e) => e.name);
			const first_biome = names.findIndex((n) => n.includes('biome'));
			const first_oxc = names.findIndex((n) => n.includes('oxc'));
			const first_json = names.findIndex((n) => n.endsWith('-json') || n.endsWith('-no-locations'));
			assert.strictEqual(first_oxc, first_biome + 1, `${language} oxc directly after biome`);
			assert.isBelow(first_oxc, first_json, `${language} oxc before the tsv json entries`);
		}
	});

	test('every parse group gets a disabled biome placeholder, since biome never exposes a parser to JS', () => {
		const groups = derive_benchmark_groups(benchmarks_json);
		for (const language of ['svelte', 'typescript', 'css']) {
			const group = groups.find((g) => g.operation === 'parse' && g.language === language);
			assert.ok(group, `${language} parse group missing`);
			const biome = group.entries.filter((e) => e.category === 'biome');
			assert.strictEqual(biome.length, 1, `${language} biome placeholder count`);
			const [entry] = biome;
			assert.ok(entry, `${language} biome entry missing`);
			assert.ok(entry.disabled, `${language} biome entry should be disabled`);
			assert.strictEqual(entry.bar_fraction, 0, `${language} biome bar`);

			// biome leads the cross-tool comparisons: directly after the single canonical
			// row (index 0), before tsv's json wires
			const names = group.entries.map((e) => e.name);
			const first_biome = names.findIndex((n) => n.includes('biome'));
			const first_json = names.findIndex((n) => n.endsWith('-json') || n.endsWith('-no-locations'));
			assert.strictEqual(first_biome, 1, `${language} biome directly after the canonical row`);
			assert.isBelow(first_biome, first_json, `${language} biome before the tsv json entries`);
		}
	});

	test('svelte/css format groups get disabled dprint placeholders, typescript keeps real ones', () => {
		const groups = derive_benchmark_groups(benchmarks_json);
		const format = (language: string) =>
			groups.find((g) => g.operation === 'format' && g.language === language);

		// typescript actually runs dprint — its entry is real, not a placeholder
		const ts = format('typescript');
		const ts_dprint = ts?.entries.filter((e) => e.category === 'dprint') ?? [];

		// The dprint row postdates older reports. With no measured entry there is
		// nothing to mirror, and the derivation deliberately leaves every group
		// untouched — so assert exactly that (no invented rows) and stop. Refreshing
		// the report is what promotes this to the full assertion below.
		if (ts_dprint.length === 0) {
			for (const language of ['svelte', 'css']) {
				const group = format(language);
				assert.isEmpty(
					group?.entries.filter((e) => e.category === 'dprint') ?? [],
					`${language} must not invent a dprint row when the report carries none`
				);
			}
			return;
		}

		for (const e of ts_dprint) assert.isNotOk(e.disabled, `${e.name} should be a real entry`);

		// svelte and css mirror it in, disabled: dprint's `@dprint/typescript` plugin
		// rejects CSS and Svelte outright, so those groups have no real entry
		for (const language of ['svelte', 'css']) {
			const group = format(language);
			assert.ok(group, `${language} format group missing`);
			const dprint = group.entries.filter((e) => e.category === 'dprint');
			assert.strictEqual(dprint.length, ts_dprint.length, `${language} dprint placeholder count`);
			for (const e of dprint) {
				assert.ok(e.disabled, `${language} ${e.name} should be disabled`);
				assert.strictEqual(e.bar_fraction, 0, `${language} ${e.name} bar`);
			}
			// dprint sits between biome and oxc in the shared cross-tool ordering
			const names = group.entries.map((e) => e.name);
			const first_biome = names.findIndex((n) => n.includes('biome'));
			const first_dprint = names.findIndex((n) => n.includes('dprint'));
			assert.strictEqual(first_dprint, first_biome + 1, `${language} dprint directly after biome`);
		}
	});

	test('format/parse rows follow the fixed canonical → biome → dprint → oxc → json → internal order', () => {
		// independently mirrors the requested row order so a regression in the
		// derivation's comparator fails here
		const tier = (name: string, category: string): number => {
			if (category === 'canonical') return 0;
			if (category === 'biome') return 1;
			if (category === 'dprint') return 2;
			if (category === 'oxc') return 3;
			if (name.endsWith('-no-locations')) return 4; // tsv json, span-only wire
			if (name.endsWith('-json')) return 5; // tsv json, loc-carrying wire
			return 6; // tsv internal engine
		};
		for (const group of derive_benchmark_groups(benchmarks_json)) {
			const key = `${group.operation}/${group.language}`;
			const tiers = group.entries.map((e) => tier(e.name, e.category));
			assert.deepEqual(
				tiers,
				[...tiers].toSorted((a, b) => a - b),
				`${key} tier order`
			);
			// wasm precedes native within a tier
			for (let i = 1; i < group.entries.length; i++) {
				if (tiers[i] !== tiers[i - 1]) continue;
				const prev_wasm = group.entries[i - 1]!.name.includes('wasm');
				const curr_wasm = group.entries[i]!.name.includes('wasm');
				assert.isFalse(!prev_wasm && curr_wasm, `${key} native precedes wasm within a tier`);
			}
		}
	});

	test('speedup summary is fully populated', () => {
		const rows = derive_speedup_summary(derive_benchmark_groups(benchmarks_json));
		assert.strictEqual(rows.length, 2); // native + wasm
		for (const row of rows) {
			assert.isDefined(row.format_svelte, row.variant);
			assert.isDefined(row.format_typescript, row.variant);
			assert.isDefined(row.format_css, row.variant);
		}
	});

	test('binary sizes group by capability with one smallest-build ratio anchor', () => {
		const groups = derive_size_groups(benchmarks_json.binary_sizes);
		// full / formatter / parser, in that order, all present in the current data
		assert.deepStrictEqual(
			groups.map((g) => g.capability),
			['full', 'formatter', 'parser']
		);
		for (const group of groups) {
			assert.isNotEmpty(group.entries);
			// every entry lands in the group its capability names
			for (const e of group.entries) {
				assert.strictEqual(categorize_size_capability(e.label), group.capability);
			}
			// the group's default ratio anchor (its 1.0x row) is the single smallest real
			// build, and it leads the group — the shared component reads every ratio off
			// the first row. Disabled placeholders (e.g. oxfmt's absent wasm build) never
			// sort first.
			const real = group.entries.filter((e) => !e.disabled);
			const smallest = real.reduce((a, b) => (a.bytes <= b.bytes ? a : b));
			assert.strictEqual(
				group.entries[0]?.label,
				smallest.label,
				`${group.capability} smallest leads`
			);
		}
		// the parser group pits tsv against oxc-parser in both kinds
		const parser = groups.find((g) => g.capability === 'parser');
		const parser_labels = parser?.entries.map((e) => e.label) ?? [];
		assert.include(parser_labels, 'oxc-parser (wasm)');
		assert.include(parser_labels, 'oxc-parser (napi)');
	});

	test('full toolchain group carries the combined oxc-parser + oxfmt entry', () => {
		const sizes = benchmarks_json.binary_sizes;
		const groups = derive_size_groups(sizes);
		const full = groups.find((g) => g.capability === 'full');
		const combined = full?.entries.find((e) => e.label === OXC_FULL_LABEL);
		assert.ok(combined, 'combined oxc entry missing from full toolchain group');

		// its bytes and gzip are the sum of oxc's separate parser and formatter builds
		const oxc_parser = sizes.find((s) => s.label === 'oxc-parser (napi)');
		const oxfmt = sizes.find((s) => s.label === 'oxfmt (napi)');
		assert.ok(oxc_parser && oxfmt, 'source oxc builds missing');
		assert.strictEqual(combined.bytes, oxc_parser.bytes + oxfmt.bytes);
		assert.strictEqual(combined.gzip_bytes, oxc_parser.gzip_bytes! + oxfmt.gzip_bytes!);

		// native build, colored as oxc
		assert.strictEqual(combined.kind, 'native');
		assert.strictEqual(combined.category, 'oxc');
	});

	test('formatter group gets a disabled oxfmt (wasm) placeholder just above oxfmt (napi), since oxfmt has no wasm build', () => {
		const groups = derive_size_groups(benchmarks_json.binary_sizes);
		const formatter = groups.find((g) => g.capability === 'formatter');
		assert.ok(formatter, 'formatter group missing');

		const placeholder = formatter.entries.find((e) => e.label === OXFMT_WASM_LABEL);
		assert.ok(placeholder, 'oxfmt (wasm) placeholder missing');
		assert.ok(placeholder.disabled, 'oxfmt (wasm) should be disabled');
		assert.strictEqual(placeholder.kind, 'wasm');
		assert.strictEqual(placeholder.category, 'oxc');
		assert.strictEqual(placeholder.bar_fraction, 0);

		const labels = formatter.entries.map((e) => e.label);
		const placeholder_index = labels.indexOf(OXFMT_WASM_LABEL);
		const native_index = labels.indexOf('oxfmt (napi)');
		assert.isAbove(native_index, -1, 'oxfmt (napi) missing from formatter group');
		assert.strictEqual(
			placeholder_index,
			native_index - 1,
			'placeholder should sit just above oxfmt (napi)'
		);
	});

	test('flagship report is the node runtime', () => {
		// the headline detailed view switched to N-API under Node; guards against an
		// `update-benchmarks` that pulls the wrong runtime's sibling report
		assert.strictEqual(benchmarks_json.runtime, 'node');
	});
});

// Shape gate for the committed conformance report `benchmarks_conformance.json`
// (tsv's `report.conformance.node.json` — the parse-coverage surface over the
// deliberately-hard fixture suites, disjoint from the perf corpus, Svelte set minus
// canonical-rejects), consumed by the Parse conformance section.
describe('benchmarks_conformance.json shape', () => {
	test('report is the conformance surface at the current version', () => {
		assert.isAtLeast(benchmarks_conformance_json.version, 6);
		assert.strictEqual(benchmarks_conformance_json.corpus_kind, 'conformance');
		assert.strictEqual(benchmarks_conformance_json.runtime, 'node');
	});

	test('conformance report is parse-only', () => {
		for (const entry of benchmarks_conformance_json.entries) {
			assert.match(entry.group, /^parse\//, `${entry.group}/${entry.name}`);
		}
	});

	test('corpus sources disclose the composition', () => {
		assert.isNotEmpty(benchmarks_conformance_json.corpus_sources ?? []);
	});

	test('derives one coverage group per language, each with a tsv row and full coverage data', () => {
		const groups = derive_conformance_groups(benchmarks_conformance_json);
		assert.strictEqual(groups.length, 3); // svelte / typescript / css
		assert.deepEqual(
			groups.map((g) => g.language),
			['svelte', 'typescript', 'css']
		);
		for (const group of groups) {
			assert.ok(
				group.rows.some((r) => r.name === 'tsv'),
				`${group.language} has a tsv row`
			);
			// rows are ordered by coverage, highest first
			const fractions = group.rows.map((r) => r.coverage_fraction);
			assert.deepEqual(
				fractions,
				[...fractions].toSorted((a, b) => b - a),
				`${group.language} rows descend by coverage`
			);
			for (const row of group.rows) {
				assert.isAbove(row.files_total, 0, `${group.language}/${row.name} total`);
				assert.isAtLeast(row.coverage_fraction, 0);
				assert.isAtMost(row.coverage_fraction, 1);
				// engine-level rows only — binding/materialization variants are folded
				assert.notMatch(row.name, /-internal|wasm-|-wasm/, `${group.language}/${row.name}`);
			}
		}
	});

	test('coverage percent floors — only exact totality reads 100%', () => {
		// 44219/44220 rounds to 100.00% but must not display as it: floor, so a
		// visibly non-total count never sits beside a "100.00%" label.
		assert.strictEqual(format_coverage_percent(44_219 / 44_220), '99.99%');
		assert.strictEqual(format_coverage_percent(1), '100.00%');
		assert.strictEqual(format_coverage_percent(0.998549), '99.85%');
		assert.strictEqual(format_coverage_percent(0), '0.00%');
	});
});

describe('derive_corpus_repos', () => {
	test('maps the committed corpus sources to deduped org/name repo links', () => {
		const repos = derive_corpus_repos(benchmarks_json.corpus_sources);
		assert.isNotEmpty(repos);
		// one entry per URL — no repo appears twice even though svelte.dev contributes
		// several source subpaths
		const urls = repos.map((r) => r.url);
		assert.strictEqual(new Set(urls).size, urls.length, 'urls are distinct');
		const svelte_dev = repos.filter((r) => r.url === 'https://github.com/sveltejs/svelte.dev');
		assert.strictEqual(svelte_dev.length, 1, 'svelte.dev collapses to one entry');
		// each label is the linkified `org/name`, derived from (and ending) its URL
		for (const repo of repos) {
			assert.match(repo.label, /^[^/]+\/[^/]+$/, repo.url);
			assert.isTrue(repo.url.endsWith(repo.label), `${repo.url} ends with ${repo.label}`);
		}
	});

	test('collapses shared repos and drops sources with no mapped repo', () => {
		const repos = derive_corpus_repos([
			{ path: '../zzz/src', files: 1 },
			{ path: '../svelte.dev/apps/svelte.dev/src', files: 1 },
			{ path: '../svelte.dev/packages/repl/src', files: 1 }, // same repo → collapsed
			{ path: 'benches/js/.cache/svelte_styles', files: 1 } // not a repo → dropped
		]);
		assert.deepStrictEqual(repos, [
			{ url: 'https://github.com/fuzdev/zzz', label: 'fuzdev/zzz' },
			{
				url: 'https://github.com/sveltejs/svelte.dev',
				label: 'sveltejs/svelte.dev'
			}
		]);
	});

	test('handles a missing corpus_sources field', () => {
		assert.deepStrictEqual(derive_corpus_repos(undefined), []);
	});
});

describe('format_speedup_signed', () => {
	test('anchor-and-faster entries read as a plain multiple', () => {
		assert.strictEqual(format_speedup_signed(1), '1.00x');
		assert.strictEqual(format_speedup_signed(2.5), '2.50x');
		assert.strictEqual(format_speedup_signed(12.3), '12.3x'); // >= 10 drops to one decimal
	});

	test('slower entries negate the reciprocal so the factor is directly legible', () => {
		assert.strictEqual(format_speedup_signed(0.15), '-6.67x');
		assert.strictEqual(format_speedup_signed(0.05), '-20.0x'); // >= 10 magnitude → one decimal
		assert.strictEqual(format_speedup_signed(0.98), '-1.02x'); // near-parity sign flip
	});
});

describe('compute_baseline_ratio', () => {
	test('speed reads the anchor as the reference — faster entries exceed 1', () => {
		// anchor 100ns; a 50ns entry is 2x faster, a 200ns entry is half the speed
		assert.strictEqual(compute_baseline_ratio('speed', 50, 100), 2);
		assert.strictEqual(compute_baseline_ratio('speed', 200, 100), 0.5);
	});

	test('size reads the anchor as the reference — bigger entries exceed 1', () => {
		// anchor 100 bytes; a 300-byte build is 3x bigger, a 50-byte build is half
		assert.strictEqual(compute_baseline_ratio('size', 300, 100), 3);
		assert.strictEqual(compute_baseline_ratio('size', 50, 100), 0.5);
	});
});

describe('order_cross_runtime_runtimes', () => {
	test('reorders the report storage order to node-first display order', () => {
		assert.deepStrictEqual(order_cross_runtime_runtimes(['deno', 'node', 'bun']), [
			'node',
			'deno',
			'bun'
		]);
	});

	test('anchors on the next runtime in display order when node is absent', () => {
		assert.deepStrictEqual(order_cross_runtime_runtimes(['bun', 'deno']), ['deno', 'bun']);
		assert.deepStrictEqual(order_cross_runtime_runtimes([]), []);
	});
});

// Shape gate for the committed cross-runtime `benchmarks_cross_runtime.json` (the
// bench composer's combined `report.json`) — a different, slimmer shape than the
// per-runtime baseline, consumed by the Cross-runtime section.
describe('benchmarks_cross_runtime.json shape', () => {
	test('combined report carries the current version and kind', () => {
		assert.isAtLeast(benchmarks_cross_runtime_json.version, 5);
		assert.strictEqual(benchmarks_cross_runtime_json.kind, 'combined');
		// the committed fixture must be same-vintage — if this trips, re-run every
		// runtime and recompose rather than committing a mixed set (the site would
		// show the unreliable-ratios warning banner)
		assert.notStrictEqual(benchmarks_cross_runtime_json.mixed_vintage, true);
	});

	test('runtimes include the flagship and its cross-runtime peers', () => {
		const { runtimes } = benchmarks_cross_runtime_json;
		assert.include(runtimes, 'node'); // the flagship the headline view leads with
		assert.include(runtimes, 'deno');
		assert.include(runtimes, 'bun');
	});

	test('every group derives rows with the flagship runtime populated', () => {
		const groups = derive_cross_runtime_groups(benchmarks_cross_runtime_json);
		assert.isAtLeast(groups.length, 6); // format+parse × svelte/typescript/css
		for (const group of groups) {
			assert.isAbove(group.rows.length, 0, group.group);
			for (const row of group.rows) {
				assert.isNumber(row.ops_per_second.node, `${group.group}/${row.name} missing node ops`);
				// ratios anchor on node (the display-order base, not the report's
				// deno-first storage order), so node's own ratio is exactly 1
				assert.strictEqual(row.ratio_vs_base.node, 1, `${group.group}/${row.name} node anchor`);
			}
		}
	});
});

// Shape gate for the CLI report `benchmarks_cli.ts` derives from the generated
// `benchmarks_formatters.json`. The generator parses prose, so a drifted heading
// or scenario id in the harness's README would silently drop a scenario or its
// `tsv` reference row and render an empty table rather than fail to typecheck.
describe('benchmarks_cli shape', () => {
	test('every scenario the page has prose for resolved to generated data', () => {
		// a copy entry with no matching scenario id drops silently from the table
		assert.deepEqual(
			benchmarks_cli.scenarios.map((s) => s.key),
			CLI_SCENARIO_KEYS
		);
	});

	test('every scenario carries a tsv reference row with positive metrics', () => {
		assert.isAtLeast(benchmarks_cli.scenarios.length, 1);
		for (const scenario of benchmarks_cli.scenarios) {
			// BenchmarksCli anchors every ratio on the tsv row; without it the table is empty
			assert.ok(
				scenario.results.some((r) => r.label === 'tsv'),
				`${scenario.key} is missing its tsv row`
			);
			for (const r of scenario.results) {
				assert.isAbove(r.wall_ms, 0, `${scenario.key}/${r.label} wall_ms`);
				assert.isAbove(r.cpu_ms, 0, `${scenario.key}/${r.label} cpu_ms`);
				// null is legal (a harness run without GNU time measures no memory), 0 is not
				assert.ok(r.memory_mb === null || r.memory_mb > 0, `${scenario.key}/${r.label} memory_mb`);
			}
		}
	});

	test('the derived wall-clock ratios agree with hyperfine own summary', () => {
		// The generated report carries the harness's own `Summary` ratios beside the
		// raw timings. Recomputing them from the timings and comparing catches a
		// misparse that would otherwise render plausible-but-wrong numbers.
		for (const scenario of benchmarks_formatters_json.scenarios) {
			assert.strictEqual(scenario.baseline, 'tsv', `${scenario.id} baseline`);
			for (const speedup of scenario.speedups) {
				const derived = cli_speedup_vs_tsv(
					scenario.id,
					CLI_LABELS[speedup.name] ?? speedup.name,
					'wall_ms'
				);
				assert.isDefined(derived, `${scenario.id}/${speedup.name}`);
				// hyperfine derives its summary from full-precision means but prints the
				// timings rounded, so recomputing from the printed numbers lands within a
				// fraction of a percent — wide enough for that, far too tight to hide a
				// misparse (a wrong unit would be off by 1000x)
				assert.closeTo(
					derived,
					speedup.ratio,
					speedup.ratio * 0.01,
					`${scenario.id}/${speedup.name}`
				);
			}
		}
	});

	test('every formatter accepts the whole corpus, as the page claims', () => {
		// The page's notes say the preflight parse check found nothing rejected, so
		// no formatter is credited for skipping files. That's a claim about the data.
		for (const scenario of benchmarks_formatters_json.scenarios) {
			assert.isNotEmpty(scenario.preflight, `${scenario.id} ran no preflight`);
			for (const entry of scenario.preflight) {
				assert.strictEqual(entry.rejected, 0, `${scenario.id}/${entry.name} rejected files`);
				assert.isFalse(entry.unavailable, `${scenario.id}/${entry.name} never launched`);
			}
		}
	});
});

// The page's prose quotes ratios computed from the reports rather than
// hand-written numbers, so a renamed entry or a dropped scenario would render
// `—` mid-sentence instead of failing. These gate every pair the copy names.
describe('prose ratios resolve', () => {
	const IN_PROCESS_PAIRS: Array<[string, string, string]> = [
		['format/typescript', 'oxfmt', 'tsv'],
		['format/typescript', 'prettier', 'tsv'],
		['format/typescript', 'biome-wasm', 'tsv_wasm'],
		['format/svelte', 'prettier', 'tsv'],
		['format/svelte', 'biome-wasm', 'tsv_wasm'],
		['format/css', 'oxfmt', 'tsv'],
		['format/css', 'biome-wasm', 'tsv_wasm'],
		['parse/typescript', 'oxc-parser', 'tsv-json-no-locations']
	];

	test('every in-process pair the TLDR quotes is present and favors tsv', () => {
		for (const [group, slower, faster] of IN_PROCESS_PAIRS) {
			const ratio = benchmark_speedup(benchmarks_json, group, slower, faster);
			assert.isDefined(ratio, `${group}: ${slower} vs ${faster}`);
			assert.isAbove(ratio, 1, `${group}: ${slower} vs ${faster}`);
		}
	});

	test('every CLI ratio the prose quotes is present', () => {
		for (const [label, metric] of [
			['oxfmt', 'wall_ms'],
			['oxfmt', 'cpu_ms'],
			['biome', 'wall_ms']
		] as const) {
			assert.isDefined(
				cli_speedup_vs_tsv(CLI_TS_REPO_KEY, label, metric),
				`${CLI_TS_REPO_KEY}: ${label} ${metric}`
			);
		}
		// the TLDR's "less memory than either" range, scoped to the tools it names
		assert.isDefined(cli_memory_ratio_range(CLI_TS_REPO_KEY, ['oxfmt', 'biome']));
		assert.isDefined(cli_memory_ratio_range());
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

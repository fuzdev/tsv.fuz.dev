import { assert, describe, test } from 'vitest';

import { benchmarks_json } from '$routes/docs/benchmarks/benchmarks.ts';
import { benchmarks_conformance_json } from '$routes/docs/benchmarks/benchmarks_conformance.ts';
import { benchmarks_cross_runtime_json } from '$routes/docs/benchmarks/benchmarks_cross_runtime.ts';
import { benchmarks_formatters_json } from '$routes/docs/benchmarks/benchmarks_formatters.ts';
import {
	benchmarks_cli,
	CLI_SCENARIO_KEYS,
	cli_memory_ratio_range,
	cli_speedup_vs_tsv,
	CLI_DELIVERY_KEY,
	CLI_TS_REPO_KEY,
	CLI_TSV_NPM_LABEL,
	CLI_TSV_WASM_LABEL
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
	derive_unavailable_by_runtime,
	derive_unstable_cells,
	derive_unstable_entries,
	format_coverage_percent,
	is_entry_unstable,
	is_impl_unavailable,
	format_ratio_approx,
	format_ratio_range,
	format_ratio_range_approx,
	format_speedup_signed,
	order_cross_runtime_runtimes,
	OXC_FULL_LABEL,
	RSVELTE_INSTALL_LABEL,
	RSVELTE_LABEL,
	OXFMT_WASM_LABEL,
	type CrossRuntimeReport
} from '$routes/docs/benchmarks/benchmark_data.ts';

// The report shape versions the committed copies are pinned to — tsv's
// `REPORT_SCHEMA_VERSION` (per-runtime and conformance reports) and its composer's
// `COMBINED_SCHEMA_VERSION`. Exact rather than floors, so `npm run update-benchmarks`
// pulling a newer shape fails here until `benchmark_data.ts` mirrors the new fields
// and these are re-pinned together.
const REPORT_VERSION = 15;
const COMBINED_VERSION = 15;

// Shape gate for the committed benchmarks.json: the bench report format drifts
// (it once went 3 months stale across a key rename that rendered as `undefined`),
// and `benchmarks.ts` casts the JSON, so typechecking alone won't catch it.
// When `npm run update-benchmarks` pulls in a new shape, these fail loudly.
describe('benchmarks.json shape', () => {
	test('baseline version is current', () => {
		// pinned exactly: a bump in tsv's `REPORT_SCHEMA_VERSION` must be a deliberate
		// re-pin here, after `benchmark_data.ts` gains the new fields' version-notes
		assert.strictEqual(benchmarks_json.version, REPORT_VERSION);
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

	test('yuku appears in the typescript parse group only, and is never mirrored elsewhere', () => {
		const groups = derive_benchmark_groups(benchmarks_json);

		// The page's yuku prose is unconditional, so the copied report must carry the
		// rows it describes — this failing means the report needs a refresh.
		const ts = groups.find((g) => g.operation === 'parse' && g.language === 'typescript');
		const ts_yuku = ts?.entries.filter((e) => e.category === 'yuku') ?? [];
		assert.isNotEmpty(ts_yuku, 'typescript parse must carry yuku rows');
		for (const e of ts_yuku) assert.isNotOk(e.disabled, `${e.name} should be a real entry`);

		// A grayed-out slot says a tool with WIDER scope is missing this language —
		// true of biome and oxc, not of a parser that claims nothing wider.
		for (const group of groups) {
			if (group.operation !== 'parse' || group.language === 'typescript') continue;
			assert.isEmpty(
				group.entries.filter((e) => e.category === 'yuku'),
				`${group.language} parse must hold no yuku slot`
			);
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

	test('svelte gets a disabled dprint placeholder; typescript keeps dprint and css keeps malva real', () => {
		const groups = derive_benchmark_groups(benchmarks_json);
		const format = (language: string) =>
			groups.find((g) => g.operation === 'format' && g.language === language);
		const dprint_rows = (language: string) =>
			format(language)?.entries.filter((e) => e.category === 'dprint') ?? [];

		// typescript actually runs dprint — its entry is real, not a placeholder
		const ts_dprint = dprint_rows('typescript');

		// The dprint row postdates older reports. With no measured entry there is
		// nothing to mirror, and the derivation deliberately leaves every group
		// untouched — so assert exactly that (no invented rows) and stop. Refreshing
		// the report is what promotes this to the full assertion below.
		if (ts_dprint.length === 0) {
			assert.isEmpty(
				dprint_rows('svelte'),
				'svelte must not invent a dprint row when the report carries none'
			);
			return;
		}
		for (const e of ts_dprint) assert.isNotOk(e.disabled, `${e.name} should be a real entry`);

		// css runs dprint's own CSS plugin, malva, through the same Wasm host — a REAL
		// row that shares dprint's category (see CATEGORY_BY_NAME), so css gets no
		// placeholder: the mirror only fills a group with no dprint-category entry
		const css_dprint = dprint_rows('css');
		assert.deepEqual(
			css_dprint.map((e) => e.name),
			['malva-wasm'],
			'css carries malva-wasm and no dprint placeholder'
		);
		for (const e of css_dprint) assert.isNotOk(e.disabled, `${e.name} should be a real entry`);

		// svelte mirrors the typescript entry in, disabled: `@dprint/typescript`
		// rejects Svelte outright and the bench loads no Svelte plugin for the host
		const svelte_dprint = dprint_rows('svelte');
		assert.strictEqual(svelte_dprint.length, ts_dprint.length, 'svelte dprint placeholder count');
		for (const e of svelte_dprint) {
			assert.ok(e.disabled, `svelte ${e.name} should be disabled`);
			assert.strictEqual(e.bar_fraction, 0, `svelte ${e.name} bar`);
		}

		// in every group the dprint-category row sits directly after biome in the
		// shared cross-tool ordering, real or placeholder alike
		for (const language of ['svelte', 'css']) {
			const names = format(language)!.entries.map((e) => e.name);
			const first_biome = names.findIndex((n) => n.includes('biome'));
			const first_dprint = names.findIndex((n) => n.includes('dprint') || n.includes('malva'));
			assert.strictEqual(
				first_dprint,
				first_biome + 1,
				`${language} dprint-category row directly after biome`
			);
		}
	});

	test('the coverage-only rsvelte-fmt row is inert but keeps its real coverage', () => {
		const groups = derive_benchmark_groups(benchmarks_json);
		const svelte_format = groups.find((g) => g.operation === 'format' && g.language === 'svelte');
		assert.ok(svelte_format, 'svelte format group missing');
		const rsvelte = svelte_format.entries.find((e) => e.name === 'rsvelte-fmt');

		// The row postdates older reports; refreshing the report promotes this to
		// the full assertion, exactly as the dprint test above works.
		if (!rsvelte) return;

		// Inert: no bar, and never the ratio anchor — it has no timing to anchor on.
		assert.ok(rsvelte.disabled, 'rsvelte-fmt should render inert');
		assert.ok(rsvelte.coverage_only, 'rsvelte-fmt should be flagged coverage-only');
		assert.strictEqual(rsvelte.bar_fraction, 0, 'rsvelte-fmt bar');

		// ...but unlike a plain placeholder it DID run, so its coverage is real.
		// This is the distinction the page renders as `not timed` rather than `n/a`.
		assert.isNumber(rsvelte.files_processed, 'rsvelte-fmt coverage should be present');
		assert.isNumber(rsvelte.files_total, 'rsvelte-fmt total should be present');

		// It must not have become the group's bar scale: an untimed row coerces to
		// mean_ns 0, so a regression that let it into `slowest` would silently
		// rescale every real bar in the group.
		const timed = svelte_format.entries.filter((e) => !e.disabled);
		assert.ok(
			timed.some((e) => e.bar_fraction === 1),
			'some timed row must still be the full-width bar'
		);

		// Only format/svelte carries it — it formats nothing else here.
		for (const group of groups) {
			if (group === svelte_format) continue;
			assert.isEmpty(
				group.entries.filter((e) => e.name === 'rsvelte-fmt'),
				`${group.operation}/${group.language} should carry no rsvelte-fmt row`
			);
		}
	});

	test('format/parse rows follow the fixed canonical → biome → dprint → oxc → postcss → rsvelte → swc → yuku → json → internal order', () => {
		// independently mirrors the requested row order (`speed_entry_rank`) so a
		// regression in the derivation's comparator fails here
		const tier = (name: string, category: string): number => {
			if (category === 'canonical') return 0;
			if (category === 'biome') return 1;
			if (category === 'dprint') return 2;
			if (category === 'oxc') return 3;
			if (category === 'postcss') return 4;
			if (category === 'rsvelte') return 5;
			if (category === 'swc') return 6;
			if (category === 'yuku') return 7;
			if (name.endsWith('-no-locations')) return 8; // tsv json, span-only wire
			if (name.endsWith('-json')) return 9; // tsv json, loc-carrying wire
			return 10; // tsv internal engine
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

	test('formatter group carries rsvelte-fmt both bare and summed with the oxfmt it needs for a project', () => {
		const sizes = benchmarks_json.binary_sizes;
		const groups = derive_size_groups(sizes);
		const formatter = groups.find((g) => g.capability === 'formatter');
		assert.ok(formatter, 'formatter group missing');

		const bare = formatter.entries.find((e) => e.label === RSVELTE_LABEL);
		// The rsvelte rows postdate older reports; refreshing the report promotes
		// this to the full assertion, as the dprint test above works.
		if (!bare) {
			assert.isEmpty(
				formatter.entries.filter((e) => e.label === RSVELTE_INSTALL_LABEL),
				'must not synthesize the rsvelte pair when the report carries no rsvelte build'
			);
			return;
		}

		const combined = formatter.entries.find((e) => e.label === RSVELTE_INSTALL_LABEL);
		assert.ok(combined, 'rsvelte-fmt + oxfmt entry missing from formatter group');

		const oxfmt = sizes.find((s) => s.label === 'oxfmt (napi)');
		assert.ok(oxfmt, 'source oxfmt build missing');
		assert.strictEqual(combined.bytes, bare.bytes + oxfmt.bytes);
		assert.strictEqual(combined.gzip_bytes, bare.gzip_bytes! + oxfmt.gzip_bytes!);

		// both are real measured builds, not placeholders — the pair is the project
		// figure, the bare binary the single-file one
		assert.isNotOk(bare.disabled, 'bare rsvelte-fmt should be a real entry');
		assert.isNotOk(combined.disabled, 'rsvelte pair should be a real entry');
		assert.strictEqual(combined.kind, 'native');
		for (const e of [bare, combined]) {
			assert.strictEqual(e.category, 'rsvelte', `${e.label} category`);
		}

		// the sum must sort after its own bare half — a group ordered smallest-first
		// would otherwise be reporting a sum smaller than one of its addends
		const labels = formatter.entries.map((e) => e.label);
		assert.isAbove(
			labels.indexOf(RSVELTE_INSTALL_LABEL),
			labels.indexOf(RSVELTE_LABEL),
			'the rsvelte pair should sort after the bare binary'
		);
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
		assert.strictEqual(benchmarks_conformance_json.version, REPORT_VERSION);
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

	test('yuku reaches the typescript coverage group through its wasm binding', () => {
		// The conformance report carries no yuku native row — that binding crashes the
		// host process on this corpus, so tsv's harness omits it — and the page's note
		// about it is unconditional. If the row name ever changes, the engine would
		// silently vanish from the table instead of failing here.
		const groups = derive_conformance_groups(benchmarks_conformance_json);
		const ts = groups.find((g) => g.language === 'typescript');
		const yuku = ts?.rows.find((r) => r.name === 'yuku-parser');
		assert.ok(yuku, 'typescript coverage must carry a yuku-parser row');
		// the row's own qualifier, so the table says which binding without the
		// reader having to reach the note below it
		assert.strictEqual(yuku.note, 'wasm — native segfaults');
	});

	test('tsc reaches the typescript coverage group, and only it, with its oracle note', () => {
		// tsc parses TypeScript/JS alone and rides this surface only (it is a verdict,
		// not a speed). It also SELECTED one slice of this corpus, where it scores 100%
		// by construction — the note is what keeps the blended aggregate from reading as
		// one achieved number, so a silent note rename must fail here rather than on the
		// published page.
		const groups = derive_conformance_groups(benchmarks_conformance_json);
		const row_named = (language: string) =>
			groups.find((g) => g.language === language)?.rows.find((r) => r.name === 'tsc');
		const tsc = row_named('typescript');
		assert.ok(tsc, 'typescript coverage must carry a tsc row');
		assert.strictEqual(tsc.note, 'oracle for part of this corpus');
		assert.isUndefined(row_named('svelte'), 'tsc parses no Svelte');
		assert.isUndefined(row_named('css'), 'tsc parses no CSS');
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

	test('collapses shared repos and drops sources with no detected repo', () => {
		const ref = (slug: string, subpath: string) => ({
			url: `https://github.com/${slug}`,
			slug,
			commit: '0123456789abcdef0123456789abcdef01234567',
			subpath
		});
		const repos = derive_corpus_repos([
			{
				path: '../corpora/collections/zzz/src',
				files: 1,
				repo: ref('fuzdev/zzz', 'src')
			},
			{
				path: '../corpora/collections/svelte.dev/apps/svelte.dev/src',
				files: 1,
				repo: ref('sveltejs/svelte.dev', 'apps/svelte.dev/src')
			},
			{
				path: '../corpora/collections/svelte.dev/packages/repl/src',
				files: 1,
				repo: ref('sveltejs/svelte.dev', 'packages/repl/src') // same repo → collapsed
			},
			{ path: 'benches/js/.cache/svelte_styles', files: 1 } // no detected repo → dropped
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
		assert.strictEqual(benchmarks_cross_runtime_json.version, COMBINED_VERSION);
		assert.strictEqual(benchmarks_cross_runtime_json.kind, 'combined');
		// the committed fixture must be same-vintage — if this trips, re-run every
		// runtime and recompose rather than committing a mixed set (the site would
		// show the unreliable-ratios warning banner)
		assert.notStrictEqual(benchmarks_cross_runtime_json.mixed_vintage, true);
	});

	test('the conformance report is same-vintage with the perf siblings', () => {
		// combined `version` 13 records it; a stale one means `update-benchmarks`
		// copied a conformance report from a different refresh than the perf trio
		// (the site would show the parse-conformance section's warning banner)
		const vintage = benchmarks_cross_runtime_json.conformance_vintage;
		assert.isOk(vintage, 'conformance_vintage recorded');
		assert.notStrictEqual(vintage.stale, true);
		assert.strictEqual(vintage.git_commit, benchmarks_conformance_json.git_commit);
	});

	test('the flagship report is the node sibling the combined report was composed from', () => {
		// `update-benchmarks` copies three files from one `deno task bench`; if a copy
		// is skipped or taken from another worktree, the detailed view and the
		// cross-runtime tables silently describe different builds. The composer
		// can't see the copied files, so this is the site-side vintage gate
		const node = benchmarks_cross_runtime_json.sources.find((s) => s.runtime === 'node');
		assert.isOk(node, 'combined report carries a node source');
		assert.strictEqual(node.git_commit, benchmarks_json.git_commit);
		assert.strictEqual(node.timestamp, benchmarks_json.timestamp);
		assert.strictEqual(node.tsv, benchmarks_json.versions.tsv);
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

	test('the committed reports timed identical file sets across runtimes', () => {
		// a mismatch means part of a published ratio is corpus composition, not
		// runtime — recompose from same-box, same-commit siblings rather than
		// committing a report that needs the ⚠ files annotation
		const groups = derive_cross_runtime_groups(benchmarks_cross_runtime_json);
		for (const group of groups) {
			for (const row of group.rows) {
				assert.isNull(row.files_iterated_mismatch, `${group.group}/${row.name} file-set mismatch`);
			}
		}
	});
});

// Per-runtime load failures (the composer's `unavailable_by_runtime`, combined
// `version` 9+ — it carried init-line labels under `impls` at 8, which matched no
// row name). Synthetic reports: the committed one predates the field, and the
// point of these is the DISTINCTION the field draws — a runtime that couldn't load
// the impl behind a row versus a report that simply has no such row. Both render
// as `fail`.
describe('derive_unavailable_by_runtime', () => {
	const report = (
		unavailable_by_runtime?: CrossRuntimeReport['unavailable_by_runtime']
	): CrossRuntimeReport => ({
		version: 9,
		kind: 'combined',
		generated: '2026-01-01T00:00:00.000Z',
		runtimes: ['deno', 'node', 'bun'],
		unavailable_by_runtime,
		sources: [],
		rows: []
	});

	test('lists each runtime in the site column order, not the report storage order', () => {
		// the report stores deno-first; the tables read node-first, and a disclosure
		// listing runtimes in a different order than the columns invites misreading
		const derived = derive_unavailable_by_runtime(
			report([
				{ runtime: 'bun', rows: ['biome-wasm', 'oxc-parser-wasm'] },
				{ runtime: 'node', rows: ['biome-wasm'] }
			])
		);
		assert.deepStrictEqual(
			derived.map((entry) => entry.runtime),
			['node', 'bun']
		);
	});

	test('an empty row list is not a disclosure', () => {
		assert.isEmpty(derive_unavailable_by_runtime(report([{ runtime: 'bun', rows: [] }])));
	});

	test('a report predating the field discloses nothing — silence, not an all-clear', () => {
		assert.isEmpty(derive_unavailable_by_runtime(report(undefined)));
	});

	test('is_impl_unavailable answers per runtime, and never guesses on an older report', () => {
		// keyed by ROW name (`biome-wasm`), which is what the tables render — the
		// bench's init label (`Biome`) would match no cell
		const recorded = report([{ runtime: 'bun', rows: ['biome-wasm'] }]);
		assert.isTrue(is_impl_unavailable(recorded, 'bun', 'biome-wasm'));
		assert.isFalse(is_impl_unavailable(recorded, 'node', 'biome-wasm'));
		assert.isFalse(is_impl_unavailable(recorded, 'bun', 'oxfmt'));
		// absent field → every cell reads as "not measured here", which is the only
		// claim the data supports
		assert.isFalse(is_impl_unavailable(report(undefined), 'bun', 'biome-wasm'));
	});
});

// Binary-size capability grouping. The heuristic reads the tool's NAME, so the
// tools not named after their job are the ones that can silently land under a
// heading that misdescribes them (a formatter filed as "parse + format").
describe('categorize_size_capability', () => {
	test('reads the job out of a label that names it', () => {
		assert.strictEqual(categorize_size_capability('tsv parse (ffi)'), 'parser');
		assert.strictEqual(categorize_size_capability('tsv_format_wasm'), 'formatter');
		assert.strictEqual(categorize_size_capability('oxfmt (napi)'), 'formatter');
		assert.strictEqual(categorize_size_capability(OXC_FULL_LABEL), 'full');
		assert.strictEqual(categorize_size_capability('tsv (napi)'), 'full');
	});

	test('the tools whose names say nothing are stated, not guessed', () => {
		// each of these would otherwise fall through to `full` — a "parse + format"
		// heading over four builds, two shipping only a formatter and two no formatter
		assert.strictEqual(categorize_size_capability('dprint (wasm)'), 'formatter');
		assert.strictEqual(categorize_size_capability('malva (wasm)'), 'formatter');
		assert.strictEqual(categorize_size_capability('swc (napi)'), 'parser');
		assert.strictEqual(categorize_size_capability('rsvelte compiler (napi)'), 'parser');
	});

	test('the two dprint plugins share a bucket', () => {
		// `dprint (wasm)` and `malva (wasm)` are the same kind of artifact — plugins
		// over the one @dprint/formatter host, neither exposing a parser — so they
		// must never be filed apart. Only `malva` reads as a formatter to a human
		// eye, which is exactly how `dprint` sat under "parse + format" alone.
		assert.strictEqual(
			categorize_size_capability('dprint (wasm)'),
			categorize_size_capability('malva (wasm)')
		);
	});
});

// The per-row file-set-mismatch annotation (the site rendering of the composer's
// `⚠ files a/b/c`), on a synthetic report since the committed one is healthy.
describe('derive_cross_runtime_groups files_iterated_mismatch', () => {
	const report = (
		files_iterated: CrossRuntimeReport['rows'][number]['files_iterated']
	): CrossRuntimeReport => ({
		version: 7,
		kind: 'combined',
		generated: '2026-01-01T00:00:00.000Z',
		runtimes: ['deno', 'node', 'bun'],
		sources: [],
		rows: [
			{
				group: 'parse/typescript',
				name: 'tsv-json',
				ops_per_second: { deno: 1, node: 2, bun: 3 },
				mean_ns: { deno: 3, node: 2, bun: 1 },
				files_iterated
			}
		]
	});

	const derive_row = (files_iterated: CrossRuntimeReport['rows'][number]['files_iterated']) =>
		derive_cross_runtime_groups(report(files_iterated))[0]!.rows[0]!;

	test('equal counts across runtimes derive null', () => {
		assert.isNull(derive_row({ deno: 767, node: 767, bun: 767 }).files_iterated_mismatch);
	});

	test('unequal counts surface the raw per-runtime counts', () => {
		const mismatch = { deno: 765, node: 767, bun: 767 };
		assert.deepStrictEqual(derive_row(mismatch).files_iterated_mismatch, mismatch);
	});

	test('a null count (untimed runtime) is not a mismatch by itself', () => {
		assert.isNull(derive_row({ deno: null, node: 767, bun: 767 }).files_iterated_mismatch);
	});
});

// Shape gate for the CLI report `benchmarks_cli.ts` derives from the generated
// `benchmarks_formatters.json`. The generator parses prose, so a drifted heading
// or scenario id in the harness's README would silently drop a scenario or its
// `tsv` reference row and render an empty table rather than fail to typecheck.
describe('benchmarks_cli shape', () => {
	test('every scenario the page has prose for resolved to generated data, in prose order', () => {
		// a copy entry with no matching scenario id drops silently from the table, so
		// every entry must resolve — an aborted scenario resolves too, it just
		// renders its abort note instead of a table
		assert.deepEqual(
			benchmarks_cli.scenarios.map((s) => s.key),
			CLI_SCENARIO_KEYS
		);
	});

	test('the TypeScript-repo scenario the prose quotes resolved to generated data', () => {
		assert.ok(
			benchmarks_cli.scenarios.some((s) => s.key === CLI_TS_REPO_KEY),
			`no generated scenario has id "${CLI_TS_REPO_KEY}" — did the harness rename it?`
		);
	});

	test('every timed scenario carries a tsv reference row with positive metrics', () => {
		assert.isAtLeast(benchmarks_cli.scenarios.length, 1);
		for (const scenario of benchmarks_cli.scenarios) {
			// an aborted scenario carries its note; one aborted before timing has no
			// rows to anchor, one aborted in its memory pass keeps its timed rows
			if (scenario.aborted !== undefined) {
				assert.isNotEmpty(scenario.aborted, `${scenario.key} aborted without a note`);
				if (scenario.results.length === 0) continue;
			}
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
			if (scenario.timings.length === 0) {
				// aborted before timing: no baseline and nothing to cross-check
				assert.isDefined(scenario.aborted, `${scenario.id} has no timings and no abort`);
				assert.isEmpty(scenario.speedups, `${scenario.id} aborted but carries speedups`);
				continue;
			}
			assert.strictEqual(scenario.baseline, 'tsv', `${scenario.id} baseline`);
			// from the raw timings, not the rendered report: the generated data also
			// carries tsv scenarios the page has no copy for, and their numbers must
			// parse just as soundly
			const tsv = scenario.timings.find((t) => t.name === 'tsv');
			assert(tsv, `${scenario.id} has no tsv timing row`);
			for (const speedup of scenario.speedups) {
				const other = scenario.timings.find((t) => t.name === speedup.name);
				assert(other, `${scenario.id}/${speedup.name} has no timing row`);
				const derived = other.mean_ms / tsv.mean_ms;
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

	test('every formatter accepts the whole corpus in every timed scenario, as the page claims', () => {
		// The page's notes say the preflight parse check found nothing rejected, so
		// no formatter is credited for skipping files. That's a claim about the data —
		// for the scenarios that were timed. An aborted one is the harness saying the
		// opposite, and the page shows it as an abort, so its rows are exempt.
		for (const scenario of benchmarks_formatters_json.scenarios) {
			assert.isNotEmpty(scenario.preflight, `${scenario.id} ran no preflight`);
			// aborted before timing — its rows are the fault, shown as such
			if (scenario.timings.length === 0) continue;
			for (const entry of scenario.preflight) {
				assert.isFalse(entry.crashed, `${scenario.id}/${entry.name} crashed during its check`);
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
	// `[group, slower, faster]` in the direction each sentence reads — the copy says
	// "X faster than" for the pairs tsv leads and "slower than" / "Y is faster than
	// tsv" for the ones it trails (yuku on TypeScript, the JS parsers on CSS), so
	// every ratio here must land above 1 or the sentence has flipped.
	const IN_PROCESS_PAIRS: Array<[string, string, string]> = [
		['format/typescript', 'oxfmt', 'tsv'],
		['format/typescript', 'prettier', 'tsv'],
		['format/typescript', 'biome-wasm', 'tsv_wasm'],
		['format/svelte', 'prettier', 'tsv'],
		['format/svelte', 'biome-wasm', 'tsv_wasm'],
		['format/css', 'oxfmt', 'tsv'],
		['format/css', 'biome-wasm', 'tsv_wasm'],
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
		// the TLDR's "less memory than either" range, scoped to the tools it names
		assert.isDefined(cli_memory_ratio_range(CLI_TS_REPO_KEY, ['oxfmt', 'biome']));
		assert.isDefined(cli_memory_ratio_range());
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
		assert(wasm, 'delivery scenario has no tsv_wasm row');
		for (const label of ['prettier', 'prettier + oxc-parser']) {
			const js = single.results.find((r) => r.label === label);
			assert(js, `large-single-file has no ${label} row`);
			assert.isBelow(wasm.wall_ms, js.wall_ms, `tsv_wasm vs ${label}`);
		}
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

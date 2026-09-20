import { assert, describe, test } from 'vitest';

import { benchmarks_json } from '$routes/docs/benchmarks/benchmarks.ts';
import { benchmarks_conformance_json } from '$routes/docs/benchmarks/benchmarks_conformance.ts';
import { benchmarks_cross_runtime_json } from '$routes/docs/benchmarks/benchmarks_cross_runtime.ts';
import {
	categorize_name,
	derive_benchmark_groups,
	derive_conformance_groups,
	derive_speedup_summary
} from '$routes/docs/benchmarks/benchmark_data.ts';
import { categorize_size } from '$routes/docs/benchmarks/benchmark_sizes.ts';

// The report shape version the committed copies are pinned to — tsv's
// `REPORT_SCHEMA_VERSION`, shared by the per-runtime and conformance reports. Exact
// rather than a floor, so `npm run update-benchmarks` pulling a newer shape fails
// here until `benchmark_data.ts` mirrors the new fields and this is re-pinned.
const REPORT_VERSION = 16;

// Shape gate for the committed benchmarks.json: the bench report format drifts,
// and `benchmarks.ts` casts the JSON, so typechecking alone won't catch a renamed
// key — it renders as `undefined` instead.
// When `npm run update-benchmarks` pulls in a new shape, these fail loudly.
describe('benchmarks.json shape', () => {
	test('baseline version is current', () => {
		// pinned exactly: a bump in tsv's `REPORT_SCHEMA_VERSION` must be a deliberate
		// re-pin here, after `benchmark_data.ts` gains the new fields' version-notes
		assert.strictEqual(benchmarks_json.version, REPORT_VERSION);
	});

	test('versions carries the keys the meta component renders', () => {
		const { versions } = benchmarks_json;
		assert.isString(versions.svelte);
		assert.isString(versions.acorn_ts);
		assert.isString(versions.prettier);
		assert.isString(versions.prettier_svelte);
	});

	test('omissions account for exactly what each timed set leaves out', () => {
		// every timed group is listed. Required rather than skipped when absent: the
		// producer also omits the field on a `BENCH_MODE=union` run, and a report copied
		// from one must fail here rather than switch the gate off
		const { omissions } = benchmarks_json;
		assert.isDefined(omissions, 'an intersection-mode perf report carries omissions');
		for (const group of derive_benchmark_groups(benchmarks_json)) {
			const key = `${group.operation}/${group.language}`;
			const reported = omissions.find((o) => o.group === key);
			assert.ok(reported, `${key} has no omissions entry`);
			// the timed set is the group's files minus the ones some timed row failed
			assert.strictEqual(
				reported.files_total - reported.omitted_files,
				group.files_iterated,
				`${key}: files_total − omitted_files is the timed set`
			);
			// no omit tolerates a failure of tsv's own — every one excuses a rival's gap
			for (const tool of reported.by_tool) {
				assert.notProperty(tool.categories, 'tsv_failure', `${key}/${tool.name}`);
				assert.notProperty(tool.categories, 'unlisted', `${key}/${tool.name}`);
			}
		}
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
			// the timed set is the group's intersection, so every timed row saw the
			// same count — the one the chart heading quotes
			for (const entry of benchmarks_json.entries) {
				if (entry.group !== key || entry.files_iterated == null) continue;
				assert.strictEqual(entry.files_iterated, group.files_iterated, `${key}/${entry.name}`);
			}
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
		// (the page's dprint note is unconditional, so the report must carry the row)
		const ts_dprint = dprint_rows('typescript');
		assert.isNotEmpty(ts_dprint, 'typescript format must carry a dprint row');
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
		// the page's rsvelte-fmt note is unconditional, so the report must carry the row
		const rsvelte = svelte_format.entries.find((e) => e.name === 'rsvelte-fmt');
		assert.ok(rsvelte, 'svelte format must carry the rsvelte-fmt row');

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
			return 10; // tsv's engine rows (`tsv`/`tsv-wasm`, `-internal`)
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

	test('speedup summary is fully populated, and every cell reads "faster than Prettier"', () => {
		const rows = derive_speedup_summary(derive_benchmark_groups(benchmarks_json));
		assert.strictEqual(rows.length, 2); // native + wasm
		for (const row of rows) {
			// `BenchmarksSummary` captions the table as how much faster tsv is than
			// Prettier, so a cell below 1 would render a slowdown under that caption
			for (const [language, value] of [
				['svelte', row.format_svelte],
				['typescript', row.format_typescript],
				['css', row.format_css]
			] as const) {
				assert.isDefined(value, `${row.variant} ${language}`);
				assert.isAbove(value, 1, `${row.variant} ${language}`);
			}
		}
	});

	test('flagship report is the node runtime', () => {
		// the headline detailed view switched to N-API under Node; guards against an
		// `update-benchmarks` that pulls the wrong runtime's sibling report
		assert.strictEqual(benchmarks_json.runtime, 'node');
	});

	test('the report records no binding disagreement, load failure, or ungraded output', () => {
		// each is `[]`/`{}` when healthy, and `benchmark_data.ts` calls a non-empty one a
		// bug in the producing bench — a load failure removes the impl's rows from the
		// charts with no placeholder, and a native/wasm disagreement means the byte-parity
		// claim is false. This is the gate, rather than a reviewer's eye on the copied
		// report's diff.
		assert.deepStrictEqual(benchmarks_json.variant_parity, []);
		assert.deepStrictEqual(benchmarks_json.unavailable, []);
		assert.deepStrictEqual(benchmarks_json.output_digest_ungraded, {});
		// the size table's composition disclosure: a build the bench expected but
		// didn't find on disk drops its row silently, and the page renders no note
		// for it, so an absent one has to fail here
		assert.deepStrictEqual(benchmarks_json.binary_sizes_absent ?? [], []);
	});

	test('every timed row carries the sweep counts the details prose quotes', () => {
		// `+page.svelte` reads the sweep floor and the cleaned sample-size span off
		// every timed entry; a report without them would print `Infinity` mid-sentence
		for (const entry of benchmarks_json.entries) {
			if (entry.mean_ns == null) continue;
			const label = `${entry.group}/${entry.name}`;
			assert.isAbove(entry.min_iterations ?? 0, 0, label);
			assert.isAbove(entry.sample_size ?? 0, 0, label);
		}
	});

	test('every report row and size label maps to an explicit category', () => {
		// `categorize_name` and `categorize_size` fall back to `'oxc'` for anything they
		// don't recognize, so a new upstream row would silently render in oxc's hue
		// rather than fail. Only the genuinely-oxc names may land on that fallback.
		for (const entry of benchmarks_json.entries) {
			assert.ok(
				categorize_name(entry.name) !== 'oxc' ||
					entry.name.includes('oxc') ||
					entry.name === 'oxfmt',
				`${entry.group}/${entry.name} falls back to the oxc hue`
			);
		}
		for (const row of benchmarks_cross_runtime_json.rows) {
			assert.ok(
				categorize_name(row.name) !== 'oxc' || row.name.includes('oxc') || row.name === 'oxfmt',
				`${row.group}/${row.name} falls back to the oxc hue`
			);
		}
		for (const { label } of benchmarks_json.binary_sizes) {
			assert.ok(
				categorize_size(label) !== 'oxc' || label.startsWith('oxc') || label.startsWith('oxfmt'),
				`${label} falls back to the oxc hue`
			);
		}
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

	test('every impl loaded, and no byte-graded pair disagreed on output', () => {
		// an accept-set disagreement between two bindings of one engine is legitimate
		// here (oxc-parser's pinned-older wasm binding — the prose test bounds it), but a
		// byte mismatch between tsv's own native and wasm rows contradicts the section's
		// "byte-identical output" claim, and a load failure silently drops a coverage row
		assert.deepStrictEqual(benchmarks_conformance_json.unavailable, []);
		for (const finding of benchmarks_conformance_json.variant_parity ?? []) {
			assert.strictEqual(finding.output_mismatch ?? 0, 0, `${finding.group}/${finding.impl}`);
		}
	});

	test('every impl of a per-source slice reports the same slice total', () => {
		// `derive_conformance_slice` reads the slice total off the first impl, and
		// the share prose (`~81% of it is the test262 slice`) rests on it
		for (const [group, sources] of Object.entries(
			benchmarks_conformance_json.coverage_by_source ?? {}
		)) {
			for (const [source, by_impl] of Object.entries(sources)) {
				const totals = new Set(Object.values(by_impl).map((cell) => cell.total));
				assert.strictEqual(totals.size, 1, `${group} ${source}: ${[...totals].join(', ')}`);
			}
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
				// the group header is the max across rows, which reads as the language's
				// total only while every row saw the same corpus
				assert.strictEqual(row.files_total, group.files_total, `${group.language}/${row.name}`);
				assert.isAtLeast(row.coverage_fraction, 0);
				assert.isAtMost(row.coverage_fraction, 1);
				// engine-level rows only — binding/materialization variants are folded
				assert.notMatch(row.name, /-internal|wasm-|-wasm/, `${group.language}/${row.name}`);
			}
		}
	});

	test('every engine the report carries reaches a coverage row', () => {
		// The rows are keyed by ONE entry name per engine (`CONFORMANCE_ENGINE_NAMES`),
		// so a harness that renames or re-picks a binding — yuku's native row
		// returning, oxc's wasi pin rejoining — would drop an engine from the table
		// without a type error. Fold each entry to its engine by stripping the
		// binding/materialization suffixes and hold the row count to that set.
		const to_engine = (name: string) =>
			name.replace(/-(wasm|json|no-locations|internal|skip-expr-loc)/g, '');
		const groups = derive_conformance_groups(benchmarks_conformance_json);
		for (const group of groups) {
			const engines = new Set(
				benchmarks_conformance_json.entries
					.filter((e) => e.group === `parse/${group.language}`)
					.map((e) => to_engine(e.name))
			);
			assert.strictEqual(
				group.rows.length,
				engines.size,
				`${group.language}: rows for ${[...engines].join(', ')}`
			);
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
});

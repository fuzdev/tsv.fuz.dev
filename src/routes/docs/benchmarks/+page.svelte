<script lang="ts">
	// the classes this page's components share, which scoped `<style>` can't reach
	// across — imported here so they ship with this route, not with every one
	import './benchmarks.css';

	import { page } from '$app/state';
	import Details from '@fuzdev/fuz_ui/Details.svelte';
	import TomeContent from '@fuzdev/fuz_ui/TomeContent.svelte';
	import TomeLink from '@fuzdev/fuz_ui/TomeLink.svelte';
	import TomeSection from '@fuzdev/fuz_ui/TomeSection.svelte';
	import TomeSectionHeader from '@fuzdev/fuz_ui/TomeSectionHeader.svelte';
	import { DOCS_PATH, docs_slugify } from '@fuzdev/fuz_ui/docs_helpers.svelte.ts';
	import { tome_get_by_slug } from '@fuzdev/fuz_ui/tome.ts';

	import { benchmarks_json } from './benchmarks.ts';
	import { benchmarks_cross_runtime_json } from './benchmarks_cross_runtime.ts';
	import {
		benchmarks_cli,
		cli_corpora_commit,
		cli_scenario_find,
		cli_ratio_vs_tsv,
		cli_ratio_vs_tsv_npm,
		CLI_TS_REPO_KEY,
		CLI_SVELTE_KEY
	} from './benchmarks_cli.ts';
	import {
		benchmark_speedup,
		benchmark_time_share_beyond,
		corpus_repo_ref_commit,
		corpus_repo_ref_url,
		CORPUS_SOURCE_LABELS,
		derive_benchmark_groups,
		derive_corpus_counts,
		derive_corpus_source_table,
		derive_sweep_stats,
		derive_unstable_entries
	} from './benchmark_data.ts';
	import {
		format_count,
		format_count_maybe,
		format_ratio_approx,
		format_runtime_display,
		format_share_approx,
		format_unstable_readings
	} from './benchmark_display.ts';
	// the size-chart row names the notes below refer to, from the module that
	// builds the rows, so prose and chart can't drift apart
	import {
		derive_size_targets,
		OXC_FULL_LABEL,
		OXFMT_NATIVE_LABEL,
		RSVELTE_LABEL
	} from './benchmark_sizes.ts';
	import { derive_tool_matrix } from './benchmark_tools.ts';
	import { IN_PROCESS_PAIRS } from './benchmarks_prose.ts';
	import BenchmarksGroup from './BenchmarksGroup.svelte';
	import BenchmarksSizes from './BenchmarksSizes.svelte';
	import BenchmarksMeta from './BenchmarksMeta.svelte';
	import BenchmarksCorpus from './BenchmarksCorpus.svelte';
	import BenchmarksCrossRuntime from './BenchmarksCrossRuntime.svelte';
	import BenchmarksCliSection from './BenchmarksCliSection.svelte';
	import BenchmarksTools from './BenchmarksTools.svelte';

	const LIBRARY_ITEM_NAME = 'benchmarks';

	const tome = tome_get_by_slug(LIBRARY_ITEM_NAME);

	// the `/docs` index renders every tome, so there this one is a link, as the playground's is
	const at_root = $derived(page.url.pathname === DOCS_PATH);

	// Section titles referenced by in-page anchors, slugified the same way
	// `TomeSectionHeader` builds its ids so a rename can't orphan a link.
	const LANGUAGE_SECTION_TITLE = 'Language support';
	const PARSE_SECTION_TITLE = 'Parse speed';
	const CLI_SECTION_TITLE = 'End-to-end CLI benchmark';
	const DETAILS_SECTION_TITLE = 'Benchmarking details';
	const CORPUS_SECTION_TITLE = 'Corpus';
	const CROSS_RUNTIME_SECTION_TITLE = 'Cross-runtime';

	// The benchmarked runtime and its version, read from the report itself so the
	// prose tracks each data refresh.
	const node_display = format_runtime_display(benchmarks_json);

	const groups = derive_benchmark_groups(benchmarks_json);
	// what each tool parses and formats, with the cells this page times marked from the reports
	const tool_matrix = derive_tool_matrix(benchmarks_json, benchmarks_cli);
	const size_targets = derive_size_targets(benchmarks_json.binary_sizes);
	const corpus = benchmarks_json.corpus;
	// Read off the report so the Corpus section's figures can't drift from the
	// copied data; the harvest is disclosed beside the file count rather than netted
	// out of it, and quoted only when the report distinguishes it.
	const corpus_counts = derive_corpus_counts(benchmarks_json);
	const corpus_source_table = derive_corpus_source_table(benchmarks_json, CORPUS_SOURCE_LABELS);
	// the one repo that vendors every source, linked at the commit the report measured
	const corpus_snapshot = benchmarks_json.corpus_snapshot;
	const corpus_snapshot_url = corpus_snapshot
		? corpus_repo_ref_url(corpus_snapshot)
		: 'https://github.com/fuzdev/corpora';
	const corpus_snapshot_commit = corpus_snapshot && corpus_repo_ref_commit(corpus_snapshot);
	// The rows the report itself flagged as unstable (see `is_entry_unstable`) —
	// disclosed above the format charts, since every ratio through one divides its mean.
	const unstable_entries = derive_unstable_entries(benchmarks_json);
	const format_groups = groups.filter((g) => g.operation === 'format');
	const parse_groups = groups.filter((g) => g.operation === 'parse');
	// How many timed sweeps stand behind each row: the bench's per-row floor, and the
	// span of cleaned counts it actually kept — the slow rows stop near the floor, so
	// a quiet cv there rests on a handful of timings.
	// (the shape tests require every timed row to carry both fields; the `—`
	// fallback keeps a report without them readable)
	const sweeps = derive_sweep_stats(benchmarks_json);
	// the reference rows' floor is quoted only while it differs from the rest's
	const canonical_floor_note =
		sweeps.canonical_floor === sweeps.floor
			? ''
			: ` (${format_count_maybe(sweeps.canonical_floor)} for each group's reference row)`;

	// Every ratio the TLDR and the section notes quote, computed from the same
	// reports the charts render so the prose can't drift from them. The pairings and
	// their directions live in `benchmarks_prose.ts`, which the prose test gates.
	const speedup = (key: keyof typeof IN_PROCESS_PAIRS) => {
		const [group, slower, faster] = IN_PROCESS_PAIRS[key];
		return format_ratio_approx(benchmark_speedup(benchmarks_json, group, slower, faster));
	};
	const format_ts_vs_oxfmt = speedup('format_ts_vs_oxfmt');
	const format_ts_vs_prettier = speedup('format_ts_vs_prettier');
	const format_ts_vs_biome = speedup('format_ts_vs_biome');
	const format_svelte_vs_prettier = speedup('format_svelte_vs_prettier');
	const format_svelte_vs_biome = speedup('format_svelte_vs_biome');
	const format_css_vs_oxfmt = speedup('format_css_vs_oxfmt');
	const format_css_vs_prettier = speedup('format_css_vs_prettier');
	const format_css_vs_biome = speedup('format_css_vs_biome');
	const parse_ts_vs_oxc = speedup('parse_ts_vs_oxc');
	// tsv's default `loc`-bearing wire against the reference parser it's a drop-in for
	const parse_ts_vs_acorn = speedup('parse_ts_vs_acorn');
	// What tsv's default per-node `loc` costs over its span-only wire, same engine.
	const parse_ts_loc_cost = speedup('parse_ts_loc_cost');
	const parse_ts_yuku_vs_tsv = speedup('parse_ts_yuku_vs_tsv');
	// Svelte and CSS pair tsv's default `loc`-bearing wire with the JS parsers it
	// is a drop-in for (and rsvelte's, which carries the same payload). CSS runs
	// against tsv, so those two are quoted in that direction.
	const parse_svelte_vs_compiler = speedup('parse_svelte_vs_compiler');
	const parse_svelte_vs_rsvelte = speedup('parse_svelte_vs_rsvelte');
	const parse_css_compiler_vs_tsv = speedup('parse_css_compiler_vs_tsv');
	const parse_css_postcss_vs_tsv = speedup('parse_css_postcss_vs_tsv');
	// The JSON hand-off's share of tsv's CSS parse row: everything the JSON wire
	// costs beyond the internal row, which builds the same AST and stops.
	const parse_css_wire_share = format_share_approx(
		benchmark_time_share_beyond(benchmarks_json, 'parse/css', 'tsv-json', 'tsv-internal')
	);
	// rsvelte's parse addon targets its own upstream Svelte, which can sit a release
	// apart from the pin the svelte/compiler row runs — said only while the two differ
	const svelte_version = benchmarks_json.versions.svelte;
	const rsvelte_svelte_target = benchmarks_json.versions.rsvelte_parse_svelte_target;

	// The end-to-end CLI claims the TLDR quotes, from the formatter-comparison report;
	// the CLI section computes its own. tsv through its Node dispatcher against the other
	// tools' npm bins is the like-for-like footing the claims lead with; the bare-binary
	// ratios follow as what the binary does without a Node launcher in front.
	const cli_npm_ratio = (scenario: string, label: string) =>
		format_ratio_approx(cli_ratio_vs_tsv_npm(scenario, label, 'wall_ms'));
	const cli_npm_ts_vs_oxfmt = cli_npm_ratio(CLI_TS_REPO_KEY, 'oxfmt');
	const cli_npm_ts_vs_biome = cli_npm_ratio(CLI_TS_REPO_KEY, 'biome');
	const cli_ts_wall_vs_oxfmt = format_ratio_approx(
		cli_ratio_vs_tsv(CLI_TS_REPO_KEY, 'oxfmt', 'wall_ms')
	);
	const cli_ts_wall_vs_biome = format_ratio_approx(
		cli_ratio_vs_tsv(CLI_TS_REPO_KEY, 'biome', 'wall_ms')
	);
	// The Svelte head-to-head is published aborted if rsvelte-fmt crashes in the
	// harness, so its ratios can be absent while the scenario itself is present —
	// the prose covers both cases, gated on the very ratio the sentence quotes so
	// the two can't disagree.
	const cli_svelte = cli_scenario_find(CLI_SVELTE_KEY);
	const cli_svelte_npm_ratio = cli_ratio_vs_tsv_npm(CLI_SVELTE_KEY, 'rsvelte-fmt', 'wall_ms');
	const cli_svelte_timed = cli_svelte_npm_ratio !== undefined;
	const cli_svelte_npm_wall = format_ratio_approx(cli_svelte_npm_ratio);
	// The CLI's Svelte corpus comes from the same fuzdev/corpora repo as this page's,
	// possibly at another commit — said only while the two differ (either may be
	// abbreviated, so they're compared by prefix).
	const cli_svelte_corpora_commit = cli_svelte && cli_corpora_commit(cli_svelte.corpus);
	const corpus_snapshot_full_commit = corpus_snapshot?.commit;
	const cli_svelte_pin_differs =
		!!cli_svelte_corpora_commit &&
		!!corpus_snapshot_full_commit &&
		!corpus_snapshot_full_commit.startsWith(cli_svelte_corpora_commit) &&
		!cli_svelte_corpora_commit.startsWith(corpus_snapshot_full_commit);
</script>

<TomeContent {tome}>
	{#if at_root}
		<section>
			<p>
				The <TomeLink slug="benchmarks" /> compare tsv's speed and size with Prettier, Oxc, Biome,
				and others.
			</p>
		</section>
	{:else}
		<section>
			<p>
				tsv is a Rust toolchain of parsers and formatters for TypeScript/JS, CSS, and Svelte. Its
				formatter closely follows <a href="https://prettier.io/">Prettier</a> and borrows its
				architectural patterns, and we're grateful for the hard work of Prettier's
				<a href="https://github.com/prettier/prettier/graphs/contributors">contributors</a>. After
				correctness tsv prioritizes performance and efficiency: this page measures its speed and
				size on real-world code, and the <TomeLink slug="conformance" /> page compares parser
				coverage on deliberately hard test suites.
			</p>
			<p>
				This page compares tsv to Prettier and the JS parsers it replaces (svelte/compiler and
				acorn-typescript), and to Oxc and Biome, similar tools with more features, configurable
				styles, and wider language support. It also measures rsvelte, yuku-parser, swc, dprint,
				Malva, and PostCSS;
				<a href="#{docs_slugify(LANGUAGE_SECTION_TITLE)}">{LANGUAGE_SECTION_TITLE}</a> lays out what
				each parses and formats.
			</p>
		</section>

		<TomeSection>
			<TomeSectionHeader text="tldr" />
			<p>
				Compared to Oxc and Biome, tsv ships smaller artifacts, capability for capability, and
				formats its three languages faster in every pairing measured here, while lacking their
				features and language breadth.
			</p>
			<p>
				Except in the CLI section, every timing here is in-process and one file at a time, isolating
				engine speed from multi-core parallelism. The corpus is {format_count(corpus_counts.files)}
				files of real-world code, the author's own and Svelte's (see
				<a href="#{docs_slugify(CORPUS_SECTION_TITLE)}">Corpus</a>), timed under {node_display}.
			</p>
			<ul>
				<li>
					Formatting TypeScript, tsv is ~{format_ts_vs_oxfmt} faster than Oxfmt (native-vs-native),
					~{format_ts_vs_prettier} faster than Prettier (native Rust vs Prettier's JS), and
					~{format_ts_vs_biome} faster than Biome (wasm-vs-wasm).
				</li>
				<li>
					Formatting Svelte, tsv is ~{format_svelte_vs_prettier} faster than Prettier and
					~{format_svelte_vs_biome} faster than Biome, same pairings. Neither Oxc nor Biome ships a
					dedicated Svelte formatter: Oxfmt delegates Svelte to Prettier, and Biome's row is its
					experimental HTML path, which leaves template expressions as written.
				</li>
				<li>
					Formatting CSS, it's ~{format_css_vs_oxfmt} faster than Oxfmt, ~{format_css_vs_prettier}
					faster than Prettier, and ~{format_css_vs_biome} faster than Biome, same pairings.
				</li>
				<li>
					Parsing TypeScript, native tsv's span-only AST is ~{parse_ts_vs_oxc} faster than Oxc's and
					~{parse_ts_yuku_vs_tsv} slower than yuku-parser's. Its default AST adds per-node
					line/column <code>loc</code> for drop-in acorn and Svelte compatibility, at
					~{parse_ts_loc_cost} the span-only time: ~{parse_ts_vs_acorn} faster than
					acorn-typescript, the parser it replaces, but behind Oxc and swc. That AST is checked
					against acorn's and Svelte's at corpus scale, but hasn't yet been fed through Svelte's
					compiler end to end.
				</li>
				<li>
					Parsing Svelte, that default AST is ~{parse_svelte_vs_compiler} faster than
					svelte/compiler (JS) and ~{parse_svelte_vs_rsvelte} faster than rsvelte
					(native-vs-native).
				</li>
				<li>
					Parsing CSS runs the other way: Svelte's own <code>parseCss</code> is
					~{parse_css_compiler_vs_tsv} faster than tsv's default AST and PostCSS
					~{parse_css_postcss_vs_tsv} faster, since JS parsers skip the serialization tsv pays for
					(see <a href="#{docs_slugify(PARSE_SECTION_TITLE)}">{PARSE_SECTION_TITLE}</a>).
				</li>
				<li>
					End to end as a CLI, in a
					<a href="https://github.com/ryanatkn/oxc-bench-formatter" rel="external">
						fork of Oxc's <code>bench-formatter</code>
					</a>
					with every tool launched through its npm package's Node bin, tsv formats the JSX-free
					subset of a real TypeScript repo ~{cli_npm_ts_vs_oxfmt} faster than Oxfmt and
					~{cli_npm_ts_vs_biome} faster than Biome, using less memory than either; its bare binary,
					skipping Node, is ~{cli_ts_wall_vs_oxfmt} and ~{cli_ts_wall_vs_biome} faster. These are
					wall-clock ratios, so they bake in each tool's multi-file parallelism (see
					<a href="#{docs_slugify(CLI_SECTION_TITLE)}">the CLI section</a>).
				</li>
				{#if cli_svelte_timed}
					<li>
						On a third-party Svelte corpus, tsv's CLI, again through its Node bin, is
						~{cli_svelte_npm_wall} faster than rsvelte-fmt, another Rust Svelte formatter, though
						rsvelte-fmt's time includes an Oxfmt pass that finds nothing to format.
					</li>
				{:else if cli_svelte?.aborted}
					<li>
						The CLI's Svelte head-to-head against rsvelte-fmt, another Rust Svelte formatter,
						currently publishes no numbers: the harness aborted it.
					</li>
				{/if}
			</ul>
		</TomeSection>

		<TomeSection>
			<TomeSectionHeader text={LANGUAGE_SECTION_TITLE} />
			<BenchmarksTools rows={tool_matrix} />
		</TomeSection>

		<TomeSection>
			<TomeSectionHeader text="Format speed" />
			<p>
				tsv formats JS with its TypeScript parser, so JS and TypeScript share one chart. Each
				chart's ratios are against its highlighted row — hover another row to re-anchor them — and a
				minus means that many times worse.
			</p>
			{#if unstable_entries.length}
				<aside class="benchmarks-warning">
					⚠ Some rows in the {node_display} report were not measured stably, so the ratios through
					them are unreliable:
					<ul>
						{#each unstable_entries as entry (entry.group + '/' + entry.name)}
							<li>
								<code>{entry.group}/{entry.name}</code> — {format_unstable_readings(entry)}
							</li>
						{/each}
					</ul>
					A drift is a cost that moved while the row was being measured, which the cleaned cv cannot
					see (negative: the row got faster, still warming up; positive: slower, degrading); the
					number published for such a row is a mean that may sit between two modes.
				</aside>
			{/if}
			{#each format_groups as group (group.language)}
				<BenchmarksGroup {group} />
			{/each}
			<aside>
				<p>Notes:</p>
				<ul>
					<li>
						Each format row times the tool's own parse too: source in, formatted text out.
						Wasm-vs-wasm and native-vs-native (N-API here) are the like-for-like pairings, and the
						<code>tsv-wasm</code> rows run the full parse+format build, not the smaller format-only
						or parse-only ones.
					</li>
					<li>
						Every formatter is pinned to tsv's fixed style (width 100, tabs, single quotes, no
						trailing commas) in its own option dialect, so each row does comparable layout work; the
						harness spot-checks the pins at startup. Nothing grades output against an oracle: the
						bench checks that output is non-empty and that tsv's native and wasm builds agree byte
						for byte, so a tool emitting wrong output quickly would still read as fast. tsv's own
						output is checked against Prettier's in
						<a href="https://github.com/fuzdev/tsv/blob/main/docs/conformance_prettier.md">
							its repo's conformance gates
						</a>, separately from timing.
					</li>
					<li>
						Every tool that takes a filename gets a synthetic one (<code>file.ts</code>,
						<code>file.css</code>, <code>file.svelte</code>), so every row formats the corpus's
						<code>.js</code> files as TypeScript, Prettier included (a real Prettier run would hand
						<code>.js</code> to its Babel parser; which way that moves Prettier's time is
						unmeasured).
					</li>
					<li>
						Oxfmt formats TypeScript, JS, and CSS with its own native engine but delegates Svelte to
						its bundled Prettier and
						<a href="https://github.com/sveltejs/prettier-plugin-svelte">prettier-plugin-svelte</a>:
						only the embedded <code>&lt;script&gt;</code> reaches its native engine, while the
						markup, its expressions, and the <code>&lt;style&gt;</code> are that Prettier's.
					</li>
					<li>
						Biome has no dedicated Svelte formatter: its Svelte row runs with
						<code>html.experimentalFullSupportEnabled</code>, the experimental HTML-superset
						pipeline that formats the markup, script, and style (without the flag it returns only
						the formatted script). It parses the template's expressions but leaves them as written,
						where Prettier and tsv reprint them, so its Svelte row does somewhat less work than
						theirs. Its in-process API's only format entry point, <code>formatContent</code>, also
						opens the file in its workspace, pulls syntax diagnostics, and closes it on every call,
						so its rows carry that wrapper. The harness also swaps in a fresh wasm instance once its
						memory has grown past a threshold — before every sweep in the Svelte and TypeScript
						groups, every few in CSS — and that instance's slower first sweep adds about 1–4% to
						Biome's rows. There's no native Biome entry: its in-process API,
						<code>@biomejs/js-api</code>, runs only on its wasm builds, and the native engine ships
						only as the <code>biome</code> CLI, a separate process rather than a library, which the
						<a href="#{docs_slugify(CLI_SECTION_TITLE)}">CLI section</a> times.
					</li>
					<li>
						The dprint entry is
						<a href="https://dprint.dev/plugins/typescript/">dprint-plugin-typescript</a>, the
						engine <code>deno fmt</code> runs for TypeScript and JS, loaded in-process as its wasm
						plugin. It formats only TypeScript and JS (JSX included), and no dprint markup plugin is
						wired in, so it has no Svelte row and its CSS slot goes to
						<a href="https://github.com/g-plane/malva">Malva</a>, a third-party CSS plugin for the
						same host. This times the engine, not the <code>deno fmt</code> CLI.
					</li>
					<li>
						<a href="https://github.com/baseballyama/rsvelte" rel="external">rsvelte-fmt</a>, the
						other Rust-native Svelte formatter here, is grayed out in the Svelte group: the harness
						runs it over every Svelte file to check coverage but doesn't time it, since it ships no
						in-process API and a process per file would measure spawn rather than formatting.
						{#if cli_svelte_timed}
							The <a href="#{docs_slugify(CLI_SECTION_TITLE)}">CLI section</a> times it.
						{:else if cli_svelte?.aborted}
							Its run in the <a href="#{docs_slugify(CLI_SECTION_TITLE)}">CLI section</a> is
							currently aborted rather than timed.
						{/if}
					</li>
				</ul>
			</aside>
		</TomeSection>

		<TomeSection>
			<TomeSectionHeader text={PARSE_SECTION_TITLE} />
			<p>
				tsv and <a href="https://oxc.rs/docs/guide/usage/parser">oxc-parser</a> share a mechanism:
				both serialize the AST to JSON in Rust and hand it to the JS engine's
				<code>JSON.parse</code>, native and wasm alike. The deliverables differ: tsv's default wire
				(<code>tsv json</code> / <code>tsv-wasm json</code>) carries a per-node <code>loc</code>
				(line/column) object that oxc-parser's span-only AST omits, at ~{parse_ts_loc_cost} the time
				without it on the TypeScript corpus. The <code>no-locs</code> entries drop it for a
				span-only wire of Oxc's kind, so they are the payload-matched comparison with oxc-parser,
				though the shapes still differ in detail. The <code>internal</code> entries build tsv's
				in-Rust AST and stop — no serialization, nothing materialized in JS — so they show raw
				engine speed, and their gap to the <code>json</code> entries is what serializing and handing
				off costs tsv, not a cross-tool comparison.
			</p>
			<p>
				yuku-parser, a JS/TS parser written in Zig, emits the same span-only AST as Oxc, so it too
				compares against the <code>no-locs</code> entries. It hands JS a compact binary buffer that
				decodes into objects when its <code>program</code> is read, so the bench reads it to time
				the same fully materialized result. swc's AST (a <code>Module</code> root with
				<code>span</code> offsets) matches neither tsv wire.
			</p>
			{#each parse_groups as group (group.language)}
				<BenchmarksGroup {group} />
			{/each}
			<aside>
				<p>Notes:</p>
				<ul>
					<li>
						Parsers written in JS skip the Rust-to-JS serialization tsv and Oxc pay for, which keeps
						them competitive — and on CSS that decides the order: the JSON hand-off is
						~{parse_css_wire_share} of tsv's time there (the gap to the internal row), and CSS is a
						simple enough grammar that Svelte's <code>parseCss</code> and PostCSS both finish ahead
						of <code>tsv json</code>. The CSS corpus is also the page's weakest sample (see
						<a href="#{docs_slugify(CORPUS_SECTION_TITLE)}">Corpus</a>), so those ratios carry the
						most noise.
					</li>
					<li>
						Biome is grayed out across all three parse groups: its in-process API exposes formatting
						and linting only, so the AST it parses never reaches JS to be measured. oxc-parser is
						grayed out in the CSS group: Oxc formats CSS (in Oxfmt) but ships no CSS parse binding.
					</li>
					<li>
						oxc-parser's wasm row runs an older release than its native row — the newest whose wasi
						binding loads in the harness install — so the wasm-vs-wasm pairing crosses Oxc versions
						(both listed under
						<a href="#{docs_slugify(DETAILS_SECTION_TITLE)}">{DETAILS_SECTION_TITLE}</a>).
					</li>
					<li>
						When line/column is needed, the span-only wire plus JS-side
						<code>reconstruct_locations</code> beats tsv's default <code>loc</code>-bearing wire on
						TypeScript — see the
						<TomeLink slug="introduction" hash={docs_slugify('Span-only parsing')} />'s span-only
						section.
					</li>
					<li>
						rsvelte's is the only Svelte parser here besides tsv's and the svelte/compiler
						reference, and it matches tsv's default wire in mechanism and payload — a JSON string
						with per-node <code>loc</code> that the caller <code>JSON.parse</code>s — so
						<code>rsvelte-parse</code> compares against <code>tsv json</code>, not the
						<code>no-locs</code> entries. Its second entry passes rsvelte's own
						<code>skipExpressionLoc</code>, which drops <code>loc</code> from every JS node, the
						<code>&lt;script&gt;</code> program included, but keeps <code>name_loc</code> on
						elements, attributes, and directives, so it sits near tsv's span-only wire without
						matching it.
						{#if rsvelte_svelte_target && rsvelte_svelte_target !== svelte_version}
							Its addon targets its own upstream Svelte, {rsvelte_svelte_target}, a release apart
							from the {svelte_version} the svelte/compiler row runs (both are listed under
							{DETAILS_SECTION_TITLE}).
						{/if}
					</li>
					<li>
						PostCSS is the only CSS parser here besides tsv's and the <code>parseCss</code>
						reference; none of the Rust CSS tools considered exposes a parse call. PostCSS is also
						the base of Prettier's CSS parse, so it's the parse-side counterpart of the Prettier
						format entry. It isn't payload-matched to tsv: it keeps selectors as strings where
						<code>parseCss</code> and tsv parse them, but stores positions and raw whitespace on
						every node — fewer nodes, about as many objects.
					</li>
				</ul>
			</aside>
		</TomeSection>

		<BenchmarksCliSection title={CLI_SECTION_TITLE} details_title={DETAILS_SECTION_TITLE} />

		<TomeSection>
			<TomeSectionHeader text="Binary size" />
			<p>
				The size of each tool's artifact, split by where it runs and grouped by what it does. Bars
				and ratios are raw bytes, which track what a runtime compiles or parses and what sits on
				disk; the <code>gz</code> beside each estimates the download. <code>tsv-wasm</code>,
				<code>tsv (napi)</code>, and <code>tsv (ffi)</code> are tsv's full builds, parser and
				formatter for Svelte, TypeScript/JS, and CSS in one artifact, beside format-only and
				parse-only subsets. Each group's ratios are against its smallest build, highlighted; hover
				another row to re-anchor them.
			</p>
			<TomeSection>
				<TomeSectionHeader text="In the browser: wasm and JS" />
				<BenchmarksSizes groups={size_targets.browser} />
				<aside>
					<p>Notes:</p>
					<ul>
						<li>
							The <code>(js bundle)</code> entries are the reference toolchain — Prettier with
							prettier-plugin-svelte, and the parsers tsv replaces (Svelte's, plus acorn with
							acorn-typescript) — and aren't files a package ships. Neither publishes a single
							artifact, and installed size counts every language Prettier supports in two module
							formats, so each entry is instead a minified, tree-shaken bundle of just what its job
							needs across tsv's three languages: what you would deploy to a browser, not what Node
							loads. The full entry is barely larger than the formatter, which already contains the
							whole parse bundle: prettier-plugin-svelte needs Svelte's parser, which pulls in acorn
							and acorn-typescript. Minified JS compresses much better than tsv's wasm, so beside it
							these entries look smaller by <code>gz</code> than by raw bytes.
						</li>
						<li>
							<code>dprint (wasm)</code> and <code>Malva (wasm)</code> expose no parser, so both sit
							under Formatter beside tsv's format-only wasm build. That build does Svelte,
							TypeScript/JS, and CSS in one artifact, so Malva (CSS and its dialects only) is
							smaller on scope, while dprint (TypeScript/JS and JSX only) is larger regardless.
						</li>
						<li>
							Biome's build carries a parser, formatter, and linter for every language it supports.
							yuku-parser parses TypeScript, JS, JSX, and TSX only, where tsv's parse-only build
							beside it carries Svelte and CSS parsers too. Oxfmt ships no wasm build, hence its
							grayed-out slot under Formatter.
						</li>
					</ul>
				</aside>
			</TomeSection>
			<TomeSection>
				<TomeSectionHeader text="Native builds" />
				<BenchmarksSizes groups={size_targets.native} />
				<aside>
					<p>Notes:</p>
					<ul>
						<li>
							Every entry counts only artifact files, which undercounts tsv and the others alike.
							<code>{OXFMT_NATIVE_LABEL}</code> is its <code>.node</code> alone, leaving out the
							package's JS that loads it, over half of it a bundled Prettier, the one behind its
							Svelte path. <code>tsv (napi)</code> is likewise its <code>.node</code> alone:
							<a href="https://www.npmjs.com/package/@fuzdev/tsv"><code>@fuzdev/tsv</code></a> is a
							JS dispatcher over prebuilt per-platform packages, and each also carries the
							<code>tsv</code> CLI binary. Either package is close to twice its entry here.
						</li>
						<li>
							The <code>(ffi)</code> entries are tsv's C-ABI build, which isn't published — what the
							engine costs in that configuration, not something you can install; the cross-runtime
							section's Deno run loads the full one.
						</li>
						<li>
							The <code>{OXC_FULL_LABEL}</code> entry under Full toolchain sums Oxc's separate
							parser and formatter packages, since together they're the closest equivalent to tsv's
							single parse+format build. That sum is a little unfair to Oxc: Oxfmt statically links
							its own copy of the Oxc parser, so the two builds count the parser twice. The
							<code>oxfmt</code> addon also formats more languages than tsv, sorts imports, and
							bundles a language server and the CLI itself.
						</li>
						<li>
							<code>{RSVELTE_LABEL}</code> is a standalone executable carrying a CLI and Oxc's
							JS/TS, CSS, and JSON formatters beside its Svelte engine, where the tsv entries are
							bare libraries. Over a directory it also needs Oxfmt, an optional peer dependency it
							hands every file type it doesn't format itself.
						</li>
						<li>
							<code>swc (napi)</code> and <code>rsvelte compiler (napi)</code> back parse rows but
							ship far more than a parser: swc's is an entire compiler (transforms, minifier,
							bundler), and rsvelte's carries the Svelte compiler plus svelte2tsx, HMR diffing and a
							resolver. Read them as what those addons ship, not as parser size.
						</li>
					</ul>
				</aside>
			</TomeSection>
		</TomeSection>

		<TomeSection>
			<TomeSectionHeader text={DETAILS_SECTION_TITLE} />
			<p>
				Each row is the mean time of one sweep, a pass over its group's timed file set. Within a
				group every tool is timed on the same files — the intersection of what every timed tool
				accepted, so a file one rejects drops out for everyone. The count above each chart is that
				intersection, and a chart that runs short of the corpus total says beneath it what was left
				out and which rows failed it.
			</p>
			<p>
				These are warm numbers: every row runs warmup sweeps before it is timed, so a cold one-shot
				call pays more. Each native or wasm call also pays a string encode across the binding
				boundary, and a decode wherever it hands back text or JSON, which the JS tools skip.
			</p>
			<p>
				Each row is timed until it has both a few seconds of sweeps and at least
				{format_count_maybe(sweeps.floor)} sweeps{canonical_floor_note}, so the multi-second rows
				stop near that floor. After outlier cleaning, rows keep from
				{format_count_maybe(sweeps.sample_size_min)} to {format_count_maybe(sweeps.sample_size_max)}
				timings. A steady reading over a handful of sweeps is thinner evidence than one over
				hundreds, so the harness's check for unstable rows proves less for the slow rows — Prettier
				among them, the default anchor of every format chart.
			</p>
			<p>
				Rows run in a fixed order, not interleaved or shuffled: the reference row, then tsv's rows,
				then the alternatives. A forced garbage collection before each row limits what one row
				leaves for the next, but nothing pins the process to a core or holds the laptop CPU's clock
				steady, so whatever remains, thermal drift included, falls on the later rows. Against every
				alternative that bias counts for tsv; against the reference row, which runs first, it counts
				against tsv — Prettier in the format charts, and svelte/compiler, acorn-typescript, and
				<code>parseCss</code> in the parse ones.
			</p>
			<p>
				One asymmetry isn't isolated: Oxfmt's programmatic <code>format</code> is async-only (as is
				Prettier's, without the N-API hop), so each call pays an N-API task dispatch and promise
				resolution inside its timing that tsv's sync call doesn't, and the native work may run off
				the JS thread — still one file at a time, since each call is awaited before the next, but
				not strictly one thread.
			</p>
			<BenchmarksMeta baseline={benchmarks_json} />
		</TomeSection>

		<TomeSection>
			<TomeSectionHeader text={CORPUS_SECTION_TITLE} />
			<p>
				Every in-process timing on this page comes from {format_count(corpus_counts.files)}
				<code>.svelte</code>, <code>.ts</code>/<code>.js</code>, and <code>.css</code> files of
				real-world code, vendored in the
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
				<a href={corpus_snapshot_url}>
					fuzdev/corpora{corpus_snapshot_commit ? `@${corpus_snapshot_commit}` : ''}
				</a> snapshot so one clone reproduces it. They're the author's libraries, apps, and sites
				(the fuz.dev ecosystem plus personal SvelteKit projects), and upstream framework source
				(Svelte, SvelteKit, and the svelte.dev site).
			</p>
			<ul>
				<li>
					The snapshot's third-party component libraries are left out: they would dominate the
					Svelte set. The CLI section's Svelte corpus draws on them, and shares only its kit and
					svelte.dev trees with this
					one{cli_svelte_pin_differs ? ', vendored at a different corpora commit' : ''}.
				</li>
				<li>
					Test files count as real code and stay in. Fixture files (formatter test suites, and
					fixture subtrees inside the measured repos) are out: deliberately tricky edge cases
					measure conformance, not typical throughput, and the <TomeLink slug="conformance" /> page
					covers them.
				</li>
				<li>
					Standalone CSS files are rare in this ecosystem, so the CSS set adds the
					<code>&lt;style&gt;</code> blocks of the corpus's Svelte components, concatenated per
					corpus
					collection{corpus_counts.harvested_css && corpus.css
						? ` — ${format_count(corpus_counts.harvested_css)} of its ${format_count(corpus.css)} entries`
						: ''}. Even so, CSS is the weakest sample, with just
					{format_count_maybe(corpus_counts.standalone_css)} standalone files.
				</li>
				<li>
					The corpus is the author's own code plus Svelte's, the same code tsv is developed and
					tested against and mostly tsv-formatted already. Input already in a tool's own style may
					format faster, which would favor tsv; pinning the other formatters to that style narrows
					it, since the input then sits near their output too. Every ratio here is "on this corpus",
					not a universal figure.
				</li>
			</ul>
			<Details eager summary="The {format_count(corpus_source_table.rows.length)} sources">
				<p>Each source links its upstream at the commit the snapshot vendored.</p>
				<BenchmarksCorpus table={corpus_source_table} />
			</Details>
		</TomeSection>

		<TomeSection>
			<TomeSectionHeader text={CROSS_RUNTIME_SECTION_TITLE} />
			<p>
				The same harness runs under three JS runtimes — Node, Deno, and Bun; the in-process charts
				above are the Node run, chosen as the default N-API host, not for speed. The native entry
				differs by runtime: Node and Bun load tsv's N-API addon, Deno its C-FFI library, which
				shares its code but crosses a different binding boundary and aborts on panic where the addon
				unwinds. So a per-runtime delta on the same row comes from the JS engine, the host's N-API
				implementation, or that binding and build, not from tsv's algorithms.
			</p>
			<aside>
				<p>
					The <code>internal</code> rows cross the binding boundary but materialize nothing on the
					JS side, so a delta there is the boundary plus each engine's hand-off of the source string
					into it, nothing more; the JSON-materializing parse rows add each JS engine's
					<code>JSON.parse</code> cost on top.
				</p>
			</aside>
			<BenchmarksCrossRuntime report={benchmarks_cross_runtime_json} />
		</TomeSection>
	{/if}
</TomeContent>

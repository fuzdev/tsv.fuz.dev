<script lang="ts">
	// the classes this page's components share, which scoped `<style>` can't reach
	// across — imported here so they ship with this route, not with every one
	import './benchmarks.css';

	import Details from '@fuzdev/fuz_ui/Details.svelte';
	import TomeContent from '@fuzdev/fuz_ui/TomeContent.svelte';
	import TomeLink from '@fuzdev/fuz_ui/TomeLink.svelte';
	import TomeSection from '@fuzdev/fuz_ui/TomeSection.svelte';
	import TomeSectionHeader from '@fuzdev/fuz_ui/TomeSectionHeader.svelte';
	import { docs_slugify } from '@fuzdev/fuz_ui/docs_helpers.svelte.ts';
	import { tome_get_by_slug } from '@fuzdev/fuz_ui/tome.ts';

	import { benchmarks_json } from './benchmarks.ts';
	import { benchmarks_cross_runtime_json } from './benchmarks_cross_runtime.ts';
	import {
		cli_scenario_find,
		cli_speedup_vs_tsv,
		cli_speedup_vs_tsv_npm,
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
		derive_speedup_summary,
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
		OXC_FULL_LABEL,
		OXFMT_NATIVE_LABEL,
		RSVELTE_INSTALL_LABEL,
		RSVELTE_LABEL
	} from './benchmark_sizes.ts';
	import { IN_PROCESS_PAIRS } from './benchmarks_prose.ts';
	import BenchmarksSummary from './BenchmarksSummary.svelte';
	import BenchmarksGroup from './BenchmarksGroup.svelte';
	import BenchmarksSizes from './BenchmarksSizes.svelte';
	import BenchmarksMeta from './BenchmarksMeta.svelte';
	import BenchmarksCorpus from './BenchmarksCorpus.svelte';
	import BenchmarksCrossRuntime from './BenchmarksCrossRuntime.svelte';
	import BenchmarksCliSection from './BenchmarksCliSection.svelte';

	const LIBRARY_ITEM_NAME = 'benchmarks';

	const tome = tome_get_by_slug(LIBRARY_ITEM_NAME);

	// Section titles referenced by in-page anchors, slugified the same way
	// `TomeSectionHeader` builds its ids so a rename can't orphan a link.
	const CLI_SECTION_TITLE = 'End-to-end CLI benchmark';
	const DETAILS_SECTION_TITLE = 'Benchmarking details';
	const CORPUS_SECTION_TITLE = 'Corpus';
	const CROSS_RUNTIME_SECTION_TITLE = 'Cross-runtime';

	// The benchmarked runtime and its version, read from the report itself so the
	// prose tracks each data refresh.
	const node_display = format_runtime_display(benchmarks_json);

	const groups = derive_benchmark_groups(benchmarks_json);
	const speedup_rows = derive_speedup_summary(groups);
	const corpus = benchmarks_json.corpus;
	// Read off the report so the "What's measured" figures can't drift from the
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
	// disclosed beside the headline ratios, since each divides two of these means.
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
	const format_css_vs_biome = speedup('format_css_vs_biome');
	const parse_ts_vs_oxc = speedup('parse_ts_vs_oxc');
	// What tsv's default per-node `loc` costs over its span-only wire, same engine.
	const parse_ts_loc_cost = speedup('parse_ts_loc_cost');
	const parse_ts_yuku_vs_tsv = speedup('parse_ts_yuku_vs_tsv');
	const parse_ts_yuku_vs_tsv_wasm = speedup('parse_ts_yuku_vs_tsv_wasm');
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
		format_ratio_approx(cli_speedup_vs_tsv_npm(scenario, label, 'wall_ms'));
	const cli_npm_ts_vs_oxfmt = cli_npm_ratio(CLI_TS_REPO_KEY, 'oxfmt');
	const cli_npm_ts_vs_biome = cli_npm_ratio(CLI_TS_REPO_KEY, 'biome');
	const cli_ts_wall_vs_oxfmt = format_ratio_approx(
		cli_speedup_vs_tsv(CLI_TS_REPO_KEY, 'oxfmt', 'wall_ms')
	);
	const cli_ts_wall_vs_biome = format_ratio_approx(
		cli_speedup_vs_tsv(CLI_TS_REPO_KEY, 'biome', 'wall_ms')
	);
	// The Svelte head-to-head is published aborted whenever rsvelte-fmt's
	// nondeterministic crash hits the harness's preflight, so its ratios can be
	// absent while the scenario itself is present — the prose covers both cases.
	const cli_svelte = cli_scenario_find(CLI_SVELTE_KEY);
	const cli_svelte_timed = cli_speedup_vs_tsv(CLI_SVELTE_KEY, 'rsvelte-fmt', 'wall_ms') != null;
	const cli_svelte_npm_wall = cli_npm_ratio(CLI_SVELTE_KEY, 'rsvelte-fmt');
</script>

<TomeContent {tome}>
	<section>
		<p>
			tsv is a toolchain for TypeScript/JS, CSS, and Svelte in Rust; after correctness, its
			priorities are performance and efficiency. This page measures it against
			<a href="https://prettier.io/">Prettier</a>, which tsv closely follows, and against
			<a href="https://oxc.rs/">Oxc</a> and <a href="https://biomejs.dev/">Biome</a>, similar tools
			with more features and wider language support (tsv doesn't support JSX/TSX/SCSS/etc.). Also
			compared: <a href="https://baseballyama.github.io/rsvelte/">rsvelte</a> (Svelte
			parser/formatter), <a href="https://yuku.fyi/">Yuku</a> (TypeScript/JS parser),
			<a href="https://swc.rs/">swc</a> (TypeScript/JS parser),
			<a href="https://dprint.dev/plugins/typescript/">dprint-typescript</a> (TypeScript/JS
			formatter), <a href="https://github.com/g-plane/malva">malva</a> (CSS formatter, a third-party
			plugin for dprint's host), and <a href="https://postcss.org/">PostCSS</a> (CSS parser). What
			each parser accepts, as opposed to how fast, is measured on the
			<TomeLink slug="conformance" /> page. The parse charts anchor on the JS parsers tsv is a
			drop-in for: Svelte's compiler (its template parser and <code>parseCss</code>) and
			<a href="https://github.com/sveltejs/acorn-typescript">acorn-typescript</a>, the TypeScript
			parser the Svelte compiler uses.
		</p>
	</section>

	<TomeSection>
		<TomeSectionHeader text="tldr" />
		<p>
			Compared to Oxc and Biome, tsv builds smaller artifacts for the same capability and formats
			its three languages faster in every pairing measured here, while lacking their features and
			language breadth. On Svelte, "faster" means beating the Prettier pipeline Oxfmt delegates to
			and Biome's experimental HTML path — neither ships a dedicated Svelte formatter. On parsing
			TypeScript/JS, the one language tsv and oxc-parser share, a span-only AST matched to Oxc's
			lands in JS ahead of it; tsv's default AST, which carries the line/column locations Oxc omits,
			lands behind.
		</p>
		<p>
			Except in the CLI section, every timing here is in-process and one file at a time: each tool
			parses or formats the corpus sequentially, isolating engine speed from multi-core parallelism.
			The corpus is {format_count(corpus_counts.files)} files of real-world code — Svelte's own
			repos (svelte, kit, svelte.dev), the <a href="https://github.com/fuzdev">fuz.dev repos</a>,
			and a few of the author's personal SvelteKit apps and sites, itemized under
			<a href="#{docs_slugify(CORPUS_SECTION_TITLE)}">Corpus</a>. On that basis:
		</p>
		<ul>
			<li>
				Formatting TypeScript, tsv is ~{format_ts_vs_oxfmt} faster than Oxfmt (native-vs-native),
				~{format_ts_vs_prettier} faster than Prettier (native Rust vs Prettier's JS), and
				~{format_ts_vs_biome} faster than Biome (wasm-vs-wasm).
			</li>
			<li>
				Formatting Svelte, tsv is ~{format_svelte_vs_prettier} faster than Prettier (which Oxfmt's
				Svelte path delegates to internally) and ~{format_svelte_vs_biome} faster than Biome, same
				pairings.
			</li>
			<li>
				Formatting CSS, it's ~{format_css_vs_oxfmt} faster than Oxfmt and ~{format_css_vs_biome}
				faster than Biome, same pairings.
			</li>
			<li>
				End to end as a CLI, in a
				<a href="https://github.com/ryanatkn/oxc-bench-formatter" rel="external">
					fork of Oxc's <code>bench-formatter</code>
				</a>: on the JSX-free subset of a real TypeScript repo, with every tool launched through its
				npm package's Node bin, tsv formats ~{cli_npm_ts_vs_oxfmt} faster than Oxfmt and
				~{cli_npm_ts_vs_biome} faster than Biome in wall-clock, using less memory than either. As
				the bare native binary, without Node in front, it's ~{cli_ts_wall_vs_oxfmt} and
				~{cli_ts_wall_vs_biome} faster. Wall-clock ratios bake in each tool's multi-file parallelism
				— see <a href="#{docs_slugify(CLI_SECTION_TITLE)}">the CLI section</a>'s notes.
			</li>
			<li>
				Parsing TypeScript into JS with a span-only payload matched to Oxc's, tsv lands
				~{parse_ts_vs_oxc} ahead of Oxc and ~{parse_ts_yuku_vs_tsv} behind yuku-parser
				(~{parse_ts_yuku_vs_tsv_wasm} wasm-vs-wasm). tsv's default AST adds per-node line/column
				<code>loc</code> for drop-in acorn and Svelte AST compatibility, at ~{parse_ts_loc_cost} the
				parse-and-hand-off time, which puts it behind Oxc's span-only wire (and swc's, span-only in
				its own AST shape).
			</li>
			<li>
				Parsing Svelte, that default <code>loc</code>-bearing AST lands in JS
				~{parse_svelte_vs_compiler} faster than svelte/compiler's (JS) and
				~{parse_svelte_vs_rsvelte} faster than rsvelte's (native-vs-native). CSS runs the other way:
				Svelte's own <code>parseCss</code> is ~{parse_css_compiler_vs_tsv} faster than tsv's JSON
				wire and PostCSS ~{parse_css_postcss_vs_tsv}.
			</li>
			{#if cli_svelte_timed || cli_svelte?.aborted}
				<li>
					The fork's Svelte scenario benches tsv against rsvelte-fmt, another Rust Svelte-native
					formatter, on a third-party <code>.svelte</code> corpus.
					{#if cli_svelte_timed}
						There tsv formats ~{cli_svelte_npm_wall} faster through its Node dispatcher, the footing
						rsvelte-fmt's own Node launcher is timed on.
					{:else}
						It currently publishes no numbers — the harness aborted it rather than time it; see
						<a href="#{docs_slugify(CLI_SECTION_TITLE)}">the CLI section</a>.
					{/if}
				</li>
			{/if}
		</ul>
		<p>
			The charts are the {node_display} run; a
			<a href="#{docs_slugify(CROSS_RUNTIME_SECTION_TITLE)}">cross-runtime comparison</a> closes the
			page.
		</p>
	</TomeSection>

	<TomeSection>
		<TomeSectionHeader text="Like Prettier but speedier" />
		<BenchmarksSummary rows={speedup_rows} />
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
	</TomeSection>

	<TomeSection>
		<TomeSectionHeader text="Format speed" />
		<p>
			tsv's formatter is similar to <a href="https://oxc.rs/docs/guide/usage/formatter">Oxfmt</a>,
			<a href="https://biomejs.dev/formatter/">Biome</a>, and
			<a href="https://dprint.dev/plugins/typescript/">dprint</a>. It formats Svelte, TypeScript,
			and CSS, plus JS through the same TypeScript parser:
		</p>
		{#each format_groups as group (group.language)}
			<BenchmarksGroup {group} />
		{/each}
		<aside>
			<p>Notes:</p>
			<ul>
				<li>wasm-vs-wasm and native-vs-native (N-API here) are the like-for-like pairings.</li>
				<li>
					<a href="https://github.com/baseballyama/rsvelte" rel="external">rsvelte-fmt</a>, the
					second Rust-native Svelte formatter here, is grayed out in the Svelte group: it ran over
					every Svelte file (its platform binary, invoked directly) but isn't timed, since it ships
					no in-process API and a process per file would measure spawn rather than formatting.
					{#if cli_svelte_timed}
						For multi-threaded CLI speed with rsvelte included, see the
						<a href="#{docs_slugify(CLI_SECTION_TITLE)}">CLI section</a>.
					{:else if cli_svelte?.aborted}
						Its multi-threaded CLI run in the
						<a href="#{docs_slugify(CLI_SECTION_TITLE)}">CLI section</a> is currently aborted rather
						than timed.
					{/if}
				</li>
				<li>
					Every formatter is pinned to tsv's fixed style (width 100, tabs, single quotes, no
					trailing commas) in its own option dialect, so each row does comparable layout work; the
					harness checks that each pin landed, which proves nothing where a pin matches the tool's
					default (Biome's tabs, Oxfmt's width). Nothing grades output against an oracle: the bench
					checks that output is non-empty, that tsv's native and wasm builds agree byte for byte,
					and that a tool's refusal is seen as one, so a tool emitting wrong output quickly would
					still read as fast. tsv's own output is checked against Prettier's in
					<a href="https://github.com/fuzdev/tsv">its repo's gates</a>, separately from timing.
				</li>
				<li>
					Every tool that takes a filename gets a synthetic one (<code>file.ts</code>,
					<code>file.css</code>, <code>file.svelte</code>), never the real path, so every row
					formats the corpus's <code>.js</code> files as TypeScript, Prettier included (a real
					Prettier run would hand <code>.js</code> to its Babel parser; which way that moves
					Prettier's time is unmeasured).
				</li>
				<li>
					Each format row includes the tool's own parse: source in, formatted text out. Biome's only
					in-process format entry point, <code>formatContent</code>, also opens the file in its
					workspace, pulls syntax diagnostics, and closes it on every call, so its rows carry that
					wrapper too.
				</li>
				<li>
					Oxfmt formats TypeScript, JS, and CSS with its own native engine; for Svelte it delegates
					to a Prettier it bundles, with a bundled copy of
					<a href="https://github.com/sveltejs/prettier-plugin-svelte">prettier-plugin-svelte</a> —
					the embedded <code>&lt;script&gt;</code> still goes through its native engine, the
					<code>&lt;style&gt;</code> through that Prettier's CSS printer.
				</li>
				<li>
					Biome has no dedicated Svelte formatter: its Svelte row runs with
					<code>html.experimentalFullSupportEnabled</code>, the experimental HTML-superset pipeline
					that lets it format <code>.svelte</code> at all; without the flag it returns empty output.
					Embedded script and style are formatted too, so the work is comparable. Its row also pays
					a cold first sweep each time the harness rebuilds its wasm instance, a few percent.
				</li>
				<li>
					There's no native Biome entry: <code>@biomejs/js-api</code>, its in-process API, backs
					onto its wasm builds alone, and the native engine reaches npm only as the
					<code>biome</code> CLI binary, a separate process rather than a library.
				</li>
				<li>
					The dprint entry is
					<a href="https://dprint.dev/plugins/typescript/">dprint-plugin-typescript</a>, the engine
					<code>deno fmt</code> runs for TypeScript and JS, loaded in-process as its wasm plugin. It
					rejects CSS and Svelte, and no dprint markup plugin is wired in, so it has no Svelte row
					and its CSS slot goes to <a href="https://github.com/g-plane/malva">malva</a>, a
					third-party CSS plugin for the same host. This times the engine, not the
					<code>deno fmt</code> CLI.
				</li>
			</ul>
		</aside>
	</TomeSection>

	<BenchmarksCliSection title={CLI_SECTION_TITLE} />

	<TomeSection>
		<TomeSectionHeader text="Parse speed" />
		<p>
			tsv and <a href="https://oxc.rs/docs/guide/usage/parser">oxc-parser</a> share a mechanism:
			both serialize the AST to JSON in Rust and hand it to the engine's <code>JSON.parse</code>,
			native and wasm alike. The deliverables differ: tsv's default wire (<code>tsv-json</code> /
			<code>tsv-wasm-json</code>) carries a per-node <code>loc</code> (line/column) object that
			oxc-parser's span-only AST omits, at ~{parse_ts_loc_cost} the parse-and-hand-off time on the
			TypeScript corpus. The <code>tsv-json-no-locations</code> /
			<code>tsv-wasm-json-no-locations</code> entries (<code>no-locs</code> in the charts) drop it
			for a span-only wire of oxc's kind, so they are the payload-matched comparison with
			oxc-parser, though the shapes still differ in detail. The tsv-internal and tsv-wasm-internal
			entries build tsv's in-Rust AST and stop — no serialization, nothing materialized in JS — so
			they show raw engine speed, and their gap to the JSON rows is what serializing and handing off
			costs tsv, not a cross-tool comparison.
		</p>
		<p>
			yuku-parser, a JS/TS parser written in Zig, emits the same span-only AST as oxc, so it too
			compares against the <code>no-locs</code> entries. It gets there differently — a compact
			binary buffer its JS side decodes into objects lazily — so the bench forces the whole tree and
			times that; the deliverable is the same fully materialized tree, so the entries stay
			comparable.
		</p>
		{#each parse_groups as group (group.language)}
			<BenchmarksGroup {group} />
		{/each}
		<aside>
			<p>Notes:</p>
			<ul>
				<li>
					JS parsers skip the Rust-to-JS serialization tsv and oxc pay for, which keeps them
					competitive — and on CSS that decides the order: the JSON hand-off is
					~{parse_css_wire_share} of tsv's time there (the gap to the internal row), and CSS is a
					simple enough grammar that Svelte's <code>parseCss</code> and PostCSS both finish ahead of
					<code>tsv-json</code>. The CSS corpus is also the page's weakest sample (see
					<a href="#{docs_slugify(CORPUS_SECTION_TITLE)}">Corpus</a>), so those ratios carry the
					most noise.
				</li>
				<li>
					Biome is grayed out across all three parse groups: its in-process API exposes formatting
					and linting only, so the AST it parses never reaches JS to be measured.
				</li>
				<li>
					oxc-parser, yuku-parser, and swc parse TypeScript and JS only (and JSX, not measured here)
					— no CSS, no Svelte, no formatter — so they're timed in the TypeScript parse group alone.
					oxc-parser's AST has no line/column option, so the span-only <code>no-locs</code> entries
					are the one payload-matched pairing. Its wasm row runs an older release than its native
					row — the newest whose wasi binding loads in the harness install — so the wasm-vs-wasm
					pairing crosses oxc versions (both listed under
					<a href="#{docs_slugify(DETAILS_SECTION_TITLE)}">{DETAILS_SECTION_TITLE}</a>).
				</li>
				<li>
					When line/column is needed, the fast path is not tsv's default <code>loc</code>-bearing
					wire but the span-only one plus a JS-side reconstruction from offsets and source
					(<code>reconstruct_locations</code>, shipped in every parse-capable tsv package) —
					measured on TypeScript in a footnote of
					<a href="https://github.com/fuzdev/tsv/blob/main/benches/js/results/report.node.md">
						tsv's bench report
					</a> rather than charted here.
				</li>
				<li>
					rsvelte's is the only Svelte parser here besides tsv's and the svelte/compiler reference,
					and it matches tsv's default wire in mechanism and payload — a JSON string with per-node
					<code>loc</code> that the caller <code>JSON.parse</code>s — so <code>rsvelte-parse</code>
					compares against <code>tsv-json</code>, not the <code>no-locs</code> entries. Its second
					entry passes rsvelte's own <code>skipExpressionLoc</code>, which drops <code>loc</code>
					only on embedded JS expressions and keeps the top-level offsets — a different trade than
					tsv's span-only wire.
					{#if rsvelte_svelte_target && rsvelte_svelte_target !== svelte_version}
						Its addon targets its own upstream Svelte, {rsvelte_svelte_target}, a release apart from
						the {svelte_version} the svelte/compiler row runs (both are listed under Benchmarking
						details).
					{/if}
				</li>
				<li>
					swc parses into its own AST shape — a <code>Module</code> root carrying <code>span</code>
					offsets rather than ESTree's <code>loc</code>/<code>range</code> — so it isn't
					payload-matched to either tsv wire.
				</li>
				<li>
					PostCSS is the only CSS parser here besides tsv's and the <code>parseCss</code> reference;
					none of the Rust CSS tools considered offers a parse call —
					<a href="https://lightningcss.dev/">Lightning CSS</a> ships <code>transform</code> and
					<code>bundle</code> but no parse call, Biome surfaces no parser, and malva is a formatter.
					PostCSS is also the parser behind Prettier's CSS printer, so it's the parse-side
					counterpart of the Prettier format entry. It isn't payload-matched to tsv: it keeps
					selectors and values as strings where <code>parseCss</code> and tsv build ASTs, a much
					lighter tree.
				</li>
			</ul>
		</aside>
	</TomeSection>

	<TomeSection>
		<TomeSectionHeader text="Binary size" />
		<p>
			The size of each tool's artifact, grouped by what it does. tsv covers Svelte, TypeScript/JS,
			and CSS. Size matters most in the browser. Bars and ratios are raw on-disk bytes; the
			<code>gz</code> annotation beside each is the gzipped size, the better estimate of a download.
		</p>
		<BenchmarksSizes sizes={benchmarks_json.binary_sizes} />
		<aside>
			<p>Notes:</p>
			<ul>
				<li>
					The <code>(js bundle)</code> entries are the reference toolchain — Prettier with
					prettier-plugin-svelte, and the parsers tsv replaces (Svelte's, plus acorn with
					acorn-typescript) — and aren't files a package ships. Neither publishes a single artifact,
					and installed size counts every language Prettier supports in two module formats, so each
					entry is instead a minified, tree-shaken bundle of the least one job needs for tsv's three
					languages: what you would deploy to a browser, not what Node loads. The full entry is
					barely larger than the formatter because the formatter already contains the Svelte parser.
					Minified JS compresses much better than wasm, so these read smaller by <code>gz</code>
					than by raw bytes.
				</li>
				<li>
					Each group mixes wasm and native builds under one anchor, so a ratio can cross kinds —
					compare like with like within a group. tsv's entries: <code>tsv (ffi)</code>,
					<code>tsv (napi)</code>, and <code>tsv-wasm</code> are the full builds, parser and
					formatter for Svelte, TypeScript/JS, and CSS in one artifact. The N-API addon ships as
					<a href="https://www.npmjs.com/package/@fuzdev/tsv"><code>@fuzdev/tsv</code></a>, a JS
					dispatcher over prebuilt per-platform packages. The <code>(ffi)</code> entries are its
					C-ABI build, which isn't published — what the engine costs in that configuration, not
					something you can install; the cross-runtime section's Deno run loads it.
				</li>
				<li>
					The Parser group is scope as much as engine. yuku-parser parses TypeScript and JS only,
					where tsv's parse-only builds beside it carry parsers for Svelte and CSS too. And
					<code>swc (napi)</code> and <code>rsvelte compiler (napi)</code> back parse rows but ship
					far more than a parser: swc's is an entire compiler (transforms, minifier, bundler), and
					rsvelte's carries the Svelte compiler plus svelte2tsx, HMR diffing and a resolver. Read
					them as what those addons ship, not as parser size.
				</li>
				<li>
					Biome bundles a parser, formatter, and linter for many languages; only its wasm build is
					included, since its native engine ships as a CLI binary rather than a library.
				</li>
				<li>
					The <code>{OXC_FULL_LABEL}</code> entry under Full toolchain sums oxc's separate parser
					(TypeScript and JS/JSX only) and formatter packages, since together they're the closest
					equivalent to tsv's single parse+format build.
				</li>
				<li>
					That sum is a little unfair to oxc: oxfmt statically links its own copy of the oxc parser,
					so the two builds count the parser twice, and the summed <code>gz</code> is two gzip
					streams rather than one. The other way, the <code>oxfmt</code> addon is more than a
					formatter for tsv's three languages — it also formats JSON and YAML, sorts imports, and
					carries a language server and the CLI itself.
				</li>
				<li>
					Every entry is one artifact file, which undercounts in both directions.
					<code>{OXFMT_NATIVE_LABEL}</code> is its <code>.node</code> alone, leaving out the
					package's JS that loads it — nearly as large again, over half of it a bundled Prettier,
					the one behind its Svelte path — and <code>{RSVELTE_INSTALL_LABEL}</code> omits its
					launcher package. <code>tsv (napi)</code> is likewise its <code>.node</code> alone, and
					the platform package that ships it also carries the <code>tsv</code> CLI binary, nearly as
					large again.
				</li>
				<li>
					oxfmt ships no wasm build, so it's shown grayed-out under Formatter, holding its slot
					beside <code>{OXFMT_NATIVE_LABEL}</code>.
				</li>
				<li>
					<code>{RSVELTE_LABEL}</code> is a scope mismatch of its own kind — a standalone executable
					carrying a CLI and oxc's JS/TS, CSS, and JSON formatters beside its Svelte engine, where
					the tsv entries are bare libraries. <code>{RSVELTE_INSTALL_LABEL}</code> is what you
					install to format a project, and the fairer comparison to tsv's single build: over a
					directory it needs oxfmt, an optional peer dependency it hands every file type it doesn't
					format itself.
				</li>
				<li>
					<code>dprint (wasm)</code> and <code>malva (wasm)</code> are two plugins for the same
					dprint formatter host — TypeScript/JS and CSS respectively — and neither exposes a parser,
					so both sit under Formatter beside tsv's format-only wasm build. That build does Svelte,
					TypeScript/JS and CSS in one artifact, so each gap there is scope before it's engine.
				</li>
			</ul>
		</aside>
	</TomeSection>

	<TomeSection>
		<TomeSectionHeader text={DETAILS_SECTION_TITLE} />
		<p>
			One asymmetry in the in-process timings isn't isolated: oxfmt's programmatic
			<code>format</code> is async-only, so each call pays an N-API task dispatch and promise
			resolution inside its timing that tsv's sync call doesn't, and the native work may run off the
			JS thread — still one file at a time, since each call is awaited before the next, but not
			strictly one thread. Each row is the total time to process its group's timed files once — not
			the multi-core batch throughput a CLI gets when it formats many files at once, which most of
			these tools (tsv included) can do.
		</p>
		<p>
			Within a group every tool is timed on the same file set — the intersection of what every timed
			tool accepted, so a file one rejects drops out for everyone. The count above each chart is
			that intersection; where a group runs short of the corpus total, a note under its chart gives
			the files and the share of the group's bytes left out, and which rows failed them. These are
			warm numbers: every row runs warmup sweeps before it is timed, so a cold one-shot call pays
			more; and each native or wasm call pays a string encode across the binding boundary, and a
			decode wherever it hands back text or JSON, which the JS tools skip.
		</p>
		<p>
			Rows run in a fixed order, not interleaved or shuffled: the canonical row, then tsv's rows,
			then the alternatives. A forced garbage collection before each row limits what one row leaves
			for the next, but whatever remains, and any thermal drift, runs against the rows after tsv's —
			every alternative — so order bias there counts for tsv, not against it. The canonical row is
			the exception: it runs before tsv's, so the bias runs against tsv in every ratio that divides
			by one — the summary table, and the parse comparisons against svelte/compiler,
			acorn-typescript, and <code>parseCss</code>.
		</p>
		<p>
			Nothing pins the process to a core or holds the clock steady — an unpinned run on a laptop CPU
			— so thermal drift is a live possibility, not a formality. The <code>tsv-wasm</code> rows run
			the full parse+format build, not the smaller format-only or parse-only ones.
		</p>
		<p>
			Sweep counts differ widely by row because each row gets a time budget rather than a count: at
			least {format_count_maybe(sweeps.floor)} sweeps{canonical_floor_note}, otherwise as many as
			fit a few seconds, so the multi-second rows stop near that floor. After outlier cleaning the
			report keeps from {format_count_maybe(sweeps.sample_size_min)} to
			{format_count_maybe(sweeps.sample_size_max)} timings per row. A low cv over a handful of
			sweeps is thinner evidence of quiet than the same cv over hundreds, so the instability check
			behind the headline ratios proves less for the slow rows that stop there — Prettier among
			them, the denominator of every ratio in the summary table.
		</p>
		<BenchmarksMeta baseline={benchmarks_json} />
	</TomeSection>

	<TomeSection>
		<TomeSectionHeader text={CORPUS_SECTION_TITLE} />
		<p>
			Every in-process number on this page is measured on {format_count(corpus_counts.files)} files
			of <code>.svelte</code>, <code>.ts</code>/<code>.js</code>, and <code>.css</code> — real-world
			code only, vendored at one pinned commit in the
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<a href={corpus_snapshot_url}>
				fuzdev/corpora{corpus_snapshot_commit ? `@${corpus_snapshot_commit}` : ''}
			</a> snapshot so one clone reproduces it. It draws on two sources: the author's libraries,
			apps, and sites (the fuz.dev ecosystem plus personal SvelteKit apps and sites), and upstream
			framework source (Svelte, SvelteKit, and the svelte.dev site). The snapshot's third-party
			component libraries are left out: they would dominate the Svelte set.
		</p>
		<p>
			The CSS set also includes real-authored CSS extracted from those components'
			<code>&lt;style&gt;</code> blocks, concatenated per corpus collection, since standalone CSS
			files are rare in this
			ecosystem{corpus_counts.harvested_css && corpus.css
				? ` — ${format_count(corpus_counts.harvested_css)} of the ${format_count(corpus.css)} CSS entries in the count above`
				: ''}. The harness regenerates that harvest from the snapshot rather than reading a file in
			it, and the same bytes appear in the Svelte rows (rows are never summed). Test files count as
			real code and stay in; fixture files (formatter test suites, and fixture subtrees inside the
			measured repos) are excluded — deliberately tricky edge cases measure conformance, not typical
			throughput, and the <TomeLink slug="conformance" /> page covers them.
		</p>
		<p>
			Two caveats. The corpus is dominated by the author's own code plus Svelte's, the same code tsv
			is developed and tested against and mostly tsv-formatted already, so every ratio here is "on
			this corpus", not a universal figure; the CLI section's Svelte corpus adds those third-party
			libraries, and shares only its kit and svelte.dev trees with this one. And CSS is the weakest
			sample: {format_count_maybe(corpus_counts.standalone_css)} standalone files plus the
			per-collection <code>&lt;style&gt;</code> concatenations, which keep the one level of indent
			they carried inside their tags — so every tool re-indents them, and much of the CSS here
			measures a full re-indent rather than the already-formatted steady state.
		</p>
		<Details eager summary="The {format_count(corpus_source_table.rows.length)} sources">
			<p>Each source links its upstream at the commit the snapshot vendored.</p>
			<BenchmarksCorpus table={corpus_source_table} />
		</Details>
	</TomeSection>

	<TomeSection>
		<TomeSectionHeader text={CROSS_RUNTIME_SECTION_TITLE} />
		<p>
			The same harness runs under three JS runtimes — Node, Deno, and Bun; the headline numbers
			above are the Node run. The native entry differs by runtime: Node and Bun load tsv's N-API
			addon, Deno its C-FFI library. They share code but cross a different binding boundary, so a
			per-runtime delta on the same row is a runtime effect — the JS engine, the host's N-API
			implementation, or the binding boundary — not a difference in tsv's algorithms. Nor is it
			quite one binary: the same engine and settings, but the N-API build keeps panic unwinding
			where the FFI one aborts. A delta the report finds inside the two measurements' combined noise
			is marked <code>≈</code> in the tables and reads as parity, not an effect.
		</p>
		<aside>
			<p>
				The <code>tsv-internal</code> rows cross the native binding boundary but materialize nothing
				on the JS side, so a delta there is the boundary plus each engine's hand-off of the source
				string into it, nothing more; the JSON-materializing parse rows add each JS engine's
				<code>JSON.parse</code> cost on top. Node is the headline as the default N-API path, not a
				speed pick.
			</p>
		</aside>
		<BenchmarksCrossRuntime report={benchmarks_cross_runtime_json} />
	</TomeSection>
</TomeContent>

<script lang="ts">
	import TomeContent from '@fuzdev/fuz_ui/TomeContent.svelte';
	import TomeSection from '@fuzdev/fuz_ui/TomeSection.svelte';
	import TomeSectionHeader from '@fuzdev/fuz_ui/TomeSectionHeader.svelte';
	import { docs_slugify } from '@fuzdev/fuz_ui/docs_helpers.svelte.ts';
	import { tome_get_by_slug } from '@fuzdev/fuz_ui/tome.ts';

	import { benchmarks_json } from './benchmarks.ts';
	import { benchmarks_conformance_json } from './benchmarks_conformance.ts';
	import { benchmarks_cross_runtime_json } from './benchmarks_cross_runtime.ts';
	import {
		benchmarks_cli,
		cli_memory_ratio_range,
		cli_scenario_find,
		cli_speedup_vs_tsv,
		cli_speedup_vs_tsv_npm,
		cli_tsv_npm_memory_mb,
		cli_tsv_npm_overhead_ms_range,
		cli_tsv_npm_overhead_share,
		CLI_TS_REPO_KEY,
		CLI_SINGLE_FILE_KEY,
		CLI_SVELTE_KEY,
		CLI_DELIVERY_KEY,
		CLI_TSV_NPM_LABEL,
		CLI_TSV_WASM_LABEL,
		type CliMetric
	} from './benchmarks_cli.ts';
	import {
		benchmark_speedup,
		CONFORMANCE_SOURCE_PATHS,
		derive_benchmark_groups,
		derive_conformance_groups,
		derive_conformance_slice,
		derive_speedup_summary,
		derive_unstable_entries,
		format_unstable_readings,
		corpus_source_url
	} from './benchmark_data.ts';
	import {
		format_corpus_source_files,
		format_count,
		format_ratio_approx,
		format_ratio_range,
		format_share_approx
	} from './benchmark_display.ts';
	import BenchmarksSummary from './BenchmarksSummary.svelte';
	import BenchmarksGroup from './BenchmarksGroup.svelte';
	import BenchmarksConformance from './BenchmarksConformance.svelte';
	import BenchmarksSizes from './BenchmarksSizes.svelte';
	import BenchmarksMeta from './BenchmarksMeta.svelte';
	import BenchmarksCrossRuntime from './BenchmarksCrossRuntime.svelte';
	import BenchmarksCli from './BenchmarksCli.svelte';

	const LIBRARY_ITEM_NAME = 'benchmarks';

	const tome = tome_get_by_slug(LIBRARY_ITEM_NAME);

	// Section titles referenced by in-page anchors, slugified the same way
	// `TomeSectionHeader` builds its ids so a rename can't orphan a link.
	const CLI_SECTION_TITLE = 'End-to-end CLI benchmark';
	const DETAILS_SECTION_TITLE = 'Benchmarking details';
	const CROSS_RUNTIME_SECTION_TITLE = 'Cross-runtime';

	// The benchmarked runtime version, read from the report itself so the prose
	// tracks each data refresh (the shape tests pin the flagship report to node, so
	// the "Node" label can't silently drift).
	const node_display = `Node${
		benchmarks_json.machine ? ` v${benchmarks_json.machine.runtime_version.split('.')[0]}` : ''
	}`;

	const groups = derive_benchmark_groups(benchmarks_json);
	const speedup_rows = derive_speedup_summary(groups);
	const conformance_groups = derive_conformance_groups(benchmarks_conformance_json);
	// the `tsc` row runs on the conformance surface alone, so its version is
	// disclosed beside its note rather than in the perf report's meta panel (a
	// plain string, so the leading space survives Svelte's block-edge trimming)
	const tsc_version = benchmarks_conformance_json.versions.tsc;
	const tsc_label = tsc_version ? ` (typescript ${tsc_version})` : '';
	// The TypeScript conformance aggregate read by slice: the two validity-filtered
	// slices each selected by one parser here, and Prettier's own JS fixture suite,
	// the largest slice neither scoped, with each engine's count on it.
	const ts_slice = (path: string) =>
		derive_conformance_slice(benchmarks_conformance_json, 'parse/typescript', path);
	const ts_test262 = ts_slice(CONFORMANCE_SOURCE_PATHS.test262);
	const ts_repo = ts_slice(CONFORMANCE_SOURCE_PATHS.ts_repo);
	const ts_prettier_js = ts_slice(CONFORMANCE_SOURCE_PATHS.prettier_js);
	const prettier_js_accepted = (engine: string): string => {
		const processed = ts_prettier_js?.rows[engine]?.processed;
		return processed === undefined ? '—' : format_count(processed);
	};

	const corpus = benchmarks_json.corpus;
	// Read off the report so the "What's measured" figure can't drift from the
	// copied data (the report carries per-language file counts, not bytes).
	const corpus_file_count = Object.values(corpus).reduce((sum, n) => sum + n, 0);
	// The rows the report itself flagged as unstable (see `is_entry_unstable`) —
	// disclosed beside the headline ratios, since each divides two of these means.
	const unstable_entries = derive_unstable_entries(benchmarks_json);
	const format_groups = groups.filter((g) => g.operation === 'format');
	const parse_groups = groups.filter((g) => g.operation === 'parse');
	// How many timed sweeps stand behind each row: the bench's per-row floor, and the
	// span of cleaned counts it actually kept — the slow rows stop near the floor, so
	// a quiet cv there rests on a handful of timings.
	// (the shape tests require every timed row to carry both fields; the `—`
	// fallbacks keep a report without them from printing `Infinity` mid-sentence)
	const min_iterations = benchmarks_json.entries.flatMap((e) => e.min_iterations ?? []);
	const sample_sizes = benchmarks_json.entries.flatMap((e) => e.sample_size ?? []);
	const sweep_floor = min_iterations.length ? format_count(Math.min(...min_iterations)) : '—';
	const sample_size_min = sample_sizes.length ? format_count(Math.min(...sample_sizes)) : '—';
	const sample_size_max = sample_sizes.length ? format_count(Math.max(...sample_sizes)) : '—';

	// Every ratio the TLDR and the section notes quote, computed from the same
	// reports the charts render so the prose can't drift from them. Native-vs-native
	// pairs tsv with oxfmt, wasm-vs-wasm pairs tsv-wasm with biome-wasm; the parse
	// comparison uses tsv's span-only wire, the shape oxc-parser also emits.
	const speedup = (group: string, slower: string, faster: string) =>
		format_ratio_approx(benchmark_speedup(benchmarks_json, group, slower, faster));
	const format_ts_vs_oxfmt = speedup('format/typescript', 'oxfmt', 'tsv');
	const format_ts_vs_prettier = speedup('format/typescript', 'prettier', 'tsv');
	const format_ts_vs_biome = speedup('format/typescript', 'biome-wasm', 'tsv-wasm');
	const format_svelte_vs_prettier = speedup('format/svelte', 'prettier', 'tsv');
	const format_svelte_vs_biome = speedup('format/svelte', 'biome-wasm', 'tsv-wasm');
	const format_css_vs_oxfmt = speedup('format/css', 'oxfmt', 'tsv');
	const format_css_vs_biome = speedup('format/css', 'biome-wasm', 'tsv-wasm');
	const parse_ts_vs_oxc = speedup('parse/typescript', 'oxc-parser', 'tsv-json-no-locations');
	// What tsv's default per-node `loc` costs over its span-only wire, same engine.
	const parse_ts_loc_cost = speedup('parse/typescript', 'tsv-json', 'tsv-json-no-locations');
	// The one entry that leads tsv's span-only wire, so the tldr quotes it in the
	// direction the data actually runs rather than only naming what tsv beats.
	const parse_ts_yuku_vs_tsv = speedup('parse/typescript', 'tsv-json-no-locations', 'yuku-parser');
	// the wasm pairing runs wider, so the tldr quotes both rather than the friendlier one
	const parse_ts_yuku_vs_tsv_wasm = speedup(
		'parse/typescript',
		'tsv-wasm-json-no-locations',
		'yuku-parser-wasm'
	);
	// Svelte and CSS pair tsv's default `loc`-bearing wire with the JS parsers it
	// is a drop-in for (and rsvelte's, which carries the same payload). CSS runs
	// against tsv, so those two are quoted in that direction.
	const parse_svelte_vs_compiler = speedup('parse/svelte', 'svelte/compiler', 'tsv-json');
	const parse_svelte_vs_rsvelte = speedup('parse/svelte', 'rsvelte-parse', 'tsv-json');
	const parse_css_compiler_vs_tsv = speedup('parse/css', 'tsv-json', 'svelte/compiler');
	const parse_css_postcss_vs_tsv = speedup('parse/css', 'tsv-json', 'postcss');
	// The JSON hand-off's share of tsv's CSS parse row: everything the JSON wire
	// costs beyond the internal row, which builds the same AST and stops.
	const parse_css_wire = benchmark_speedup(
		benchmarks_json,
		'parse/css',
		'tsv-json',
		'tsv-internal'
	);
	const parse_css_wire_share = format_share_approx(
		parse_css_wire === undefined ? undefined : 1 - 1 / parse_css_wire
	);
	// rsvelte's parse addon targets its own upstream Svelte, which can sit a release
	// apart from the pin the svelte/compiler row runs — said only while the two differ
	const svelte_version = benchmarks_json.versions.svelte;
	const rsvelte_svelte_target = benchmarks_json.versions.rsvelte_parse_svelte_target;

	// The end-to-end CLI claims, from the formatter-comparison report.
	const cli_ratio = (scenario: string, label: string, metric: CliMetric) =>
		format_ratio_approx(cli_speedup_vs_tsv(scenario, label, metric));
	const cli_ts_wall_vs_oxfmt = cli_ratio(CLI_TS_REPO_KEY, 'oxfmt', 'wall_ms');
	const cli_ts_cpu_vs_oxfmt = cli_ratio(CLI_TS_REPO_KEY, 'oxfmt', 'cpu_ms');
	const cli_ts_wall_vs_biome = cli_ratio(CLI_TS_REPO_KEY, 'biome', 'wall_ms');
	const cli_ts_cpu_vs_biome = cli_ratio(CLI_TS_REPO_KEY, 'biome', 'cpu_ms');
	// scoped to the two tools the TLDR sentence names, so the range it quotes
	// is measured over exactly them (the full-span figure lives in the CLI section)
	const cli_ts_memory = cli_memory_ratio_range(CLI_TS_REPO_KEY, ['oxfmt', 'biome']);
	const cli_memory = cli_memory_ratio_range();
	// the same span like for like, against the dispatcher row the headline claims lead with
	const cli_npm_memory = cli_memory_ratio_range(undefined, undefined, CLI_TSV_NPM_LABEL);
	// The Svelte head-to-head is published aborted whenever rsvelte-fmt's
	// nondeterministic crash hits the harness's preflight, so its ratios can be
	// absent while the scenario itself is present — the prose covers both cases.
	const cli_svelte = cli_scenario_find(CLI_SVELTE_KEY);
	const cli_svelte_wall = cli_speedup_vs_tsv(CLI_SVELTE_KEY, 'rsvelte-fmt', 'wall_ms');
	const cli_svelte_memory = cli_speedup_vs_tsv(CLI_SVELTE_KEY, 'rsvelte-fmt', 'memory_mb');
	// tsv through its npm dispatcher against the other tools' npm bins — the
	// like-for-like rows, which the headline claims lead with; the bare-binary
	// ratios follow as what the binary does without a Node launcher in front.
	const cli_npm_ratio = (scenario: string, label: string, metric: CliMetric = 'wall_ms') =>
		format_ratio_approx(cli_speedup_vs_tsv_npm(scenario, label, metric));
	const cli_npm_single_vs_oxfmt = cli_npm_ratio(CLI_SINGLE_FILE_KEY, 'oxfmt');
	const cli_npm_single_vs_biome = cli_npm_ratio(CLI_SINGLE_FILE_KEY, 'biome');
	const cli_npm_ts_vs_oxfmt = cli_npm_ratio(CLI_TS_REPO_KEY, 'oxfmt');
	const cli_npm_ts_vs_biome = cli_npm_ratio(CLI_TS_REPO_KEY, 'biome');
	const cli_npm_ts_cpu_vs_oxfmt = cli_npm_ratio(CLI_TS_REPO_KEY, 'oxfmt', 'cpu_ms');
	const cli_npm_ts_cpu_vs_biome = cli_npm_ratio(CLI_TS_REPO_KEY, 'biome', 'cpu_ms');
	const cli_npm_ts_memory = cli_memory_ratio_range(
		CLI_TS_REPO_KEY,
		['oxfmt', 'biome'],
		CLI_TSV_NPM_LABEL
	);
	const cli_npm_memory_mb = cli_tsv_npm_memory_mb();
	// the dispatcher's own cost on the multi-file repo, beside the delivery table's one-file figure
	const cli_npm_ts_cost = cli_ratio(CLI_TS_REPO_KEY, CLI_TSV_NPM_LABEL, 'wall_ms');
	// the same cost in absolute terms, which is what makes it "fixed": roughly the
	// same few tens of milliseconds whether the run is one file or a repo
	const cli_npm_overhead = cli_tsv_npm_overhead_ms_range();
	// and as a share of the dispatcher's parallel repo run, wall-clock against CPU work
	const cli_npm_ts_share = cli_tsv_npm_overhead_share(CLI_TS_REPO_KEY);
	const cli_npm_overhead_ms = cli_npm_overhead
		? [...new Set([cli_npm_overhead.min, cli_npm_overhead.max].map((ms) => Math.round(ms)))].join(
				'–'
			)
		: '—';
	// the dispatcher row is timed and memory-measured in the same passes as the
	// bare binary, so these resolve exactly when the bare-binary Svelte ratios do
	const cli_svelte_npm_wall = cli_npm_ratio(CLI_SVELTE_KEY, 'rsvelte-fmt');
	const cli_svelte_npm_memory = cli_npm_ratio(CLI_SVELTE_KEY, 'rsvelte-fmt', 'memory_mb');
	// What each way of installing tsv costs, from the tsv-only delivery scenario.
	const cli_delivery_npm_wall = cli_ratio(CLI_DELIVERY_KEY, CLI_TSV_NPM_LABEL, 'wall_ms');
	const cli_wasm_wall = cli_ratio(CLI_DELIVERY_KEY, CLI_TSV_WASM_LABEL, 'wall_ms');
	const cli_wasm_memory = cli_ratio(CLI_DELIVERY_KEY, CLI_TSV_WASM_LABEL, 'memory_mb');
</script>

<TomeContent {tome}>
	<section>
		<p>
			tsv is a toolchain for TypeScript/JS, CSS, and Svelte in Rust. After correctness, performance
			and efficiency are tsv's priorities. This page shows how it measures up against
			<a href="https://prettier.io/">Prettier</a>, which tsv closely follows, and against
			<a href="https://oxc.rs/">Oxc</a> and <a href="https://biomejs.dev/">Biome</a>, similar tools
			with more features and wider language support than tsv, which doesn't support
			JSX/TSX/SCSS/etc. Also included for comparison:
			<a href="https://baseballyama.github.io/rsvelte/">rsvelte</a> (Svelte parser/formatter),
			<a href="https://yuku.fyi/">Yuku</a> (TypeScript/JS parser), <a href="https://swc.rs/">swc</a>
			(TypeScript/JS parser), <a href="https://dprint.dev/plugins/typescript/">dprint-typescript</a>
			(TypeScript/JS formatter), <a href="https://github.com/g-plane/malva">malva</a> (CSS
			formatter, a third-party plugin for dprint's host), <a href="https://postcss.org/">PostCSS</a>
			(CSS parser), and, on the conformance surface only, <code>tsc</code>'s own parser.
		</p>
	</section>

	<TomeSection>
		<TomeSectionHeader text="tldr" />
		<p>
			Compared to Oxc and Biome, tsv builds smaller artifacts for the same capability and formats
			its three languages faster in every pairing measured here, while lacking their features and
			language breadth. On Svelte, "faster" means beating the Prettier pipeline Oxfmt delegates to
			and Biome's experimental HTML path — neither project ships a dedicated Svelte formatter. On
			the parse side, on TypeScript/JS — the one language tsv and oxc-parser share — a span-only AST
			matched to Oxc's lands in JS ahead of it on a lighter wire, while tsv's default AST, which
			carries line/column locations Oxc's omits, lands behind.
		</p>
		<p>
			Except in the CLI section, every measurement here is single-threaded and in-process: each tool
			parses or formats one file at a time, isolating engine speed from multi-core parallelism. The
			corpus is {format_count(corpus_file_count)} files of real-world code — Svelte's own repos
			(svelte, kit, svelte.dev), the <a href="https://github.com/fuzdev">fuz.dev repos</a>, and a
			few of the author's personal SvelteKit apps and sites, itemized under
			<a href="#{docs_slugify(DETAILS_SECTION_TITLE)}">Benchmarking details</a>. On that basis:
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
				A
				<a href="https://github.com/ryanatkn/oxc-bench-formatter" rel="external">
					fork of Oxc's <code>bench-formatter</code>
				</a>
				has end-to-end CLI benchmarks. On the JSX-free subset of a real TypeScript repo, with every
				tool launched through its npm package's Node bin, tsv formats ~{cli_npm_ts_vs_oxfmt} faster
				than Oxfmt and ~{cli_npm_ts_vs_biome} faster than Biome in wall-clock using
				{cli_npm_ts_memory ? format_ratio_range(cli_npm_ts_memory.min, cli_npm_ts_memory.max) : '—'}
				less memory than either. Run as the bare native binary, without the Node startup those bins
				all begin with (Biome and rsvelte-fmt ship a standalone binary too, behind their bins; Oxfmt
				has none, and Prettier is JS throughout), it's ~{cli_ts_wall_vs_oxfmt} and
				~{cli_ts_wall_vs_biome} faster (~{cli_ts_cpu_vs_oxfmt} and ~{cli_ts_cpu_vs_biome} in CPU
				work, the parallelism-neutral view) using
				{cli_ts_memory ? format_ratio_range(cli_ts_memory.min, cli_ts_memory.max) : '—'} less
				memory. Wall-clock ratios bake in each tool's multi-file parallelism — see the notes in
				<a href="#{docs_slugify(CLI_SECTION_TITLE)}">the CLI section</a>.
			</li>
			<li>
				Parsing TypeScript into JS with a span-only payload matched to Oxc's, tsv lands
				~{parse_ts_vs_oxc} ahead of Oxc and ~{parse_ts_yuku_vs_tsv} behind yuku-parser
				(~{parse_ts_yuku_vs_tsv_wasm} wasm-vs-wasm). Most of the Oxc margin is tsv's lighter wire
				through <code>JSON.parse</code> rather than the Rust side, by tsv's harness's own
				accounting. tsv's default AST adds per-node line/column <code>loc</code> for drop-in acorn
				and Svelte AST compatibility, costing ~{parse_ts_loc_cost} the parse-and-hand-off time and
				putting that default behind Oxc's span-only wire (and behind swc's, span-only in its own AST
				shape).
			</li>
			<li>
				Parsing Svelte, that default <code>loc</code>-bearing AST lands in JS
				~{parse_svelte_vs_compiler} faster than svelte/compiler's (JS) and
				~{parse_svelte_vs_rsvelte} faster than rsvelte's (native-vs-native). CSS runs the other way:
				Svelte's own <code>parseCss</code> is ~{parse_css_compiler_vs_tsv} faster than tsv's JSON
				wire and PostCSS ~{parse_css_postcss_vs_tsv}.
			</li>
			{#if cli_svelte_wall != null || cli_svelte?.aborted}
				<li>
					The fork's Svelte scenario benches tsv against rsvelte-fmt, the other Rust Svelte-native
					formatter, on a third-party <code>.svelte</code> corpus.
					{#if cli_svelte_wall != null}
						There tsv formats ~{cli_svelte_npm_wall} faster through its npm dispatcher, the footing
						rsvelte-fmt's own Node launcher is timed on, and ~{format_ratio_approx(cli_svelte_wall)}
						faster as the bare binary
						{#if cli_svelte_memory != null}
							using ~{cli_svelte_npm_memory} and ~{format_ratio_approx(cli_svelte_memory)} less
							memory, respectively.
						{:else}
							but has no memory figure.
							{#if cli_svelte?.aborted}
								{cli_svelte.aborted} See
								<a href="#{docs_slugify(CLI_SECTION_TITLE)}">the CLI section</a>.
							{/if}
						{/if}
					{:else}
						It currently publishes no numbers — the harness aborted it rather than time it.
						{cli_svelte?.aborted} See
						<a href="#{docs_slugify(CLI_SECTION_TITLE)}">the CLI section</a>.
					{/if}
				</li>
			{/if}
		</ul>
		<p>
			Each section's notes contextualize its numbers. The charts are the {node_display} run; a
			<a href="#{docs_slugify(CROSS_RUNTIME_SECTION_TITLE)}">cross-runtime comparison</a> closes the
			page.
		</p>
	</TomeSection>

	<TomeSection>
		<TomeSectionHeader text="Like Prettier but speedier" />
		<BenchmarksSummary rows={speedup_rows} />
		{#if unstable_entries.length}
			<aside class="mixed-vintage">
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
		<p class="mb_xl5">
			tsv's formatter is similar to <a href="https://oxc.rs/docs/guide/usage/formatter">Oxfmt</a>,
			<a href="https://biomejs.dev/formatter/">Biome</a>, and
			<a href="https://dprint.dev/plugins/typescript/">dprint</a>. It formats Svelte, TypeScript,
			and CSS, plus JS through the same TypeScript parser. These are single-threaded measurements;
			multi-file parallelism is measured in the CLI section:
		</p>
		{#each format_groups as group (group.language)}
			<BenchmarksGroup {group} {corpus} />
		{/each}
		<aside class="mt_xl5">
			<p>Notes:</p>
			<ul>
				<li>wasm-vs-wasm and native-vs-native (N-API here) are the like-for-like pairings.</li>
				<li>
					Every formatter is pinned to tsv's fixed style (width 100, tabs, single quotes, no
					trailing commas) in its own option dialect, so each row does the same layout work, and the
					harness probes that each pin landed on every timed formatter tsv faces (by behavior, so
					where a pin matches the tool's own default — Biome's tabs, Oxfmt's width — it proves
					nothing). Nothing here grades output against an oracle — the bench checks only that output
					is non-empty and that tsv's native and wasm builds agree byte for byte — so a tool
					emitting wrong output quickly would still read as fast. One case is concrete: Biome's
					<code>formatContent</code> returns the input unchanged when the file fails its syntax
					check, and the harness never reads the diagnostics returned beside it, so a file Biome
					can't parse is timed as formatted (a parse plus a no-op) and counted as covered — its
					coverage count is no evidence it parsed every file. tsv's own output is checked against
					Prettier's in <a href="https://github.com/fuzdev/tsv">its repo's gates</a>, separately
					from timing.
				</li>
				<li>
					Every tool that takes a filename is handed a synthetic one (<code>file.ts</code>,
					<code>file.css</code>, <code>file.svelte</code>), never the real path, so the corpus's
					<code>.js</code> files are formatted as TypeScript by every row, Prettier's included (a
					real Prettier run would hand a <code>.js</code> file to its Babel parser instead; which
					way that moves Prettier's time is unmeasured).
				</li>
				<li>
					Each format row includes the tool's own parse: the timing is source in, formatted text
					out. Biome's only in-process format entry point, <code>formatContent</code>, also opens
					the file in its workspace, pulls syntax diagnostics (which the harness doesn't read — see
					above), and closes it on every call, so its rows carry that wrapper as well as its
					formatter.
				</li>
				<li>
					Oxfmt formats TypeScript, JS, and CSS with its own native engine, and for Svelte it
					delegates to Prettier internally (via
					<a href="https://github.com/sveltejs/prettier-plugin-svelte">prettier-plugin-svelte</a>,
					with the embedded <code>&lt;script&gt;</code> still formatted by its native engine and the
					<code>&lt;style&gt;</code> by the bundled Prettier's CSS printer; the plugin needs the
					project's own <code>svelte</code> package at runtime, which the bench provides).
				</li>
				<li>
					Biome has no dedicated Svelte formatter: its Svelte row runs with
					<code>html.experimentalFullSupportEnabled</code>, the experimental HTML-superset pipeline
					that lets it format <code>.svelte</code> at all, embedded script and style included, so
					the work is comparable; without the flag it returns empty output. The harness makes one
					intervention for Biome alone. <code>@biomejs/js-api</code> closes each file it opens, but
					its wasm workspace doesn't release the linear memory an open retains (tsv's harness
					measures it at a few bytes per source byte, and wasm linear memory never shrinks), so the
					harness rebuilds the instance once it has grown. The swap runs outside every timer, but
					the row pays each fresh instance's cold first sweep: about three percent on Node on a
					full-corpus row, where the swap comes every sweep, and four on CSS, where it comes every
					fourth. That is insurance against a sweep that nearly triples once a leaking run passes a
					gigabyte — a size this Node run's rows may not reach.
				</li>
				<li>
					There's no native Biome entry: <code>@biomejs/js-api</code>, its in-process API, backs
					onto its wasm builds alone, and the native engine reaches npm only as the
					<code>biome</code> CLI binary — a separate process, not a library JS can call in-process.
				</li>
				<li>
					The dprint entry is
					<a href="https://dprint.dev/plugins/typescript/">dprint-plugin-typescript</a>, the engine
					<code>deno fmt</code> runs for TypeScript and JS, loaded in-process as its wasm plugin. It
					formats TypeScript and JS only — the plugin rejects CSS and Svelte, and dprint's markup
					plugin, which doesn't format Svelte, isn't wired in — so it's grayed out in the Svelte
					group, and its CSS slot goes to <a href="https://github.com/g-plane/malva">malva</a>, a
					third-party CSS plugin for the same dprint host. This times the engine, not the
					<code>deno fmt</code> CLI: a subprocess per file would measure process startup instead of
					formatting.
				</li>
				<li>
					<a href="https://github.com/baseballyama/rsvelte" rel="external">rsvelte-fmt</a>, the
					other Rust-native Svelte formatter, is grayed out for a different reason than dprint: it
					ran over every file (as its platform binary, invoked directly) but isn't timed, since it
					ships no in-process API and a fresh process per file would measure spawn rather than
					formatting. Its row reports coverage only.
					{#if cli_svelte_wall != null}
						For multi-threaded CLI speed, see the
						<a href="#{docs_slugify(CLI_SECTION_TITLE)}">CLI section</a>.
					{:else if cli_svelte?.aborted}
						Its multi-threaded CLI run in the
						<a href="#{docs_slugify(CLI_SECTION_TITLE)}">CLI section</a> is currently aborted rather
						than timed.
					{/if}
				</li>
			</ul>
		</aside>
	</TomeSection>

	<TomeSection>
		<TomeSectionHeader text={CLI_SECTION_TITLE} />
		<p class="mb_xl5">
			The numbers above time tsv's engine in-process, one file at a time. This section comes from a
			fork of Oxc's own
			<a href="https://github.com/oxc-project/bench-formatter" rel="external">
				<code>bench-formatter</code>
			</a>
			that <a href="https://github.com/ryanatkn/oxc-bench-formatter" rel="external">adds tsv</a>. It
			times the whole CLI end to end — process spawn, file discovery, I/O, each tool's default
			multi-file parallelism — plus peak memory (each run's peak RSS under GNU <code>time</code>,
			averaged over a separate, unwarmed pass of the same number of runs rather than read off the
			timed ones): what you experience typing the command, on real code. tsv appears only in the
			JSX-free scenarios (it has no JSX/TSX parser). Every formatter is installed from npm, pinned
			by the fork's lockfile, and the other tools are timed through their packages' bins as pnpm
			links them — a shell shim that starts Node first (Prettier's runs in JS from there; Biome's
			and rsvelte-fmt's launch a native binary each ships, which isn't timed on its own here;
			Oxfmt's loads its native engine into Node as an addon, and has no standalone binary). tsv gets
			two rows. <code>{CLI_TSV_NPM_LABEL}</code> is the launcher-matched, like-for-like one: the
			Node bin of <a href="https://www.npmjs.com/package/@fuzdev/tsv"><code>@fuzdev/tsv</code></a>,
			what <code>npx tsv</code> runs, normally behind a shim the harness derives from pnpm's own,
			launching the native binary as Biome's and rsvelte-fmt's bins do (a table says so when the
			harness couldn't shim it). The shim is derived rather than reused because pnpm gives the
			<code>tsv</code> bin name to the WASM package, so the harness copies that shim and repoints
			it. <code>tsv</code> runs that binary directly from the platform package, skipping Node: what
			the binary costs on its own. Tables that face other tools start their ratios against the
			dispatcher row; hovering any row, bare <code>tsv</code> included, re-baselines its table. The
			last table is tsv against itself, anchored on the bare binary: what the Node dispatcher and
			the WASM fallback each add.
		</p>
		<BenchmarksCli report={benchmarks_cli} />
		<aside class="mt_xl5">
			<p>Notes:</p>
			<ul>
				<li>
					This measures the whole command, not the engine in isolation. tsv, oxfmt, biome, and
					rsvelte-fmt parallelize across files while prettier's stable CLI formats them one at a
					time (Prettier 3.9 ships a parallel CLI behind <code>--experimental-cli</code>, which the
					harness leaves off), and no tool's thread count is pinned — each runs its default, since
					only some expose a flag — so the wall-clock ratios bake in each tool's parallelism, scale
					with core count, and mean little apart from the machine they ran on. The CPU-work column —
					<a href="https://github.com/sharkdp/hyperfine">hyperfine</a>'s user plus system time,
					summed across threads — is the parallelism-neutral view. Read like for like, against the
					dispatcher row, it widens tsv's lead on the TypeScript repo: ~{cli_npm_ts_vs_oxfmt} faster
					than Oxfmt in wall-clock and ~{cli_npm_ts_cpu_vs_oxfmt} in CPU work,
					~{cli_npm_ts_vs_biome} and ~{cli_npm_ts_cpu_vs_biome} against Biome. Against the bare
					binary it narrows instead — Oxfmt ~{cli_ts_wall_vs_oxfmt} to ~{cli_ts_cpu_vs_oxfmt}, Biome
					~{cli_ts_wall_vs_biome} to ~{cli_ts_cpu_vs_biome}. The difference between the two footings
					is Node's startup, not the engines: for tsv's dispatcher a fixed ~{cli_npm_overhead_ms} ms
					paid before the binary starts, which is ~{format_share_approx(cli_npm_ts_share?.wall)} of
					its wall-clock on the repo but ~{format_share_approx(cli_npm_ts_share?.cpu)} of its CPU
					total. Every other row pays a Node start of its own, which this harness doesn't isolate.
				</li>
				<li>
					CPU work is a clean engine proxy only while the threads do real work. A JS tool's figure
					also counts work off the main thread (most likely V8's GC and compilation threads), so
					even Prettier's CPU time runs above its wall-clock; and on the single file, a tool that
					spins up a worker pool it can't use reads CPU above wall-clock too. Compare the two
					columns per row before reading either as engine speed.
				</li>
				<li>
					Peak memory is less tied to core count than wall-clock (though nothing here measures it
					against thread count), so it should travel better between machines — tsv uses
					{cli_npm_memory ? format_ratio_range(cli_npm_memory.min, cli_npm_memory.max) : '—'} less
					than every other tool in every scenario it faces them through its npm dispatcher, and
					{cli_memory ? format_ratio_range(cli_memory.min, cli_memory.max) : '—'} less as the bare
					binary. The figure is the largest single process in each command's tree, not the sum
					(where the CPU-work column does sum the tree), so a row that launches a native binary from
					Node — Biome's, rsvelte-fmt's, and tsv's dispatcher — is understated: the smaller
					processes in its tree don't count. Prettier's, Oxfmt's, and the bare <code>tsv</code> rows
					each run as one process and are measured whole. The dispatcher's peak,
					~{cli_npm_memory_mb === undefined ? '—' : Math.round(cli_npm_memory_mb)} MB, is still
					below every other tool's — and, by the harness's own note, about the size of the launcher
					Biome's and rsvelte-fmt's rows leave out.
				</li>
				<li>
					On the large single file, where Node's fixed startup is the largest share of a short run,
					tsv through its dispatcher is ~{cli_npm_single_vs_oxfmt} faster than Oxfmt and
					~{cli_npm_single_vs_biome} faster than Biome. Hover the bare <code>tsv</code> row for what
					the binary does invoked directly, without a Node bin in front.
				</li>
				<li>
					The delivery table is tsv against tsv, on one file. Through <code>@fuzdev/tsv</code>'s
					Node dispatcher (npx's own resolution isn't counted), the same binary takes
					~{cli_delivery_npm_wall} as long — Node starting up to spawn it and staying resident until
					it exits. That ~{cli_npm_overhead_ms} ms is fixed, so its share shrinks against a real
					repo: there the dispatcher takes ~{cli_npm_ts_cost} as long rather than
					~{cli_delivery_npm_wall}.
					<a href="https://www.npmjs.com/package/@fuzdev/tsv-wasm"><code>@fuzdev/tsv-wasm</code></a>
					— the fallback for platforms without a prebuilt binary, not the default — runs the same
					CLI over a WASM engine inside Node at ~{cli_wasm_wall} the time and ~{cli_wasm_memory} the
					memory of the native binary: still well ahead of both Prettier rows on the same file
					above, and behind Oxfmt and Biome.
				</li>
				<li>
					Formatting configuration is matched. tsv is non-configurable (width 100, tabs, single
					quotes, no trailing commas), so every formatter it faces is configured to that same
					profile in its own dialect — the outputs still differ where the tools make different
					decisions. The preflight asserts that every formatter reporting a file count reports the
					same one (the two Prettier rows report none, so they sit that check out) and that every
					formatter finds at least one file to change, so a mis-scoped tool formatting nothing can't
					post an unbeatable time; a self-test run before the suite checks that those guards still
					read each tool's diagnostics. The cost is that these rows aren't comparable with
					upstream's published numbers, which leave the tools nearer their defaults — width 80 in
					three of upstream's four scenarios.
				</li>
				<li>
					The tools are pinned but one corpus isn't: the TypeScript repo is Outline cloned at its
					default branch's head, so its file set moves whenever the corpus is re-cloned. Every
					formatter is scoped to the JSX-free <code>.ts</code>/<code>.js</code> family — the others
					by their own config, tsv (which has none) by the extensions it walks — leaving out the
					<code>.tsx</code> and <code>.jsx</code> tsv can't parse, and that preflight file-count
					check holds the two scopes to the same set. The single file (the TypeScript compiler's
					<code>parser.ts</code> at a pinned release) and the Svelte corpus (a pinned
					<a href="https://github.com/fuzdev/corpora">fuzdev/corpora</a> commit) are fixed.
				</li>
				<li>
					Nothing is skipped and no failure is timed around: every scenario tsv runs in starts with
					a preflight parse check, and a run that errors partway fails the scenario instead of being
					timed (the three scenarios tsv sits out keep hyperfine's <code>--ignore-failure</code>, so
					a formatter that errors partway is timed there rather than penalized). A scenario whose
					preflight fails is aborted before timing and shown here as aborted rather than dropped — a
					crash in one formatter's check must not become a fast partial run. tsv is left out of
					those three scenarios because they contain JSX/TSX; two of them also measure work tsv
					doesn't do (embedded-language formatting in one; import, Tailwind-class, and
					<code>package.json</code> sorting in the other).
				</li>
				<li>
					hyperfine runs the commands in the order given, with no interleaving or shuffling, so on a
					machine that thermally throttles the later tools run warmer. Every scenario here puts the
					bare tsv binary last, with its npm dispatcher row just before it (the tables above sort by
					time, not run order), so that drift counts against tsv, not for it. The last decimal of
					each ratio is that much noise.
				</li>
			</ul>
		</aside>
	</TomeSection>

	<TomeSection>
		<TomeSectionHeader text="Parse speed" />
		<p class="mb_xl5">
			tsv and <a href="https://oxc.rs/docs/guide/usage/parser">oxc-parser</a> share a mechanism:
			both serialize the AST to JSON in Rust and <code>JSON.parse</code> it on the JS side, native
			and wasm alike. The deliverables differ — tsv's default wire (<code>tsv-json</code> /
			<code>tsv-wasm-json</code>) carries a per-node <code>loc</code> (line/column) object that
			oxc-parser's span-only AST omits, at ~{parse_ts_loc_cost} the parse-and-hand-off time on the
			TypeScript corpus. The <code>tsv-json-no-locations</code> /
			<code>tsv-wasm-json-no-locations</code> entries (<code>no-locs</code> in the charts) drop it
			for a span-only wire of oxc's kind (the two shapes still differ in detail; with
			<code>loc</code> stripped, tsv's harness measures tsv's as the smaller), so they are the
			payload-matched comparison with oxc-parser. Line/column stays derivable from the offsets plus
			source — exactly on TypeScript. On Svelte the shipped helper matches all but two node classes
			(the <code>&lt;script&gt;</code>/<code>&lt;style&gt;</code> <code>Program</code> position
			Svelte overrides, and the column of block-binding patterns), and it adds <code>loc</code> to
			the template nodes Svelte's own wire leaves bare. It refuses what offsets alone can't place: a
			lone <code>\r</code>, U+2028, or U+2029 line terminator, and a block binding whose type
			annotation spans a line break. No row here splits the Rust side from the hand-off. tsv's repo
			ships a profiler for that split (<code>tsv_debug json_profile</code>), and tsv's harness docs
			record the two Rust sides — parse and serialize — at about parity from that profiler, with no
			published numbers and nothing reproduced here. That parity leaves most of tsv's margin to its
			lighter wire, which <code>JSON.parse</code>s faster. The tsv-internal and tsv-wasm-internal
			entries build the native AST and stop — no serialization, nothing materialized in JS — so they
			show raw engine speed, and their gap to the JSON rows is what serializing and handing off
			costs tsv, not a cross-tool comparison.
		</p>
		<p class="mb_xl5">
			yuku-parser, a JS/TS parser written in Zig, emits the same span-only AST as oxc, so it too
			compares against the <code>no-locs</code> entries. It gets there differently: instead of JSON
			it returns a compact binary buffer that its JS side decodes into objects lazily, so the bench
			forces the whole tree and times that. The deliverable is the same fully materialized tree, so
			the entries stay comparable.
		</p>
		{#each parse_groups as group (group.language)}
			<BenchmarksGroup {group} {corpus} />
		{/each}
		<aside class="mt_xl5">
			<p>Notes:</p>
			<ul>
				<li>
					JS parsers skip the Rust-to-JS serialization step that tsv and oxc pay for, which keeps
					them competitive — and on CSS that skip decides the order: the JSON hand-off is
					~{parse_css_wire_share} of tsv's time there (the gap to the internal row), and CSS is a
					simple enough grammar that Svelte's <code>parseCss</code> and PostCSS both finish ahead of
					<code>tsv-json</code>. The CSS corpus is also the page's weakest sample (see
					<a href="#{docs_slugify(DETAILS_SECTION_TITLE)}">Benchmarking details</a>), so those
					ratios carry the most noise.
				</li>
				<li>
					Biome is grayed out across all three parse groups:
					<a href="https://www.npmjs.com/package/@biomejs/js-api"><code>@biomejs/js-api</code></a>
					exposes formatting and linting only, so the AST it parses internally never crosses the JS
					boundary and can't be measured.
				</li>
				<li>
					oxc-parser, yuku-parser, and swc parse TypeScript and JS (and JSX, not measured here) only
					— no CSS, no Svelte, no formatter — so they appear in the TypeScript parse group alone.
					oxc-parser's AST has no line/column option to turn on (only a <code>range</code> flag that
					repeats the offsets as a pair), so the span-only <code>no-locs</code> entries are the one
					payload-matched pairing available. Its experimental raw-transfer mode (native only) is not
					a row: tsv's harness measured it setup-dominated and slower than the eager JSON path it
					does time. Its wasm row runs an older release than its native row — the newest whose wasi
					binding loads in tsv's harness install (later ones nest a wasm-runtime helper at a version
					the hoisted runtime doesn't match, and throw on first use; a root override would fix it,
					which the harness declines to apply) — so the wasm-vs-wasm pairing crosses oxc versions
					(both are listed under Benchmarking details); that binding also hands back its JSON
					unparsed, so the harness materializes it itself, through oxc's own parse wrapper, into the
					tree the native row does.
				</li>
				<li>
					One small bias runs tsv's way: oxc-parser and yuku-parser hand back regex literals as real
					<code>RegExp</code> objects, where tsv's JSON wire carries the pattern and flags and
					leaves construction to the consumer. Regex literals are sparse in this corpus, so the bias
					sits well under the noise.
				</li>
				<li>
					When line/column is needed, the fast path is not tsv's default <code>loc</code>-bearing
					wire but the span-only one plus a JS-side reconstruction of locs from the offsets and
					source (<code>reconstruct_locations</code>, shipped in every parse-capable tsv package) —
					measured on TypeScript and recorded in a footnote of
					<a href="https://github.com/fuzdev/tsv/blob/main/benches/js/results/report.node.md">
						tsv's bench report
					</a>
					rather than charted here.
				</li>
				<li>
					rsvelte's parser is the only other Svelte parser here, and it matches tsv's default wire
					in mechanism and payload: a JSON string carrying per-node <code>loc</code>, within a few
					percent of <code>tsv-json</code>'s bytes, which the caller <code>JSON.parse</code>s — so
					<code>rsvelte-parse</code> compares against <code>tsv-json</code>, not the
					<code>no-locs</code> entries. Its second entry passes rsvelte's own
					<code>skipExpressionLoc</code>, which drops <code>loc</code> only on embedded JS
					expressions and keeps the top-level offsets, a different trade than tsv's span-only wire,
					hence the entry is named for the option.
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
					PostCSS is the only other CSS parser here; none of the Rust CSS tools considered offers a
					parse call: <a href="https://lightningcss.dev/">Lightning CSS</a> ships
					<code>transform</code> and <code>bundle</code> only, whose visitor callbacks can hand JS
					the whole stylesheet — but only as a side channel of a transform run, never as a parse
					product; Biome surfaces no parser; and malva is a formatter. PostCSS is also the parser
					behind Prettier's CSS printer, so it's the parse-side counterpart of the Prettier format
					entry.
				</li>
			</ul>
		</aside>
	</TomeSection>

	<TomeSection>
		<TomeSectionHeader text="Parse conformance" />
		<p class="mb_xl5">
			Where the speed numbers above use real-world code, this section measures parse
			<em>coverage</em>: how much of a much larger, deliberately hard corpus each parser accepts —
			Prettier's and prettier-plugin-svelte's format-test suites (Prettier's HTML fixtures ride
			along in the Svelte set as plain HTML documents, under two percent of it), Svelte's compiler
			test suite, CSS extracted from
			<a href="https://github.com/web-platform-tests/wpt">web-platform-tests</a>,
			<a href="https://github.com/tc39/test262">test262</a>'s expected-valid tests, parsed at the
			goal each declares (every other file is parsed as a module), and the single-file cases from
			the <a href="https://github.com/microsoft/TypeScript">TypeScript compiler</a>'s own test suite
			that tsc's parser accepts and whose recorded baselines carry no syntax error. JSX is out of
			the corpus by construction — Prettier's JSX fixtures and the compiler's <code>.tsx</code>
			cases are dropped, since tsv rejects JSX where every other TypeScript engine here parses it —
			so this table says nothing about that gap.
		</p>
		{#if benchmarks_cross_runtime_json.conformance_vintage?.stale}
			<aside class="mixed-vintage">
				⚠ The conformance report backing this section comes from a different commit than the speed
				reports above, so the two sections describe different builds until they are re-run from one
				commit.
			</aside>
		{/if}
		<BenchmarksConformance groups={conformance_groups} />
		<aside class="mt_xl5">
			<p>Notes:</p>
			<ul>
				<li>
					Coverage is per engine, not per binding, so each tool appears once. That is exact for tsv,
					whose native and wasm rows the bench holds to byte-identical output (bar one
					pathologically deep TypeScript file the check can't digest, which the report discloses).
					For the other tools the two bindings are only expected to agree, and oxc-parser's don't
					quite: its wasm binding is pinned to an older release (see the parse notes), and the two
					accept sets differ by a couple of files. That may be an engine change between those
					releases rather than a binding difference; the native row stands.
				</li>
				<li>
					The yuku-parser row is its wasm binding: the native one segfaults on test262's
					escaped-identifier tests, where a single identifier is a long run of braced unicode
					escapes. Wasm runs the same parser with the fault contained, so the number stands — and on
					the speed corpus above, which has no such identifiers, both bindings are measured.
				</li>
				<li>
					For Svelte, the corpus excludes the files svelte/compiler itself rejects, so its number is
					100% by construction and the rest read as drop-in fidelity against it. For TypeScript and
					CSS the canonical parser is no clean validity oracle
					(<a href="https://github.com/sveltejs/acorn-typescript">acorn-typescript</a> trails modern
					syntax; Svelte's CSS parser errs in both directions), so Prettier's fixtures and the CSS
					suites keep intentionally-invalid and out-of-scope inputs (wpt's deliberately-invalid CSS,
					preprocessor syntax in Prettier's <code>.css</code> fixtures) — read those relative to
					each other, not as an absolute target. The two large TypeScript slices, test262 and the
					TypeScript compiler's, are validity-filtered; they get their own note below.
				</li>
				<li>
					The CSS spread is a grammar difference, not a verdict. The reference row is Svelte's
					<code>parseCss</code>, which tsv is a drop-in for — and, as above, no authority on valid
					CSS. PostCSS rejects a handful of files <code>parseCss</code> accepts (<code>//</code>
					comments, a missing semicolon) and accepts more that it rejects: mostly modern CSS
					Svelte's parser doesn't implement yet (<code>@supports selector(…)</code> and the like).
					So PostCSS landing a shade above tsv in the aggregate is two grammars, not a gap. Most of
					that margin is wpt files; on Prettier's CSS suite it is far wider, much of it preprocessor
					syntax in Prettier's <code>.css</code> fixtures, which PostCSS parses structurally because
					it doesn't validate at-rule preludes. tsv, too, lands a little above
					<code>parseCss</code>, nearly all of it on wpt files; its repo profiles that
					over-acceptance against a pinned count of the files <code>parseCss</code> rejects rather
					than characterizing it.
				</li>
				<li>
					Read the TypeScript aggregate by slice: ~{format_share_approx(ts_test262?.share)} of it is
					the test262 slice and ~{format_share_approx(ts_repo?.share)} the TypeScript compiler's, so
					the column is mostly two validity-filtered slices, one selected by tsv and one by tsc. On
					Prettier's own JS fixture suite
					({ts_prettier_js ? format_count(ts_prettier_js.total) : '—'} files), the largest slice
					neither of them scoped, tsv accepts {prettier_js_accepted('tsv')}, oxc-parser
					{prettier_js_accepted('oxc-parser')}, yuku-parser {prettier_js_accepted('yuku-parser')},
					and tsc {prettier_js_accepted('tsc')}.
				</li>
				<li>
					Two rows read 100% on a slice they selected themselves. The <code>tsc</code> row is the
					TypeScript compiler's own parser{tsc_label}, here as a verdict, not a speed: it chose the
					TypeScript-compiler slice (its conformance and compiler cases, keeping only those it
					parses cleanly), and elsewhere rejects a share of Prettier's TypeScript/JS suites and a
					small tail of test262, so it doesn't read 100% overall. The test262 slice is tsv's: the
					cache keeps the expected-valid subset of the tests tsv's runner grades, dropping what's
					outside tsv's scope before the split — every Annex B <code>noStrict</code> positive among
					them, a web-compatibility grammar tsv declines as a non-browser host — and tsv's repo
					gates on passing all of it. Another parser's number there is its rate on tsv's slice, not
					on test262; the dropped tests are never put to any parser here.
				</li>
				<li>
					Accepting a file says nothing about producing the <em>right</em> AST — tsv's output is
					separately verified against the canonical parsers (svelte/compiler and its
					<code>parseCss</code>, acorn-typescript) at corpus scale in
					<a href="https://github.com/fuzdev/tsv">its repo's conformance gates</a>. Nor does
					coverage reward rejecting what should be rejected: it counts acceptance only, so a
					permissive parser scores well here. tsv defers most early errors — of test262's
					should-reject parse tests it currently rejects fewer than half, tracked in
					<a href="https://github.com/fuzdev/tsv/blob/main/docs/conformance_test262.md">
						its test262 notes
					</a>.
				</li>
			</ul>
			{#if benchmarks_conformance_json.corpus_sources?.length}
				<p>
					Corpus sources ({benchmarks_conformance_json.corpus_sources.length}) — a source the report
					pins links to its measured commit; a harvested upstream cache links to the repo root:
				</p>
				<ul>
					{#each benchmarks_conformance_json.corpus_sources as source (source.path)}
						{@const url = corpus_source_url(source)}
						<li>
							{#if url}
								<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
								<a href={url} rel="external"><code>{source.path}</code></a>
							{:else}
								<code>{source.path}</code>
							{/if}
							— {format_corpus_source_files(source)}
						</li>
					{/each}
				</ul>
			{/if}
		</aside>
	</TomeSection>

	<TomeSection>
		<TomeSectionHeader text="Binary size" />
		<p>
			tsv covers only Svelte, TypeScript/JS, and CSS, so it can be smaller when that's all you need
			— which matters most in the browser via wasm. Bars and ratios are raw on-disk bytes; the
			<code>gz</code> annotation beside each is the gzipped size, the better estimate of a download.
		</p>
		<BenchmarksSizes sizes={benchmarks_json.binary_sizes} />
		<aside class="mt_xl5">
			<p>Notes:</p>
			<ul>
				<li>
					Each group mixes wasm and native builds under one anchor, so a ratio can cross kinds —
					compare like with like within a group. The <code>(ffi)</code> tsv entries are its C-ABI
					build, which isn't published: what the engine costs in that configuration, not something
					you can install (its format-only and parse-only variants are built for this table alone
					and never timed).
				</li>
				<li>
					yuku-parser parses TypeScript and JS and ships no formatter, so both its builds sit under
					Parser — but tsv's parse-only builds beside them carry parsers for Svelte and CSS too, so
					the gap there is scope as much as engine.
				</li>
				<li>
					<code>tsv (ffi)</code>, <code>tsv (napi)</code>, and <code>tsv-wasm</code> are the full
					builds: parser and formatter for Svelte, TypeScript/JS, and CSS in one artifact.
				</li>
				<li>
					Biome bundles a parser, formatter, and linter for many languages, but every other native
					entry here is an in-process library (rsvelte-fmt's standalone binary aside), and Biome's
					native engine ships to npm only as the CLI binary — so only its wasm build is included.
				</li>
				<li>
					The <code>oxc-parser + oxfmt</code> entry under Full toolchain sums oxc's separate parser
					(TypeScript and JS/JSX only) and formatter packages, since together they're the closest
					equivalent to tsv's single parse+format build.
				</li>
				<li>
					That sum is a little unfair to oxc: oxfmt statically links its own copy of the oxc parser
					(it must parse to format) without depending on the <code>oxc-parser</code> package or
					exposing parsing, so the two independently compiled builds count the parser's code twice —
					more than one build exposing both operations (like tsv's) needs — and the summed
					<code>gz</code> annotation, two gzip streams rather than one, slightly overstates a
					combined download. In the other direction, the <code>oxfmt</code> addon is more than a
					formatter for tsv's three languages: it also carries oxc's CSS, JSON, GraphQL, and YAML
					formatters and a language server, so part of its size is scope tsv doesn't have.
				</li>
				<li>
					And a little unfair to tsv the other way: every entry is one artifact file, so
					<code>oxfmt (napi)</code> is its <code>.node</code> alone and leaves out the JS in the
					<code>oxfmt</code> package that loads it. That JS is nearly as large as the addon — over
					half of it Prettier with its parsers and prettier-plugin-svelte for its Svelte path,
					nearly all the rest the Tailwind class sorter and the config loader it pulls in.
					<code>rsvelte-fmt + oxfmt</code> likewise omits <code>@rsvelte/fmt</code>'s launcher
					package (a small script, though the Tailwind class sorter it depends on adds a few
					megabytes). The same rule cuts tsv's way once: <code>tsv (napi)</code> is its
					<code>.node</code> alone, and the platform package that ships it also carries the
					<code>tsv</code> CLI binary, nearly as large again. And every wasm entry is the
					<code>.wasm</code> alone, without the JS each package loads it through, a fraction of the
					artifact on either side.
				</li>
				<li>
					oxfmt ships no wasm build, so it's shown grayed-out under Formatter, holding its slot
					beside <code>oxfmt (napi)</code>.
				</li>
				<li>
					<code>rsvelte-fmt (binary)</code> is a scope mismatch of its own kind — a standalone
					executable carrying a CLI and oxc's JS/TS, CSS, and JSON formatters beside its Svelte
					engine, where the tsv entries are bare libraries.
				</li>
				<li>
					<code>rsvelte-fmt + oxfmt</code> is what you install to format a project, and the fairer
					comparison to tsv's single build: as observed with the benched release (its own docs
					describe every non-Svelte path as delegated to oxfmt), over a directory it formats the
					Svelte, JS/TS, CSS, and JSON files itself, hands everything else (Markdown, YAML, …) to
					one <code>oxfmt</code> run, and exits non-zero without it even when the directory holds
					nothing but <code>.svelte</code> (it's declared as an optional peer dependency, so
					installing <code>@rsvelte/fmt</code> alone doesn't pull it in). A single
					<code>.svelte</code> file needs no oxfmt — it formats the embedded
					<code>&lt;script&gt;</code> and <code>&lt;style&gt;</code> itself.
				</li>
				<li>
					<code>dprint (wasm)</code> and <code>malva (wasm)</code> are two plugins for the same
					dprint formatter host — TypeScript/JS and CSS respectively — and neither exposes a parser,
					so both sit under Formatter beside tsv's format-only wasm build. That build does Svelte,
					TypeScript/JS and CSS in one artifact, so each gap there is scope before it's engine.
				</li>
				<li>
					<code>swc (napi)</code> and <code>rsvelte compiler (napi)</code> are the widest scope
					mismatches in the table. Both back parse rows and ship no formatter, so they're grouped
					under Parser, but each artifact is far larger than what's measured: swc's is an entire
					compiler (transforms, minifier, bundler) where the benchmark calls only its parser, and
					rsvelte's carries the Svelte compiler plus svelte2tsx, HMR diffing and a resolver. Read
					them as what those addons ship, not as parser size.
				</li>
				<li>
					tsv's N-API addon for Node and Bun ships as
					<a href="https://www.npmjs.com/package/@fuzdev/tsv"><code>@fuzdev/tsv</code></a> (a JS
					dispatcher over prebuilt per-platform packages, which also carry the native
					<code>tsv</code> CLI binary that <code>npx tsv</code> runs); the C-FFI library Deno loads
					is that same unpublished C-ABI build.
				</li>
			</ul>
		</aside>
	</TomeSection>

	<TomeSection>
		<TomeSectionHeader text={DETAILS_SECTION_TITLE} />
		<p>
			Every timed section except the CLI benchmark is single-threaded and in-process: each library
			formats or parses one file at a time, measured sequentially with no cross-file parallelism.
			One asymmetry isn't isolated here: oxfmt's programmatic <code>format</code> is async-only, so
			each call pays an N-API task dispatch and promise resolution inside its timing that tsv's sync
			call doesn't — but each call is awaited before the next, so it is still one thread of compute
			per file. Each row is the total time to process the whole corpus once — not the multi-core
			batch throughput a CLI gets when it formats many files at once, which most of these tools (tsv
			included) can do.
		</p>
		<p>
			Within a group every tool is timed on the same file set — the intersection of what every timed
			tool accepted, so a file one of them rejects drops out of the group for everyone (the count
			above each chart is that intersection; in this report only the two TypeScript groups run short
			of the corpus total, by a few ambient <code>.d.ts</code> declarations that several of the
			other tools reject — some because the synthetic <code>file.ts</code> name hides what they are,
			the rest as a limit of their own — each excused by name in tsv's harness rather than skipped
			silently; the Svelte and CSS groups run the whole corpus). These are warm numbers: every row
			runs warmup sweeps before it is timed, so caches and allocators are primed and a cold one-shot
			call pays more; and each native or wasm call also pays a string encode and decode across the
			binding boundary that the JS tools skip. Rows run in a fixed order, not interleaved or
			shuffled: the canonical row first, then tsv's rows, then the alternatives. A forced garbage
			collection runs before each row (not each sweep), which bounds what one row's garbage costs
			the next rather than removing order as a variable. Unlike the CLI section's ordering, whatever
			residue that leaves runs against the rows after tsv's, and so does any thermal drift on a
			machine that throttles — every alternative row runs after tsv's, so order bias there counts
			for tsv rather than against it. The canonical row is the exception: it runs before tsv's, so
			the same bias runs against tsv in the summary table and in the CSS parse group, where Svelte's
			<code>parseCss</code> is that row.
		</p>
		<p>
			Every row of a runtime runs in one process under one set of flags, so its native and wasm rows
			share a heap and a configuration. Nothing pins the process to a core or holds the clock steady
			— the run is unpinned, on a laptop CPU — so thermal drift is a live possibility here, not a
			formality. The <code>tsv-wasm</code> rows run the full parse+format artifact
			<code>@fuzdev/tsv-wasm</code> ships, in the bench's Node-target bundle of it, which keeps the
			internal parse entry points the published package's public API leaves out — not the smaller
			format-only or parse-only packages. Sweep counts differ widely by row because each row gets a
			fixed time budget rather than a fixed count: every row is timed for at least {sweep_floor}
			sweeps and otherwise for as many as fit its budget (a few seconds, after a warmup sized the
			same way), so the multi-second rows stop near that floor, and after outlier cleaning — which
			can leave a row with fewer timings than the floor it ran — the report keeps from
			{sample_size_min} to {sample_size_max} timings per row. A low cv over a handful of sweeps is
			thinner evidence of quiet than the same cv over hundreds; the instability check behind the
			headline ratios reads every row's raw cv and drift, but proves less at the floor — where
			Prettier, the denominator of every ratio in the summary table, sits.
		</p>
		<p>
			What's measured: {format_count(corpus_file_count)} files of <code>.svelte</code>,
			<code>.ts</code>/<code>.js</code>, and <code>.css</code> — real-world code only, vendored at
			one pinned commit in the <a href="https://github.com/fuzdev/corpora">fuzdev/corpora</a>
			snapshot so one clone reproduces the corpus behind every number, from two sources: the
			author's libraries, apps, and sites (the fuz.dev ecosystem plus personal SvelteKit apps and
			sites), and upstream framework source (Svelte, SvelteKit, and the svelte.dev site). The CSS
			set also includes real-authored CSS extracted from those components'
			<code>&lt;style&gt;</code> blocks, concatenated per corpus collection (a harvest the harness
			regenerates from the snapshot rather than a file in it) — standalone CSS files are rare in
			this ecosystem, and the same bytes appear in the Svelte rows (rows are never summed). Test
			files count as real code and stay in; fixture files (formatter test suites, and fixture
			subtrees inside the measured repos) are excluded — deliberately tricky edge cases measure
			conformance, not typical throughput, and are covered by the parse-conformance section above.
		</p>
		<p class="mb_xl3">
			Two caveats on that corpus. It is dominated by the author's own code plus Svelte's, the same
			code tsv is developed and tested against and mostly tsv-formatted already, so every ratio here
			is "on this corpus", not a universal figure; the CLI section's Svelte corpus shares only its
			kit and svelte.dev trees with this one, and its five third-party component libraries are
			deliberately kept out of this view. And CSS is the weakest sample: a few dozen standalone
			files plus the per-repo <code>&lt;style&gt;</code> concatenations, which keep the one level of
			indent they carried inside their tags — so every tool re-indents them, and about three fifths
			of the CSS bytes measure a full re-indent rather than the already-formatted steady state. CSS
			ratios are the noisiest on the page for it.
		</p>
		<BenchmarksMeta baseline={benchmarks_json} />
	</TomeSection>

	<TomeSection>
		<TomeSectionHeader text={CROSS_RUNTIME_SECTION_TITLE} />
		<p>
			The same benchmark harness runs under three JS runtimes — Node, Deno, and Bun. The headline
			numbers above are the Node run. The native entry differs by runtime: Node and Bun load tsv's
			N-API addon, while Deno loads its C-FFI library. They share code but cross a different binding
			boundary, so a per-runtime delta on the same row is a runtime effect — the JS engine, the
			host's N-API implementation, or the binding boundary — rather than a difference in tsv's
			algorithms. It isn't quite one binary either: the same source at the same optimization
			settings, but the N-API build keeps panic unwinding where the FFI one aborts, which changes
			code generation as well as adding the unwind tables the binary-size table counts against it. A
			delta the report itself finds inside the two measurements' noise is marked <code>≈</code> in
			the tables and is no effect at all.
		</p>
		<aside class="mt_xl5 mb_xl5">
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

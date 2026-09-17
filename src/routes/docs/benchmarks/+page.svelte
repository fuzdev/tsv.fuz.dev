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
		derive_benchmark_groups,
		derive_conformance_groups,
		derive_speedup_summary,
		derive_unstable_entries,
		format_unstable_readings,
		corpus_source_url
	} from './benchmark_data.ts';
	import {
		format_corpus_source_files,
		format_count,
		format_ratio_approx,
		format_ratio_range
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

	const corpus = benchmarks_json.corpus;
	// Read off the report so the "What's measured" figure can't drift from the
	// copied data (the report carries per-language file counts, not bytes).
	const corpus_file_count = Object.values(corpus).reduce((sum, n) => sum + n, 0);
	// The rows the report itself flagged as unstable (see `is_entry_unstable`) —
	// disclosed beside the headline ratios, since each divides two of these means.
	const unstable_entries = derive_unstable_entries(benchmarks_json);
	const format_groups = groups.filter((g) => g.operation === 'format');
	const parse_groups = groups.filter((g) => g.operation === 'parse');

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
	const cli_npm_overhead_ms = cli_npm_overhead
		? [...new Set([cli_npm_overhead.min, cli_npm_overhead.max].map(Math.round))].join('–')
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
			and efficiency are tsv's next priorities. This page shows how it measures up against
			<a href="https://prettier.io/">Prettier</a>, which tsv closely follows, and against
			<a href="https://oxc.rs/">Oxc</a> and <a href="https://biomejs.dev/">Biome</a>, similar tools
			with more features and wider language support than tsv, which doesn't support
			JSX/TSX/SCSS/etc. Also included for comparison:
			<a href="https://baseballyama.github.io/rsvelte/">rsvelte</a> (Svelte parser/formatter),
			<a href="https://yuku.fyi/">Yuku</a> (TypeScript/JS parser), <a href="https://swc.rs/">swc</a>
			(TypeScript/JS parser), <a href="https://dprint.dev/">dprint-typescript</a> (TypeScript/JS
			formatter), <a href="https://github.com/g-plane/malva">malva</a> (CSS formatter, dprint's CSS
			plugin), and <a href="https://postcss.org/">PostCSS</a> (CSS parser).
		</p>
	</section>

	<TomeSection>
		<TomeSectionHeader text="tldr" />
		<p>
			Compared to Oxc and Biome, tsv is smaller and faster at formatting its supported languages,
			and on TypeScript/JS, the one language tsv and oxc-parser share, parses as fast as Oxc and
			lands its AST in JS ahead on a lighter wire — and lacks their features and language breadth.
		</p>
		<p>
			Most measurements here are single-threaded and in-process — each tool parses or formats one
			file at a time, isolating engine speed from multi-core parallelism — over
			{format_count(corpus_file_count)} files of real-world code: Svelte's own repos (svelte, kit,
			svelte.dev), the <a href="https://github.com/fuzdev">fuz.dev repos</a>, and a few of the
			author's personal SvelteKit sites. On that basis:
		</p>
		<ul>
			<li>
				Formatting TypeScript, tsv is ~{format_ts_vs_oxfmt} faster than Oxfmt (native-vs-native),
				~{format_ts_vs_prettier} faster than Prettier (native Rust vs Prettier's JS), and
				~{format_ts_vs_biome} faster than Biome (wasm-vs-wasm).
			</li>
			<li>
				Formatting Svelte, tsv is ~{format_svelte_vs_prettier} faster than Prettier (which Oxfmt's
				Svelte path delegates to internally) and ~{format_svelte_vs_biome} faster than Biome.
			</li>
			<li>
				Formatting CSS, it's ~{format_css_vs_oxfmt} faster than Oxfmt and ~{format_css_vs_biome}
				faster than Biome.
			</li>
			<li>
				A
				<a href="https://github.com/ryanatkn/oxc-bench-formatter" rel="external">
					fork of Oxc's <code>bench-formatter</code>
				</a>
				has end-to-end CLI benchmarks. On the JSX-free subset of a real TypeScript repo, with every
				tool run through the bin npm installs for it, tsv formats ~{cli_npm_ts_vs_oxfmt} faster than
				Oxfmt and ~{cli_npm_ts_vs_biome} faster than Biome in wall-clock using
				{cli_npm_ts_memory ? format_ratio_range(cli_npm_ts_memory.min, cli_npm_ts_memory.max) : '—'}
				less memory than either. Run as the bare native binary, without the Node startup those bins
				all begin with, it's ~{cli_ts_wall_vs_oxfmt} and ~{cli_ts_wall_vs_biome} faster
				(~{cli_ts_cpu_vs_oxfmt} and ~{cli_ts_cpu_vs_biome} in CPU work, the parallelism-neutral
				view) using {cli_ts_memory ? format_ratio_range(cli_ts_memory.min, cli_ts_memory.max) : '—'}
				less memory. Wall-clock ratios bake in each tool's multi-file parallelism — see the notes in
				<a href="#{docs_slugify(CLI_SECTION_TITLE)}">that section</a>.
			</li>
			<li>
				Parsing TypeScript into JS with a span-only payload matched to Oxc's, tsv lands
				~{parse_ts_vs_oxc} ahead of Oxc — the two Rust sides are at parity, and the margin is tsv's
				lighter wire through <code>JSON.parse</code> — and ~{parse_ts_yuku_vs_tsv} behind
				yuku-parser (~{parse_ts_yuku_vs_tsv_wasm} wasm-vs-wasm). tsv's default AST adds per-node
				line/column <code>loc</code> for drop-in Svelte compatibility, costing ~{parse_ts_loc_cost}
				the parse-and-hand-off time and putting that default behind Oxc's span-only wire.
			</li>
			<li>
				Parsing Svelte, that default <code>loc</code>-bearing AST lands in JS
				~{parse_svelte_vs_compiler} faster than svelte/compiler's and ~{parse_svelte_vs_rsvelte}
				faster than rsvelte's. CSS runs the other way: Svelte's own <code>parseCss</code> is
				~{parse_css_compiler_vs_tsv} faster than tsv's JSON wire and PostCSS
				~{parse_css_postcss_vs_tsv}.
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
				them are approximate:
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
				<li>wasm-to-wasm and native-to-native (N-API here) are the fair comparisons</li>
				<li>
					Every formatter is pinned to tsv's fixed style (width 100, tabs, single quotes, no
					trailing commas) in its own option dialect, so each row does the same layout work, and the
					harness probes that each pin landed on every timed formatter tsv faces. Nothing here
					verifies that output is correct, so a tool emitting wrong output quickly would still read
					as fast; tsv's own output is checked against Prettier's in
					<a href="https://github.com/fuzdev/tsv">its repo's gates</a>, separately from timing.
				</li>
				<li>
					Each format row includes the tool's own parse: the timing is source in, formatted text
					out.
				</li>
				<li>
					Oxfmt formats TypeScript, JS, and CSS with its own native engine, and for Svelte it
					delegates to Prettier internally (via
					<a href="https://github.com/sveltejs/prettier-plugin-svelte">prettier-plugin-svelte</a>,
					with the embedded <code>&lt;script&gt;</code> still formatted by its native engine).
				</li>
				<li>
					Biome has no dedicated Svelte formatter: its Svelte row runs with
					<code>html.experimentalFullSupportEnabled</code>, the experimental HTML-superset pipeline
					that lets it format <code>.svelte</code> at all, embedded script and style included, so
					the work is comparable; without the flag it returns empty output.
				</li>
				<li>
					There's no native Biome entry: its native engine ships only as the <code>biome</code> CLI
					binary, a separate process rather than an embeddable library, so it can't be fairly timed
					in-process like the others.
				</li>
				<li>
					The dprint entry is
					<a href="https://dprint.dev/plugins/typescript/">dprint-plugin-typescript</a>, the engine
					<code>deno fmt</code> runs for TypeScript and JS, loaded in-process as its wasm plugin. It
					formats TypeScript and JS only — the plugin rejects CSS and Svelte — so it's grayed out in
					the Svelte group, and its CSS slot goes to malva (next note). This times the engine, not
					the <code>deno fmt</code> CLI: a subprocess per file would measure process startup instead
					of formatting.
				</li>
				<li>
					dprint's CSS work lives in a separate plugin,
					<a href="https://github.com/g-plane/malva">malva</a>, which gets its own CSS entry over
					the same wasm host. Its HTML plugin isn't included — it doesn't format Svelte.
				</li>
				<li>
					<a href="https://github.com/baseballyama/rsvelte" rel="external">rsvelte-fmt</a>, the
					other Rust-native Svelte formatter, is grayed out for a different reason than dprint: it
					ran over every file but isn't timed, since it ships no in-process API and a fresh process
					per file would measure spawn rather than formatting. Its row reports coverage only.
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
			The numbers above time tsv's engine in-process, one file at a time. This section is a fork of
			Oxc's own
			<a href="https://github.com/oxc-project/bench-formatter" rel="external">
				<code>bench-formatter</code>
			</a>
			that <a href="https://github.com/ryanatkn/oxc-bench-formatter" rel="external">adds tsv</a>,
			timing the whole CLI end-to-end — process spawn, file discovery, I/O, each tool's default
			multi-file parallelism — plus peak memory (peak RSS, from a separate pass under GNU
			<code>time</code> rather than from the timed runs): what you experience typing the command, on
			real code. tsv appears only in the JSX-free scenarios (it has no JSX/TSX parser). Every
			formatter is installed from npm and pinned by the fork's lockfile, and timed through the bin
			npm installs for it, which starts Node first (Biome's and rsvelte-fmt's then launch a native
			binary). tsv gets two rows. <code>{CLI_TSV_NPM_LABEL}</code> is timed the same way — the Node
			bin of <a href="https://www.npmjs.com/package/@fuzdev/tsv"><code>@fuzdev/tsv</code></a>, what
			<code>npx tsv</code> runs, which then launches the native binary as Biome's and rsvelte-fmt's
			do — so it is the like-for-like row to read against the other tools. <code>tsv</code> runs
			that same binary directly out of the package's platform package, skipping the Node startup:
			what the binary costs on its own. Each table's ratios start out against the dispatcher row,
			and hovering any row re-baselines the table on it — the bare <code>tsv</code> row included.
			The last table compares tsv with itself, against the bare binary: what the npm package's Node
			dispatcher and the WASM fallback each add over it.
		</p>
		<BenchmarksCli report={benchmarks_cli} />
		<aside class="mt_xl5">
			<p>Notes:</p>
			<ul>
				<li>
					This measures the whole command, not the engine in isolation. tsv, oxfmt, and biome
					parallelize across files while prettier's stable CLI formats them one at a time, so the
					wall-clock ratios bake in each tool's parallelism and scale with core count — they're only
					meaningful alongside the machine they ran on. The CPU-work column is the
					parallelism-neutral view — total CPU time across threads,
					<a href="https://github.com/sharkdp/hyperfine">hyperfine</a>'s user plus system time — and
					read like for like, against the dispatcher row, it widens tsv's lead: on the TypeScript
					repo tsv is ~{cli_npm_ts_vs_oxfmt} faster than Oxfmt in wall-clock and
					~{cli_npm_ts_cpu_vs_oxfmt} in CPU work, and ~{cli_npm_ts_vs_biome} faster than Biome in
					wall-clock and ~{cli_npm_ts_cpu_vs_biome} in CPU work. Against the bare binary it narrows
					instead (~{cli_ts_wall_vs_oxfmt} to ~{cli_ts_cpu_vs_oxfmt}, and ~{cli_ts_wall_vs_biome} to
					~{cli_ts_cpu_vs_biome}), which is Node's startup rather than the engines: it is a
					single-threaded ~{cli_npm_overhead_ms} ms that every row but the bare binary carries — a
					large share of a parallel run's wall-clock and a small share of its CPU total. A JS tool's
					CPU figure also counts V8's background threads (GC, compilation), so even Prettier's CPU
					time runs above its wall-clock.
				</li>
				<li>
					Peak memory is far less sensitive to thread count than wall-clock, so it's the most
					directly comparable figure — tsv uses
					{cli_memory ? format_ratio_range(cli_memory.min, cli_memory.max) : '—'} less than every
					other tool in every scenario it faces them. The figure is the largest single process in
					each command's tree, not the sum, so Biome's and rsvelte-fmt's rows leave out the Node
					launcher in front of their native binary — which understates them, not tsv. Through the
					npm dispatcher the peak is the Node launcher's rather than tsv's,
					~{cli_npm_memory_mb === undefined ? '—' : Math.round(cli_npm_memory_mb)} MB, still below
					every other tool's.
				</li>
				<li>
					Like for like, through its npm dispatcher, tsv is ~{cli_npm_ts_vs_oxfmt} faster than Oxfmt
					and ~{cli_npm_ts_vs_biome} faster than Biome on the TypeScript repo, and
					~{cli_npm_single_vs_oxfmt} and ~{cli_npm_single_vs_biome} on the large single file, where
					Node's fixed startup is the largest share of a short run. Hover the bare <code>tsv</code>
					row for what the binary does when invoked directly, without npm's bin in front.
				</li>
				<li>
					The delivery table is tsv against tsv, on one file. Through <code>@fuzdev/tsv</code>'s
					Node dispatcher, the bin that <code>npx tsv</code> runs (npx's own resolution isn't
					counted), the same binary takes ~{cli_delivery_npm_wall} as long — Node starting up to
					spawn it and staying resident until it exits, a fixed cost of ~{cli_npm_overhead_ms} ms in
					every scenario here, so its share shrinks against a real repo: on the TypeScript repo it's
					~{cli_npm_ts_cost}.
					<a href="https://www.npmjs.com/package/@fuzdev/tsv-wasm"><code>@fuzdev/tsv-wasm</code></a>
					runs the same CLI over a WASM engine inside Node at ~{cli_wasm_wall} the time and
					~{cli_wasm_memory} the memory of the native binary: still ahead of the JS formatters
					above, but the fallback for platforms without a prebuilt binary, not the default.
				</li>
				<li>
					Formatting configuration is matched: tsv is non-configurable (width 100, tabs, single
					quotes, no trailing commas), so every formatter it faces is configured to that same
					profile in its own dialect (the outputs still differ where the tools make different
					decisions), and the preflight asserts that every formatter reporting a file count reports
					the same one (prettier reports none, so it sits that check out). The cost is that these
					rows aren't comparable with upstream's published numbers, which leave the tools nearer
					their defaults at width 80.
				</li>
				<li>
					Nothing is skipped and no failure is timed around: every scenario tsv runs in starts with
					a preflight parse check, every formatter accepts the whole corpus, and a run that errors
					partway fails the scenario instead of being timed (upstream's own three scenarios keep
					hyperfine's <code>--ignore-failure</code>, so a formatter that errors partway is timed
					there rather than penalized). A scenario whose preflight fails is aborted before timing
					and shown here as aborted rather than dropped — a crash in one formatter's check must not
					become a fast partial run. tsv is left out of the fork's other three scenarios because
					they contain JSX/TSX; two of them also measure work tsv doesn't do (embedded-language
					formatting in one, import and Tailwind-class sorting in the other).
				</li>
				<li>
					hyperfine runs the commands in the order given, one after another with no interleaving, so
					any thermal or cache drift over a run lands on whichever tool runs later. Every scenario
					here puts the bare tsv binary last, with its npm dispatcher row just before it, biasing
					that drift against tsv rather than for it. The two-decimal ratios carry that much noise.
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
			<code>tsv-wasm-json-no-locations</code> entries drop it for a span-only wire of oxc's kind
			(the two shapes still differ in detail; with <code>loc</code> stripped, tsv's is the smaller),
			so they are the payload-matched comparison with oxc-parser (line/column stays derivable from
			the offsets plus source, so nothing is lost). On that pairing the two Rust sides — parse plus
			serialize — are at parity, and tsv's margin is its lighter wire, which
			<code>JSON.parse</code>s faster. The tsv-internal and tsv-wasm-internal entries build the
			native AST but skip JS-side materialization entirely, showing raw engine speed and tsv's own
			serialization overhead rather than a cross-tool comparison.
		</p>
		<p class="mb_xl5">
			yuku-parser, a JS/TS parser written in Zig, emits the same span-only AST as oxc, so it too
			compares against the <code>no-locs</code> entries. It gets there differently: instead of JSON
			it returns a compact binary buffer that its JS side decodes into objects lazily, so the bench
			forces the whole tree and times that. The deliverable is the same fully materialized tree, so
			the entries stay comparable — though every cross-tool entry times parsing and the hand-off
			into JS together; this benchmark doesn't split the two.
		</p>
		{#each parse_groups as group (group.language)}
			<BenchmarksGroup {group} {corpus} />
		{/each}
		<aside class="mt_xl5">
			<p>Notes:</p>
			<ul>
				<li>
					JS parsers skip the Rust-to-JS serialization step that tsv and oxc pay for, which keeps
					them competitive — and on CSS it decides the order: the JSON hand-off is most of tsv's
					time there (compare the internal rows), and CSS is a simple enough grammar that Svelte's
					<code>parseCss</code> and PostCSS both finish ahead of <code>tsv-json</code>. The CSS
					corpus is also the page's weakest sample (see Benchmarking details), so those ratios carry
					the most noise.
				</li>
				<li>
					Biome is grayed out across all three parse groups:
					<a href="https://www.npmjs.com/package/@biomejs/js-api"><code>@biomejs/js-api</code></a>
					exposes formatting and linting only, so the AST it parses internally never crosses the JS
					boundary and can't be measured.
				</li>
				<li>
					oxc-parser parses TypeScript and JS (and JSX, not measured here) only — no CSS, no Svelte.
					Its AST has no line/column option to turn on (only a <code>range</code> flag that repeats
					the offsets as a pair), so the span-only <code>no-locs</code> entries are the one
					payload-matched pairing available. Its experimental raw-transfer mode (native only) is not
					a row: tsv's harness measured it setup-dominated and slower than the eager JSON path it
					does time.
				</li>
				<li>
					When line/column is needed, the fast path is not tsv's default <code>loc</code>-bearing
					wire but the span-only one plus a JS-side reconstruction of locs from the offsets and
					source (<code>reconstruct_locations</code>, shipped in every parse-capable tsv package) —
					measured in
					<a href="https://github.com/fuzdev/tsv/blob/main/benches/js/results/report.node.md">
						tsv's bench report
					</a>, not on this page.
				</li>
				<li>
					yuku-parser and swc both parse TypeScript and JS (and JSX, not measured here) and nothing
					else — no CSS, no Svelte, no formatter — so they appear in the TypeScript parse group
					only.
				</li>
				<li>
					rsvelte's parser is the only other Svelte parser here, and it matches tsv's default wire
					in mechanism and payload: a JSON string carrying per-node <code>loc</code>, within a few
					percent of <code>tsv-json</code>'s bytes, which the caller <code>JSON.parse</code>s,
					exactly as <code>tsv-json</code> does — so <code>rsvelte-parse</code> compares against
					<code>tsv-json</code>, not the <code>no-locs</code> entries. Its second entry passes
					rsvelte's own <code>skipExpressionLoc</code>, which drops <code>loc</code> only on
					embedded JS expressions and keeps the top-level offsets, a different trade than tsv's
					span-only wire, hence the entry is named for the option.
				</li>
				<li>
					swc parses into its own AST shape — a <code>Module</code> root carrying <code>span</code>
					offsets rather than ESTree's <code>loc</code>/<code>range</code> — so it isn't
					payload-matched to either tsv wire.
				</li>
				<li>
					PostCSS is the only other CSS parser here; none of the Rust CSS tools considered offers a
					parse call: <a href="https://lightningcss.dev/">Lightning CSS</a>'s <code>transform</code>
					can hand JS the stylesheet tree through a visitor hook, but only as a side channel of a
					transform run, Biome surfaces no parser, and malva is a formatter. PostCSS is also the
					parser behind Prettier's CSS printer, so it's the parse-side counterpart of the Prettier
					format entry.
				</li>
			</ul>
		</aside>
	</TomeSection>

	<TomeSection>
		<TomeSectionHeader text="Parse conformance" />
		<p class="mb_xl5">
			Where the speed numbers above use real-world code, this section measures parse
			<em>coverage</em>: how much of a much larger, deliberately hard corpus each parser accepts —
			Prettier's and prettier-plugin-svelte's format-test suites, Svelte's compiler test suite, CSS
			extracted from <a href="https://github.com/web-platform-tests/wpt">web-platform-tests</a>,
			<a href="https://github.com/tc39/test262">test262</a>'s expected-valid tests, parsed at the
			goal each declares, and the single-file cases from the
			<a href="https://github.com/microsoft/TypeScript">TypeScript compiler</a>'s own test suite
			that tsc itself parses cleanly.
		</p>
		{#if benchmarks_cross_runtime_json.conformance_vintage?.stale}
			<aside class="mixed-vintage">
				⚠ The conformance report backing this section comes from a different commit than the speed
				reports above, so the two sections describe different builds until it is re-run.
			</aside>
		{/if}
		<BenchmarksConformance groups={conformance_groups} />
		<aside class="mt_xl5">
			<p>Notes:</p>
			<ul>
				<li>
					Coverage is per engine, not per binding, so each tool appears once. That is exact for tsv,
					whose native and wasm rows the bench holds to byte-identical output; for the other tools
					the two bindings are only expected to agree, and oxc-parser's don't quite — its wasm
					binding is pinned to an older release (newer wasi builds fail to load), and the two accept
					sets differ by a couple of files — which may be an engine change between those releases
					rather than a binding difference. The native row stands.
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
					CSS the canonical parser isn't a clean validity oracle
					(<a href="https://github.com/sveltejs/acorn-typescript">acorn-typescript</a> trails modern
					syntax, Svelte's CSS parser is lenient), so those suites keep intentionally-invalid and
					out-of-scope inputs — read them relative to each other, not as an absolute target.
				</li>
				<li>
					The CSS spread is a grammar difference, not a verdict. The reference row is Svelte's
					<code>parseCss</code>, which tsv is a drop-in for, and unlike Svelte's parser on the
					Svelte side it is no authority on valid CSS in either direction: PostCSS rejects a handful
					of files <code>parseCss</code> accepts (<code>//</code> comments, a missing semicolon) and
					accepts more that it rejects, mostly modern CSS Svelte's parser doesn't implement yet
					(<code>@supports selector(…)</code>, mixins) rather than anything malformed. PostCSS
					landing a shade above tsv in the aggregate (which is mostly the wpt files; on Prettier's
					CSS suite the gap is wider, and there much of it is preprocessor syntax in Prettier's
					<code>.css</code> fixtures that PostCSS parses structurally because it doesn't validate
					at-rule preludes) is two grammars, not a gap. tsv, too, lands a little above
					<code>parseCss</code>, mostly on modern CSS the reference parser doesn't implement; its
					repo tracks that over-acceptance as a pinned count.
				</li>
				<li>
					Two rows read 100% on a slice they selected themselves. The <code>tsc</code> row is the
					TypeScript compiler's own parser, on this page only as a verdict rather than a speed: it
					chose the TypeScript-compiler slice (its conformance and compiler cases, keeping only
					those it parses cleanly), and elsewhere rejects a share of Prettier's TypeScript/JS suites
					and a small tail of test262, which is why it doesn't read 100% overall. The test262 slice
					is tsv's: the cache keeps the expected-valid subset of the tests tsv's runner grades,
					dropping what's outside tsv's scope before the split — every Annex B <code>noStrict</code>
					positive among them, a web-compatibility grammar tsv declines as a non-browser host — and
					tsv's repo gates on passing all of it. Another parser's number there is its rate on tsv's
					slice, not on test262; the dropped tests are never put to any parser here.
				</li>
				<li>
					Accepting a file says nothing about producing the <em>right</em> AST — tsv's output is
					separately verified against the canonical parsers (svelte/compiler, acorn-typescript) at
					corpus scale in <a href="https://github.com/fuzdev/tsv">its repo's conformance gates</a>.
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
			— which matters most in the browser via wasm.
		</p>
		<BenchmarksSizes sizes={benchmarks_json.binary_sizes} />
		<aside class="mt_xl5">
			<p>Notes:</p>
			<ul>
				<li>
					yuku-parser parses TypeScript and JS and ships no formatter, so both its builds sit under
					Parser — but tsv's parse-only builds beside them carry parsers for Svelte and CSS too, so
					the gap there is scope as much as engine
				</li>
				<li>tsv and tsv-wasm include a parser and formatter for Svelte, TypeScript/JS, and CSS</li>
				<li>
					Biome bundles a parser, formatter, and linter for many languages, but its native engine
					ships only as the CLI binary, not an embeddable library, and
					<a href="https://www.npmjs.com/package/@biomejs/js-api"><code>@biomejs/js-api</code></a>
					exposes only formatting and linting. Every native entry here is an in-process library
					call, so a subprocess CLI isn't a comparable artifact — only Biome's wasm build is
					included
				</li>
				<li>
					the <code>oxc-parser + oxfmt</code> entry under Full toolchain sums oxc's separate parser
					(TypeScript and JS/JSX only) and formatter packages, since together they're the closest
					equivalent to tsv's single parse+format build
				</li>
				<li>
					that sum is a little unfair to oxc: oxfmt statically links its own copy of the oxc parser
					(it must parse to format) without depending on the <code>oxc-parser</code> package or
					exposing parsing, so the two independently compiled builds count the parser's code twice —
					more than one build exposing both operations (like tsv's) needs
				</li>
				<li>
					and a little unfair to tsv the other way: every entry is one artifact file, so
					<code>oxfmt (napi)</code> is its <code>.node</code> alone and leaves out the JS shipped
					beside it that bundles Prettier and prettier-plugin-svelte for its Svelte path, and
					<code>rsvelte-fmt + oxfmt</code> likewise omits <code>@rsvelte/fmt</code>'s launcher
					package
				</li>
				<li>
					oxfmt ships no wasm build, so it's shown grayed-out under Formatter, holding its slot
					beside <code>oxfmt (napi)</code>
				</li>
				<li>
					<code>rsvelte-fmt (binary)</code> is a scope mismatch of its own kind — a standalone
					executable carrying a CLI and the whole oxc formatter beside its Svelte engine, where the
					tsv entries are bare libraries
				</li>
				<li>
					<code>rsvelte-fmt + oxfmt</code> is what you install to format a project, and the fairer
					comparison to tsv's single build: over a directory it delegates non-Svelte files to
					<code>oxfmt</code> and errors without it (hence the peer dependency). A single
					<code>.svelte</code> file needs no oxfmt — it formats the embedded
					<code>&lt;script&gt;</code> and <code>&lt;style&gt;</code> itself
				</li>
				<li>
					<code>dprint (wasm)</code> and <code>malva (wasm)</code> are two plugins for the same
					dprint formatter host — TypeScript/JS and CSS respectively — and neither exposes a parser,
					so both sit under Formatter beside tsv's format-only wasm build. That build does Svelte,
					TypeScript/JS and CSS in one artifact, so each gap there is scope before it's engine
				</li>
				<li>
					<code>swc (napi)</code> and <code>rsvelte compiler (napi)</code> are the widest scope
					mismatches in the table. Both back parse rows and ship no formatter, so they're grouped
					under Parser, but each artifact is far larger than what's measured: swc's is an entire
					compiler (transforms, minifier, bundler) where the benchmark calls only its parser, and
					rsvelte's carries the Svelte compiler plus svelte2tsx, HMR diffing and a resolver. Read
					them as what those addons ship, not as parser size
				</li>
				<li>
					tsv's N-API addon for Node and Bun ships as
					<a href="https://www.npmjs.com/package/@fuzdev/tsv"><code>@fuzdev/tsv</code></a> (prebuilt
					per-platform packages, which also carry the native <code>tsv</code> CLI binary that
					<code>npx tsv</code> runs); the C-FFI library Deno loads is tsv's C-ABI build, which isn't
					published
				</li>
			</ul>
		</aside>
	</TomeSection>

	<TomeSection>
		<TomeSectionHeader text="Benchmarking details" />
		<p>
			Every section except the CLI benchmark is single-threaded and in-process: each library formats
			or parses one file at a time, measured sequentially with no cross-file parallelism (oxfmt's
			programmatic <code>format</code> is an async N-API call whose native work may run off the JS
			thread, but each call is awaited before the next, so it is still one thread of compute per
			file). Each row is the total time to process the whole corpus once — not the multi-core batch
			throughput a CLI gets when it formats many files at once, which most of these tools (tsv
			included) can do.
		</p>
		<p>
			Within a group every tool is timed on the same file set — the intersection of what all of them
			accepted, so a file one tool rejects drops out of the group for everyone (the count above each
			chart is that intersection, a few files short of the corpus total where a tool rejects one).
			These are warm numbers: every row runs warmup sweeps before it is timed, so caches and
			allocators are primed and a cold one-shot call pays more; and each native call also pays a
			string encode and decode across the binding boundary that the JS tools skip. The
			<code>tsv-wasm</code> rows run the full parse+format build (the bench's own, with its internal
			parse entry points exposed, rather than the published package), not the smaller format-only or
			parse-only packages.
		</p>
		<p>
			What's measured: {format_count(corpus_file_count)} files of <code>.svelte</code>,
			<code>.ts</code>/<code>.js</code>, and <code>.css</code> — real-world code only, vendored at
			one pinned commit in the <a href="https://github.com/fuzdev/corpora">fuzdev/corpora</a>
			snapshot so one clone reproduces the corpus behind every number, from two sources: the
			author's libraries, apps, and sites (the fuz.dev ecosystem plus personal SvelteKit sites), and
			upstream framework source (Svelte, SvelteKit, and the svelte.dev site). The CSS set also
			includes real-authored CSS extracted from those components' <code>&lt;style&gt;</code> blocks,
			concatenated per corpus collection — standalone CSS files are rare in this ecosystem, and the
			same bytes appear in the Svelte rows (rows are never summed). Test files count as real code
			and stay in; fixture files (formatter test suites, and fixture subtrees inside the measured
			repos) are excluded — deliberately tricky edge cases measure conformance, not typical
			throughput, and are covered by the parse-conformance section above.
		</p>
		<p class="mb_xl3">
			Two caveats on that corpus. It is dominated by the author's own code plus Svelte's, the same
			code tsv is developed and tested against and mostly tsv-formatted already, so every ratio here
			is "on this corpus", not a universal figure; the CLI section's Svelte corpus shares only its
			kit and svelte.dev trees with this one, and its five third-party component libraries are
			deliberately kept out of this view. And CSS is the weakest sample: a few dozen standalone
			files plus the per-repo <code>&lt;style&gt;</code> concatenations, which keep the one level of
			indent they carried inside their tags — so every tool re-indents them, and most of the CSS
			bytes measure a full re-indent rather than the already-formatted steady state. CSS ratios are
			the noisiest on the page for it.
		</p>
		<BenchmarksMeta baseline={benchmarks_json} />
	</TomeSection>

	<TomeSection>
		<TomeSectionHeader text={CROSS_RUNTIME_SECTION_TITLE} />
		<p>
			The same benchmark harness runs under three JS runtimes — Node, Deno, and Bun. The headline
			numbers above are the Node run. The native entry differs by runtime: Node and Bun load tsv's
			N-API addon, while Deno loads its C-FFI library. They share code but cross a different binding
			boundary, so a per-runtime delta on the same row is a runtime effect — the JS engine or the
			binding boundary — not a difference in tsv's own engine, which is identical across all three.
		</p>
		<aside class="mt_xl5 mb_xl5">
			<p>
				The <code>tsv-internal</code> rows cross the native binding boundary but materialize nothing
				on the JS side, so a delta there is the binding boundary itself; the JSON-materializing
				parse rows add each JS engine's <code>JSON.parse</code> cost on top. Node is the headline as
				the default N-API path, not a speed pick.
			</p>
		</aside>
		<BenchmarksCrossRuntime report={benchmarks_cross_runtime_json} />
	</TomeSection>
</TomeContent>

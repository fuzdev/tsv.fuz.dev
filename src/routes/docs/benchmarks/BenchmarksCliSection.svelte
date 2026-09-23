<script lang="ts">
	import TomeSection from '@fuzdev/fuz_ui/TomeSection.svelte';
	import TomeSectionHeader from '@fuzdev/fuz_ui/TomeSectionHeader.svelte';
	import { docs_slugify } from '@fuzdev/fuz_ui/docs_helpers.svelte.ts';

	import {
		benchmarks_cli,
		cli_memory_ratio_range,
		cli_ratio_vs_tsv,
		cli_ratio_vs_tsv_npm,
		cli_tsv_npm_overhead_ms_range,
		cli_node_startup_ms,
		cli_settle_seconds,
		CLI_TS_REPO_KEY,
		CLI_DELIVERY_KEY,
		CLI_TSV_NPM_LABEL,
		CLI_TSV_WASM_LABEL,
		type CliMetric
	} from './benchmarks_cli.ts';
	import {
		format_ms,
		format_ms_range,
		format_ratio_approx,
		format_ratio_range,
		format_report_date
	} from './benchmark_display.ts';
	import BenchmarksCli from './BenchmarksCli.svelte';

	const {
		title,
		details_title
	}: {
		/** The section's heading, which the page's in-page anchors slugify. */
		title: string;
		/** The heading of the section listing the tool versions this one shares. */
		details_title: string;
	} = $props();

	// tsv through its Node dispatcher against the other tools' npm bins — the
	// like-for-like rows, which the claims lead with; the bare-binary ratios follow
	// as what the binary does without a Node launcher in front.
	const npm_ratio = (scenario: string, label: string, metric: CliMetric = 'wall_ms') =>
		format_ratio_approx(cli_ratio_vs_tsv_npm(scenario, label, metric));
	const bare_ratio = (scenario: string, label: string, metric: CliMetric = 'wall_ms') =>
		format_ratio_approx(cli_ratio_vs_tsv(scenario, label, metric));
	const npm_ts_vs_oxfmt = npm_ratio(CLI_TS_REPO_KEY, 'oxfmt');
	const npm_ts_cpu_vs_oxfmt = npm_ratio(CLI_TS_REPO_KEY, 'oxfmt', 'cpu_ms');
	const ts_wall_vs_oxfmt = bare_ratio(CLI_TS_REPO_KEY, 'oxfmt');
	const ts_cpu_vs_oxfmt = bare_ratio(CLI_TS_REPO_KEY, 'oxfmt', 'cpu_ms');
	const memory = cli_memory_ratio_range();
	const npm_memory = cli_memory_ratio_range({ baseline_label: CLI_TSV_NPM_LABEL });
	// the dispatcher's cost in absolute terms, which is what makes it "fixed": roughly
	// the same few tens of milliseconds whether the run is one file or a repo
	const npm_overhead = format_ms_range(cli_tsv_npm_overhead_ms_range());
	// the machine's bare Node launch, the floor under every npm-bin row
	const node_startup_ms = cli_node_startup_ms();
	// the same cost as a share: the delivery table's one file, then the multi-file repo
	const delivery_npm_wall = bare_ratio(CLI_DELIVERY_KEY, CLI_TSV_NPM_LABEL);
	const npm_ts_cost = bare_ratio(CLI_TS_REPO_KEY, CLI_TSV_NPM_LABEL);
	// what the WASM package costs over the native binary, from the tsv-only delivery scenario
	const wasm_wall = bare_ratio(CLI_DELIVERY_KEY, CLI_TSV_WASM_LABEL);
	const wasm_memory = bare_ratio(CLI_DELIVERY_KEY, CLI_TSV_WASM_LABEL, 'memory_mb');
	// the idle before each formatter's warmups, which narrows the run-order drift —
	// quoted when every scenario records the same one (a plain string, so the leading
	// space survives Svelte's block-edge trimming)
	const settle_seconds = cli_settle_seconds();
	const settle_note =
		settle_seconds === undefined
			? ''
			: ` — a drift narrowed, not removed, by a ${settle_seconds} s idle before each formatter's warmups`;
	// The harness records its own machine and tool versions; the shape test holds them
	// to the ones the details section lists, so only what the harness alone records is
	// quoted: when and from which revision it ran, the thread count its wall-clock
	// scales with, and the tsv packages it installs.
	const cli_date = format_report_date(benchmarks_cli.timestamp);
	const cli_commit_url = `https://github.com/ryanatkn/oxc-bench-formatter/commit/${benchmarks_cli.git_commit}`;
	const cli_tsv_binary = benchmarks_cli.tsv_binary;
	const cli_tsv_wasm_version = benchmarks_cli.versions['tsv-wasm'];
</script>

<TomeSection>
	<TomeSectionHeader text={title} />
	<p>
		The numbers above time tsv's engine in-process, one file at a time. This section comes from a
		fork of Oxc's own
		<a href="https://github.com/oxc-project/bench-formatter" rel="external">
			<code>bench-formatter</code>
		</a>
		that <a href="https://github.com/ryanatkn/oxc-bench-formatter" rel="external">adds tsv</a>. It
		times the whole CLI end to end — process spawn, file discovery, I/O, each tool's default
		multi-file parallelism — plus peak memory: what you experience typing the command, on real code.
		The fork's JSX scenarios are left out, since tsv has no JSX/TSX parser. Every formatter is
		installed from npm, pinned by the fork's lockfile, and the other tools are timed through their
		packages' Node bins. Facing them, tsv gets two rows. <code>{CLI_TSV_NPM_LABEL}</code> is the
		like-for-like one: the Node bin of
		<a href="https://www.npmjs.com/package/@fuzdev/tsv"><code>@fuzdev/tsv</code></a>, what
		<code>npx tsv</code> runs, launching the native binary as Biome's and rsvelte-fmt's bins do.
		<code>tsv</code> runs the binary directly from the platform package, skipping Node: what the
		binary costs on its own.
	</p>
	<BenchmarksCli report={benchmarks_cli} />
	<aside>
		<p>Notes:</p>
		<ul>
			<li>
				<code>prettier + oxc-parser</code> is Prettier with <code>@prettier/plugin-oxc</code>, which
				swaps in Oxc's Rust parser while printing stays in JS.
			</li>
			<li>
				tsv, Oxfmt, Biome, and rsvelte-fmt parallelize across files; Prettier's stable CLI formats
				them one at a time (Prettier 3.9's parallel CLI sits behind <code>--experimental-cli</code>,
				which the harness leaves off). No tool's thread count is pinned, so the wall-clock ratios
				bake in each tool's parallelism, scale with core count, and mean little apart from this
				machine. The CPU ratio column —
				<a href="https://github.com/sharkdp/hyperfine">hyperfine</a>'s user plus system time, summed
				across threads and child processes — is the parallelism-neutral view, but only a rough
				engine proxy: it also counts work beside the formatting, enough that even Prettier's CPU
				time runs above its wall-clock.
			</li>
			<li>
				CPU ratios barely move between tsv's two rows, since the dispatcher's fixed launch cost is
				small beside the CPU a repo takes: on the TypeScript repo tsv leads Oxfmt
				~{npm_ts_cpu_vs_oxfmt} in CPU through the dispatcher and ~{ts_cpu_vs_oxfmt} as the bare
				binary, where wall-clock swings from ~{npm_ts_vs_oxfmt} to ~{ts_wall_vs_oxfmt}.
			</li>
			<li>
				tsv's dispatcher adds a fixed ~{npm_overhead} over the bare binary, most of it Node's own
				startup (a bare <code>node -e ""</code> takes ~{format_ms(node_startup_ms)} on this
				machine), which every other npm-bin row pays too. That makes it ~{delivery_npm_wall} the
				binary's time on the delivery table's one file, but ~{npm_ts_cost} on the TypeScript repo.
				<a href="https://www.npmjs.com/package/@fuzdev/tsv-wasm"><code>@fuzdev/tsv-wasm</code></a>
				takes ~{wasm_wall} the binary's time and ~{wasm_memory} its memory on that one file: still
				well ahead of both Prettier rows on the large single file, behind Oxfmt and Biome.
			</li>
			<li>
				Through its dispatcher tsv uses {format_ratio_range(npm_memory)} less peak memory than every
				other tool in every scenario, and as the bare binary {format_ratio_range(memory)} less. Peak
				RSS comes from a separate pass without warmups, as many runs as the timed one, and counts
				the largest single process in each command's tree, not the sum, so a row that launches a
				native binary from Node — Biome's, rsvelte-fmt's, and tsv's dispatcher — is understated, and
				the dispatcher row reads Node's peak rather than the binary's.
			</li>
			<li>
				As in-process, every formatter is pinned to tsv's style in its own dialect — outputs still
				differ where the tools decide differently — so these rows don't compare with upstream's
				published numbers, which leave the tools nearer their defaults. Before timing, a preflight
				run of each tool's check mode asserts that every formatter parses every file, that those
				reporting a file count report the same one, and that each finds at least one file to change,
				so a mis-scoped tool formatting nothing can't post an unbeatable time. A scenario whose
				preflight fails, or whose timed run errors partway, is published as aborted rather than
				timed around or dropped.
			</li>
			<li>
				The tools, the single file (the TypeScript compiler's <code>parser.ts</code> at a pinned
				release), and the Svelte corpus (a pinned
				<a href="https://github.com/fuzdev/corpora">fuzdev/corpora</a> commit) are fixed, but the
				TypeScript repo is Outline's default branch as of its clone — the commit under its table —
				so its file set can change whenever it's re-cloned.
			</li>
			<li>
				hyperfine runs commands in the order given, with no interleaving or shuffling, so on a
				machine that throttles, the later commands run hotter{settle_note}. Every scenario puts the
				bare binary last, with its Node dispatcher row just before it (the tables sort by time, not
				run order), so that drift counts against tsv, not for it.
			</li>
		</ul>
	</aside>
	<p>
		This section ran on {cli_date}, from
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
		<a href={cli_commit_url}>its harness at {benchmarks_cli.git_commit}</a>{benchmarks_cli.git_dirty
			? ' with uncommitted changes'
			: ''}, on the same machine and Node as the in-process runs and with the same versions of the
		tools both time (listed under <a href="#{docs_slugify(details_title)}">{details_title}</a>),
		across {benchmarks_cli.machine.threads} threads, which its multi-file wall-clock scales with.
		{#if cli_tsv_binary.source === 'package'}
			Its native tsv rows run the <code>{cli_tsv_binary.package}</code> binary,
		{:else}
			Its native tsv rows run a local
			build{cli_tsv_binary.built ? ` from ${cli_tsv_binary.built}` : ''},
		{/if}
		and its WASM row runs <code>@fuzdev/tsv-wasm</code> {cli_tsv_wasm_version}.
	</p>
</TomeSection>

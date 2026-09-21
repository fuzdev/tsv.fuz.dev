<script lang="ts">
	import TomeSection from '@fuzdev/fuz_ui/TomeSection.svelte';
	import TomeSectionHeader from '@fuzdev/fuz_ui/TomeSectionHeader.svelte';

	import {
		benchmarks_cli,
		cli_memory_ratio_range,
		cli_speedup_vs_tsv,
		cli_speedup_vs_tsv_npm,
		cli_tsv_npm_memory_mb,
		cli_tsv_npm_overhead_ms_range,
		cli_tsv_npm_overhead_share,
		cli_node_startup_ms,
		cli_settle_seconds,
		CLI_TS_REPO_KEY,
		CLI_SINGLE_FILE_KEY,
		CLI_DELIVERY_KEY,
		CLI_TSV_NPM_LABEL,
		CLI_TSV_WASM_LABEL,
		type CliMetric
	} from './benchmarks_cli.ts';
	import {
		format_mib,
		format_ms,
		format_ms_range,
		format_ratio_approx,
		format_ratio_range,
		format_share_approx
	} from './benchmark_display.ts';
	import BenchmarksCli from './BenchmarksCli.svelte';

	const {
		title
	}: {
		/** The section's heading, which the page's in-page anchors slugify. */
		title: string;
	} = $props();

	// tsv through its npm dispatcher against the other tools' npm bins — the
	// like-for-like rows, which the claims lead with; the bare-binary ratios follow
	// as what the binary does without a Node launcher in front.
	const npm_ratio = (scenario: string, label: string, metric: CliMetric = 'wall_ms') =>
		format_ratio_approx(cli_speedup_vs_tsv_npm(scenario, label, metric));
	const bare_ratio = (scenario: string, label: string, metric: CliMetric) =>
		format_ratio_approx(cli_speedup_vs_tsv(scenario, label, metric));
	const npm_ts_vs_oxfmt = npm_ratio(CLI_TS_REPO_KEY, 'oxfmt');
	const npm_ts_vs_biome = npm_ratio(CLI_TS_REPO_KEY, 'biome');
	const npm_ts_cpu_vs_oxfmt = npm_ratio(CLI_TS_REPO_KEY, 'oxfmt', 'cpu_ms');
	const npm_ts_cpu_vs_biome = npm_ratio(CLI_TS_REPO_KEY, 'biome', 'cpu_ms');
	const ts_wall_vs_oxfmt = bare_ratio(CLI_TS_REPO_KEY, 'oxfmt', 'wall_ms');
	const ts_cpu_vs_oxfmt = bare_ratio(CLI_TS_REPO_KEY, 'oxfmt', 'cpu_ms');
	const ts_wall_vs_biome = bare_ratio(CLI_TS_REPO_KEY, 'biome', 'wall_ms');
	const ts_cpu_vs_biome = bare_ratio(CLI_TS_REPO_KEY, 'biome', 'cpu_ms');
	const npm_single_vs_oxfmt = npm_ratio(CLI_SINGLE_FILE_KEY, 'oxfmt');
	const npm_single_vs_biome = npm_ratio(CLI_SINGLE_FILE_KEY, 'biome');
	const memory = cli_memory_ratio_range();
	const npm_memory = cli_memory_ratio_range({ baseline_label: CLI_TSV_NPM_LABEL });
	const npm_memory_mb = cli_tsv_npm_memory_mb();
	// the dispatcher's own cost on the multi-file repo, beside the delivery table's one-file figure
	const npm_ts_cost = bare_ratio(CLI_TS_REPO_KEY, CLI_TSV_NPM_LABEL, 'wall_ms');
	// the same cost in absolute terms, which is what makes it "fixed": roughly the
	// same few tens of milliseconds whether the run is one file or a repo
	const npm_overhead = format_ms_range(cli_tsv_npm_overhead_ms_range());
	// and as a share of the dispatcher's parallel repo run, wall-clock against CPU work
	const npm_ts_share = cli_tsv_npm_overhead_share(CLI_TS_REPO_KEY);
	// the machine's bare Node launch, the floor under every npm-bin row
	const node_startup_ms = cli_node_startup_ms();
	// the idle before each formatter's warmups, which narrows the run-order drift —
	// quoted when every scenario records the same one (a plain string, so the leading
	// space survives Svelte's block-edge trimming)
	const settle_seconds = cli_settle_seconds();
	const settle_note =
		settle_seconds === undefined
			? ''
			: ` — the harness idles ${settle_seconds} s before each formatter's warmups, which narrows that drift without removing it`;
	// What each way of installing tsv costs, from the tsv-only delivery scenario.
	const delivery_npm_wall = bare_ratio(CLI_DELIVERY_KEY, CLI_TSV_NPM_LABEL, 'wall_ms');
	const wasm_wall = bare_ratio(CLI_DELIVERY_KEY, CLI_TSV_WASM_LABEL, 'wall_ms');
	const wasm_memory = bare_ratio(CLI_DELIVERY_KEY, CLI_TSV_WASM_LABEL, 'memory_mb');
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
		tsv appears only in the JSX-free scenarios (it has no JSX/TSX parser). Every formatter is
		installed from npm, pinned by the fork's lockfile, and the other tools are timed through their
		packages' bins as pnpm links them — a shell shim that starts Node first (Prettier runs in JS
		from there; Biome's and rsvelte-fmt's bins launch a native binary each ships, not timed on its
		own here; Oxfmt's loads its native engine into Node as an addon and has no standalone binary).
		Facing them, tsv gets two rows. <code>{CLI_TSV_NPM_LABEL}</code> is the launcher-matched,
		like-for-like one: the Node bin of
		<a href="https://www.npmjs.com/package/@fuzdev/tsv"><code>@fuzdev/tsv</code></a>, what
		<code>npx tsv</code> runs, launching the native binary as Biome's and rsvelte-fmt's bins do,
		behind the same kind of pnpm bin shim (a table says so when the harness couldn't set one up).
		<code>tsv</code> runs the binary directly from the platform package, skipping Node: what the
		binary costs on its own. Tables facing other tools start their ratios against the dispatcher
		row; the last table is tsv against itself, anchored on the bare binary — what the Node
		dispatcher and the WASM fallback each add.
	</p>
	<BenchmarksCli report={benchmarks_cli} />
	<aside>
		<p>Notes:</p>
		<ul>
			<li>
				This measures the whole command, not the engine in isolation. tsv, oxfmt, biome, and
				rsvelte-fmt parallelize across files; prettier's stable CLI formats them one at a time
				(Prettier 3.9's parallel CLI sits behind <code>--experimental-cli</code>, which the harness
				leaves off). No tool's thread count is pinned, so the wall-clock ratios bake in each tool's
				parallelism, scale with core count, and mean little apart from this machine. The CPU-work
				column — <a href="https://github.com/sharkdp/hyperfine">hyperfine</a>'s user plus system
				time, summed across threads — is the parallelism-neutral view. Like for like, against the
				dispatcher row, it widens tsv's lead on the TypeScript repo: ~{npm_ts_vs_oxfmt} faster than
				Oxfmt in wall-clock and ~{npm_ts_cpu_vs_oxfmt} in CPU work, ~{npm_ts_vs_biome} and
				~{npm_ts_cpu_vs_biome} against Biome. Against the bare binary it narrows instead — Oxfmt
				~{ts_wall_vs_oxfmt} to ~{ts_cpu_vs_oxfmt}, Biome ~{ts_wall_vs_biome} to ~{ts_cpu_vs_biome}.
				The gap between the two footings is launch cost, not the engines: for tsv's dispatcher a
				fixed ~{npm_overhead} — bin shim, Node startup, the dispatcher loading its own modules, and
				spawn — paid before the binary starts, which is ~{format_share_approx(npm_ts_share?.wall)}
				of its wall-clock on the repo but ~{format_share_approx(npm_ts_share?.cpu)} of its CPU
				total. Every other npm-bin row pays a Node start of its own: a bare <code>node -e ""</code>
				takes ~{format_ms(node_startup_ms)} on this machine, most of that fixed cost.
			</li>
			<li>
				CPU work is a clean engine proxy only while the threads do real work: a JS tool's figure
				also counts work off the main thread (most likely V8's GC and compilation threads), so even
				Prettier's CPU time runs above its wall-clock, and on the single file a tool that spins up a
				worker pool it can't use reads CPU above wall-clock too. Compare the two columns per row
				before reading either as engine speed.
			</li>
			<li>
				Peak memory is less tied to core count than wall-clock (though nothing here measures it
				against thread count), so it should travel better between machines: tsv uses
				{format_ratio_range(npm_memory)} less than every other tool in every scenario it faces them
				through its npm dispatcher, and {format_ratio_range(memory)} less as the bare binary. The
				figure is the largest single process in each command's tree, not the sum (the CPU-work
				column does sum the tree), so a row that launches a native binary from Node — Biome's,
				rsvelte-fmt's, and tsv's dispatcher — is understated: the smaller processes in its tree
				don't count. Prettier's, Oxfmt's, and the bare <code>tsv</code> rows each run as one process
				here and are measured whole. The dispatcher's peak, ~{format_mib(npm_memory_mb)}, is still
				below every other tool's — and, by the harness's own note, about the size of the launcher
				Biome's and rsvelte-fmt's rows leave out.
			</li>
			<li>
				On the large single file, where a Node bin's fixed launch cost weighs most against a short
				run, tsv through its dispatcher is ~{npm_single_vs_oxfmt} faster than Oxfmt and
				~{npm_single_vs_biome} faster than Biome. Hover the bare <code>tsv</code> row for what the
				binary does invoked directly, without a Node bin in front.
			</li>
			<li>
				The delivery table is tsv against tsv, on one file. Through <code>@fuzdev/tsv</code>'s Node
				dispatcher (npx's own resolution isn't counted) the same binary takes ~{delivery_npm_wall}
				as long — Node starting up, the dispatcher resolving and spawning the binary, and Node
				staying resident until it exits. That launch cost is fixed, so its share shrinks on a real
				repo, where the dispatcher takes ~{npm_ts_cost} as long.
				<a href="https://www.npmjs.com/package/@fuzdev/tsv-wasm"><code>@fuzdev/tsv-wasm</code></a> —
				the fallback for platforms without a prebuilt binary, not the default — runs the same CLI
				over a WASM engine inside Node at ~{wasm_wall} the time and ~{wasm_memory} the memory of the
				native binary: still well ahead of both Prettier rows on the same file above, behind Oxfmt
				and Biome.
			</li>
			<li>
				Formatting configuration is matched: tsv is non-configurable (width 100, tabs, single
				quotes, no trailing commas), so every formatter it faces is configured to that profile in
				its own dialect — outputs still differ where the tools decide differently. The preflight
				asserts that every formatter reporting a file count reports the same one (the two Prettier
				rows report none and sit that check out) and that every formatter finds at least one file to
				change, so a mis-scoped tool formatting nothing can't post an unbeatable time. The cost:
				these rows aren't comparable with upstream's published numbers, which leave the tools nearer
				their defaults.
			</li>
			<li>
				The tools are pinned but one corpus isn't: the TypeScript repo is Outline at its default
				branch's head, so its file set moves whenever it is re-cloned. Every formatter is scoped to
				the JSX-free <code>.ts</code>/<code>.js</code> family — the others by their config, tsv
				(which has none) by the extensions it walks — leaving out the <code>.tsx</code> and
				<code>.jsx</code> tsv can't parse, and the preflight file-count check holds the two scopes
				to the same set. The single file (the TypeScript compiler's <code>parser.ts</code> at a
				pinned release) and the Svelte corpus (a pinned
				<a href="https://github.com/fuzdev/corpora">fuzdev/corpora</a> commit) are fixed.
			</li>
			<li>
				Nothing is skipped and no failure is timed around: every scenario tsv runs in starts with a
				preflight parse check, and a run that errors partway fails the scenario instead of being
				timed (the scenarios tsv sits out keep hyperfine's <code>--ignore-failure</code>, so a
				formatter that errors partway is timed there rather than aborting the scenario). A scenario
				whose preflight fails is aborted before timing and shown as aborted rather than dropped — a
				crash in one formatter's check must not become a fast partial run. tsv sits out those
				scenarios because they contain JSX/TSX; two also measure work tsv doesn't do
				(embedded-language formatting in one; import, Tailwind-class, and <code>package.json</code>
				sorting in the other).
			</li>
			<li>
				hyperfine runs commands in the order given, with no interleaving or shuffling, so on a
				machine that throttles the later tools run warmer{settle_note}. Every scenario tsv runs in
				puts the bare binary last, with its npm dispatcher row just before it (the tables sort by
				time, not run order), so that drift counts against tsv, not for it. The last decimal of each
				ratio is that much noise.
			</li>
		</ul>
	</aside>
</TomeSection>

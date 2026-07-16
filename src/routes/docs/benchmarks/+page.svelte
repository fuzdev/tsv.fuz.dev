<script lang="ts">
	import TomeContent from '@fuzdev/fuz_ui/TomeContent.svelte';
	import TomeSection from '@fuzdev/fuz_ui/TomeSection.svelte';
	import TomeSectionHeader from '@fuzdev/fuz_ui/TomeSectionHeader.svelte';
	import {tome_get_by_slug} from '@fuzdev/fuz_ui/tome.ts';

	import {benchmarks_json} from './benchmarks.ts';
	import {benchmarks_conformance_json} from './benchmarks_conformance.ts';
	import {benchmarks_cross_runtime_json} from './benchmarks_cross_runtime.ts';
	import {benchmarks_cli} from './benchmarks_cli.ts';
	import {
		derive_benchmark_groups,
		derive_conformance_groups,
		derive_speedup_summary,
		format_corpus_source_files,
		corpus_source_url,
	} from './benchmark_data.ts';
	import BenchmarksSummary from './BenchmarksSummary.svelte';
	import BenchmarksGroup from './BenchmarksGroup.svelte';
	import BenchmarksConformance from './BenchmarksConformance.svelte';
	import BenchmarksSizes from './BenchmarksSizes.svelte';
	import BenchmarksMeta from './BenchmarksMeta.svelte';
	import BenchmarksCrossRuntime from './BenchmarksCrossRuntime.svelte';
	import BenchmarksCli from './BenchmarksCli.svelte';

	const LIBRARY_ITEM_NAME = 'benchmarks';

	const tome = tome_get_by_slug(LIBRARY_ITEM_NAME);

	const groups = derive_benchmark_groups(benchmarks_json);
	const speedup_rows = derive_speedup_summary(groups);
	const conformance_groups = derive_conformance_groups(benchmarks_conformance_json);

	const corpus = $derived(benchmarks_json.corpus);
	// Derived from the report so the "What's measured" figure can't drift from the
	// copied data (the report carries per-language file counts, not bytes).
	const corpus_file_count = $derived(Object.values(corpus).reduce((sum, n) => sum + n, 0));
	const format_groups = groups.filter((g) => g.operation === 'format');
	const parse_groups = groups.filter((g) => g.operation === 'parse');
</script>

<TomeContent {tome}>
	<section>
		<p>
			tsv is a toolchain for TypeScript/JS, CSS, and Svelte in Rust. This page shows how it measures
			up against Prettier, which tsv closely follows, and against Oxc and Biome, similar tools with
			wider language support (tsv doesn't support JSX/TSX, JSON, etc).
		</p>
	</section>

	<TomeSection>
		<TomeSectionHeader text="TLDR" />
		<p>
			After correctness, performance is tsv's next priority. The numbers on this page are
			single-threaded and in-process, where each tool parses or formats one file at a time
			(isolating engine speed from multi-core parallelism), measured over a large collection of
			real-world repos: {corpus_file_count.toLocaleString('en-US')} files including Svelte's
			official repos (svelte, kit, svelte.dev) and the <a href="https://github.com/fuzdev"
				>fuz.dev repos</a
			>. On that basis:
		</p>
		<ul>
			<li>
				Formatting TypeScript, tsv is ~1.66x faster than Oxfmt (native-vs-native), ~26x faster than
				Prettier (native Rust vs Prettier's JS), and ~6.5x faster than Biome (wasm-vs-wasm).
			</li>
			<li>
				Formatting CSS, it's ~2.6x faster than Oxfmt; Svelte is ~63x faster than Prettier (which
				Oxfmt's Svelte path delegates to internally).
			</li>
			<li>
				Parsing TypeScript, tsv is ~1.3x faster than Oxc (with the payload-matched span-only AST
				both emit). tsv's default AST adds a per-node line/column <code>loc</code> for drop-in
				Svelte compatibility that Oxc omits, with a fast path to reconstruct locs on the JS-side.
			</li>
			<li>
				<a href="https://github.com/ryanatkn/oxc-bench-formatter" rel="external"
					>A fork of Oxc's official <code>bench-formatter</code></a
				> is an end-to-end CLI benchmark that has its own corpus. On a real TypeScript repo, tsv
				formats ~3x faster than Oxfmt and ~6.5x faster than Biome using 3–10x less memory.
				Wall-clock ratios include each tool's multi-file parallelism, so they scale with core count
				and are machine-dependent, and are warped by .
			</li>
		</ul>
		<p>
			Each section below has notes that attempt to fairly contextualize its numbers. The charts show
			numbers using Node, and at the end of the page is a <a href="#Cross-runtime"
				>cross-runtime comparison</a
			>.
		</p>
	</TomeSection>

	<TomeSection>
		<TomeSectionHeader text="Like Prettier but speedier" />
		<BenchmarksSummary rows={speedup_rows} />
	</TomeSection>

	<TomeSection>
		<TomeSectionHeader text="Format speed" />
		<p class="mb_xl5">
			tsv's formatter is similar to <a href="https://oxc.rs/docs/guide/usage/formatter.html"
				>Oxfmt</a
			>
			and <a href="https://biomejs.dev/formatter/">Biome</a>. It formats Svelte, TypeScript, and
			CSS, plus JS (as strict-mode TypeScript):
		</p>
		{#each format_groups as group (group.language)}
			<BenchmarksGroup {group} {corpus} />
		{/each}
		<aside class="mt_xl5">
			<p>How to read these numbers:</p>
			<ul>
				<li>
					Oxfmt formats TypeScript, JS, and CSS with its own native engine, and for Svelte it
					delegates to Prettier internally (via prettier-plugin-svelte).
				</li>
				<li>
					Speed is shown relative to <code>prettier</code> (the 1.0x anchor), the canonical format
					reference — the same convention as the parse groups, which anchor on their canonical
					parser, so every section reads consistently. Prettier runs in JS while the headline tsv
					entry is native, so that ratio is cross-tier; for an engine-vs-engine read, compare within
					a tier: wasm vs wasm, or native vs native.
				</li>
				<li>
					There's no native Biome entry: its native engine ships only as the <code>biome</code> CLI
					binary, a separate process rather than an embeddable library, so it can't be timed
					in-process the way tsv, oxc-parser, and oxfmt are. Biome's wasm build is the only one
					measured.
				</li>
			</ul>
		</aside>
	</TomeSection>

	<TomeSection>
		<TomeSectionHeader text="Parse speed" />
		<p class="mb_xl5">
			The parse entries that build a full JS AST are comparable in mechanism: tsv and oxc-parser
			both serialize the AST to JSON in Rust and deserialize it in JS, native and wasm alike. But
			the deliverables differ — tsv's default wire (<code>tsv-json</code> / <code
				>tsv_wasm-json</code
			>) carries a per-node <code>loc</code> (line/column) object that oxc-parser's default
			span-only AST omits, and that <code>loc</code> is roughly half the wire bytes and most of its
			JSON.parse cost. The <code>tsv-json-no-locations</code> / <code
				>tsv_wasm-json-no-locations</code
			> entries drop it, emitting the same span-only shape oxc does, so <strong
				>those are the payload-matched, apples-to-apples comparison with oxc-parser</strong
			> (line/column stays derivable from the offsets plus source, so nothing is lost). The
			tsv-internal and tsv_wasm-internal entries build the native AST but skip JS-side
			materialization, so they show raw in-engine speed rather than a cross-tool comparison.
		</p>
		{#each parse_groups as group (group.language)}
			<BenchmarksGroup {group} {corpus} />
		{/each}
		<aside class="mt_xl5">
			<p>Some notes:</p>
			<ul>
				<li>
					JS parsers skip the Rust-to-JS serialization step that tsv and oxc pay for, which keeps
					them competitive.
				</li>
				<li>
					Biome is shown grayed-out across all three parse groups because its <code
						>@biomejs/js-api</code
					> package doesn't expose a parser to JS (only formatting and linting). Biome parses
					internally but never surfaces the AST across the JS boundary, so it can't be measured.
				</li>
				<li>
					oxc-parser only parses TypeScript and JS (and JSX, not measured here). oxc-parser doesn't
					expose a CSS parser, and it doesn't parse Svelte.
				</li>
				<li>
					<code>tsv-json-no-locations</code> / <code>tsv_wasm-json-no-locations</code> are the fair,
					payload-matched comparison with oxc-parser: they emit tsv's span-only wire (offsets, no
					per-node <code>loc</code>), matching oxc's default AST shape. The plain
					<code>tsv-json</code> entries carry the richer <code>loc</code>-bearing drop-in AST that
					Svelte's compiler consumes for sourcemaps — a strictly larger deliverable, so a slower
					number that isn't an engine-speed difference.
				</li>
				<li>
					<code>tsv internal (node napi)</code> and <code>tsv_wasm internal</code> aren't a fair
					comparison to the other entries — they skip JS-side AST materialization entirely, so
					they're included only to show tsv's own JSON-serialization overhead against its
					non-internal entry.
				</li>
			</ul>
		</aside>
	</TomeSection>

	<TomeSection>
		<TomeSectionHeader text="Parse conformance" />
		<p class="mb_xl5">
			Separate from the speed numbers above, this measures parse <em>coverage</em>: how much of a
			much larger, deliberately hard corpus each parser accepts — Prettier's format-test suites,
			Svelte's compiler test suite, CSS extracted from
			<a href="https://github.com/web-platform-tests/wpt">web-platform-tests</a>, and <a
				href="https://github.com/tc39/test262">test262</a
			>'s expected-valid strict-mode tests. The corpus used for performance above has real-world
			code, parse conformance is the edge cases.
		</p>
		<BenchmarksConformance groups={conformance_groups} />
		<aside class="mt_xl5">
			<p>Reading these numbers:</p>
			<ul>
				<li>
					Coverage is per engine, not per binding — a parser accepts the same files whether it runs
					native or wasm, so each tool appears once.
				</li>
				<li>
					For Svelte, the corpus excludes the files svelte/compiler itself rejects, so its number is
					100% by construction and the rest read as drop-in fidelity against it — higher is strictly
					better. For TypeScript and CSS the canonical parser isn't a clean validity oracle
					(acorn-typescript trails modern syntax, Svelte's CSS parser is lenient), so those suites
					keep intentionally-invalid and out-of-scope inputs — read them relative to each other, not
					as an absolute target.
				</li>
				<li>
					Accepting a file says nothing about producing the <em>right</em> AST — tsv's output is
					separately verified against the canonical parsers (svelte/compiler, acorn-typescript) at
					corpus scale in its repo's conformance gates.
				</li>
			</ul>
			{#if benchmarks_conformance_json.corpus_sources?.length}
				<p>Corpus sources ({benchmarks_conformance_json.corpus_sources.length}):</p>
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
			Rather than supporting many languages, tsv focuses on Svelte/HTML, TypeScript/JS, and CSS.
			This lets it be smaller when it's all you need, a quality that's more relevant when used in
			the browser via wasm.
		</p>
		<BenchmarksSizes sizes={benchmarks_json.binary_sizes} />
		<aside class="mt_xl5">
			<p>Important notes:</p>
			<ul>
				<li>apples-to-apples comparisons are difficult here because of differing scope</li>
				<li>oxc-parser only parses TypeScript and JS/JSX; oxfmt is its separate formatter</li>
				<li>tsv and tsv_wasm include a parser and formatter for Svelte, TypeScript/JS, and CSS</li>
				<li>
					Biome bundles a parser, formatter, and linter for many languages, but its native engine
					ships only as the CLI binary, not an embeddable library, and
					<code>@biomejs/js-api</code> exposes only formatting and linting. Every native entry here
					is an in-process library call, so a subprocess CLI isn't a comparable artifact — only
					Biome's wasm build is included
				</li>
				<li>
					the <code>oxc-parser + oxfmt</code> entry under Full toolchain sums oxc's separate parser
					and formatter packages, since together they're the closest equivalent to tsv's single
					parse+format build
				</li>
				<li>
					that combined figure is a little unfair to oxc: oxfmt statically links its own copy of the
					same oxc parser (it has to parse to format) but doesn't depend on the
					<code>oxc-parser</code> package or expose parsing through its API. The two are
					independently compiled, so the sum counts the parser's compiled code twice — more than a
					single build exposing both operations (like tsv's) would need
				</li>
				<li>
					oxfmt has no wasm build as of July 2026, so it's shown grayed-out under Formatter, holding
					its slot beside <code>oxfmt (napi)</code>
				</li>
				<li>
					tsv doesn't publish native artifacts yet, but it builds them for benchmarking — an N-API
					addon for Node and Bun, and a C-FFI library for Deno
				</li>
			</ul>
		</aside>
	</TomeSection>

	<TomeSection>
		<TomeSectionHeader text="End-to-end CLI benchmark" />
		<p class="mb_xl5">
			The numbers above measure tsv's engine in-process, one file at a time. This is a separate,
			independent benchmark: a fork of Oxc's official
			<a href="https://github.com/oxc-project/bench-formatter" rel="external"
				><code>bench-formatter</code></a
			>
			that
			<a href="https://github.com/ryanatkn/oxc-bench-formatter" rel="external">adds tsv</a>, timing
			the <strong>whole CLI</strong> end-to-end — process spawn, file discovery, I/O, and each
			tool's default multi-file parallelism — plus peak memory. It's the "what you experience typing
			the command" measure, run on real repositories. tsv appears in the two JSX-free scenarios (it
			has no JSX/TSX parser).
		</p>
		<BenchmarksCli report={benchmarks_cli} />
		<aside class="mt_xl5">
			<p>How to read these numbers:</p>
			<ul>
				<li>
					This measures the whole command, not the engine in isolation. tsv, oxfmt, and biome
					parallelize across files while prettier is effectively serial, so the wall-clock ratios
					bake in each tool's parallelism and <strong>scale with core count</strong> — they're only
					meaningful alongside the machine they ran on. The <code>vs tsv (CPU work)</code> column is
					the parallelism-neutral view (total CPU time across threads): on the TypeScript repo tsv
					is ~3x Oxfmt in wall-clock but ~2x in CPU work, the rest being cores Oxfmt uses and
					Prettier can't.
				</li>
				<li>
					Peak memory doesn't depend on thread count, so it's the most directly comparable figure —
					tsv uses 3–13x less than every other tool across both scenarios.
				</li>
				<li>
					Formatting width isn't identical: prettier, biome, and oxfmt format at width 80 (oxfmt
					explicitly, the others by default), while tsv is non-configurable at width 100. Different
					widths mean different line-break work — a real if small asymmetry with no fix on tsv's
					side.
				</li>
				<li>
					Errors aren't penalized by the harness, but both tsv scenarios run a preflight parse check
					first and every formatter accepts the whole corpus, so nothing is skipped. tsv is left out
					of the fork's other three scenarios because they contain JSX/TSX or measure work tsv
					doesn't do (embedded-language formatting, import and Tailwind-class sorting).
				</li>
			</ul>
		</aside>
	</TomeSection>

	<TomeSection>
		<TomeSectionHeader text="Benchmarking details" />
		<p>
			All numbers are single-threaded: every library formats or parses one file at a time, measured
			sequentially with no cross-file parallelism. Each row is the total time to process the whole
			corpus once on a single core — not the multi-core batch throughput a CLI gets when it formats
			many files at once, which most of these tools (tsv included) can do.
		</p>
		<p class="mb_xl3">
			What's measured: {corpus_file_count.toLocaleString('en-US')} files of <code>.svelte</code>,
			<code>.ts</code>/<code>.js</code>, and <code>.css</code> — real-world code only, from two
			sources: the author's libraries, apps, and sites (the fuz.dev ecosystem plus personal
			SvelteKit sites), and upstream framework source (Svelte, SvelteKit, and the svelte.dev site).
			The CSS set also includes real-authored CSS extracted from those components'
			<code>&lt;style&gt;</code> blocks, concatenated per repo — standalone CSS files are rare in
			this ecosystem, and the same bytes appear in the Svelte rows (rows are never summed). Test
			files count as real code and stay in; fixture files (the formatter test suites that used to be
			part of this corpus, and fixture subtrees inside the measured repos) are excluded —
			deliberately tricky edge cases measure conformance, not typical throughput, and are covered by
			the parse-conformance section above.
		</p>
		<BenchmarksMeta baseline={benchmarks_json} />
	</TomeSection>

	<TomeSection>
		<TomeSectionHeader text="Cross-runtime" />
		<p>
			The same benchmark harness runs under three JS runtimes — Node, Deno, and Bun. The headline
			numbers above are the Node run. The native entry differs by runtime: Node and Bun load tsv's
			N-API addon, while Deno loads its C-FFI library. They share code but cross a different binding
			boundary, so a per-runtime delta on the same row is a runtime effect — the JS engine or the
			binding boundary — not a difference in tsv's own engine, which is identical across all three.
		</p>
		<aside class="mt_xl5 mb_xl5">
			<p>Reading the tables:</p>
			<ul>
				<li>
					tsv's native binding boundaries are at parity across runtimes — the
					<code>tsv-internal</code> rows, which cross the boundary but hand nothing back to
					materialize, sit within a few percent Node vs Deno. The visible spread is largely confined
					to the JSON-materializing parse rows, where it reflects each JS engine's
					<code>JSON.parse</code> cost rather than the N-API-vs-FFI boundary: Deno and Bun edge out
					Node there. Node is the headline as the default N-API path, not because it's the fastest
					native number.
				</li>
				<li>
					tsv's own paths — native (N-API/FFI) and wasm — run on all three runtimes. Bun currently
					fails to load two third-party wasm implementations (biome's wasm-bundler and oxc-parser's
					wasm32-wasi binding), so they show <code>fail</code> in the Bun column.
				</li>
			</ul>
		</aside>
		<BenchmarksCrossRuntime report={benchmarks_cross_runtime_json} />
	</TomeSection>
</TomeContent>

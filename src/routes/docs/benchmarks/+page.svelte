<script lang="ts">
	import TomeContent from '@fuzdev/fuz_ui/TomeContent.svelte';
	import TomeSection from '@fuzdev/fuz_ui/TomeSection.svelte';
	import TomeSectionHeader from '@fuzdev/fuz_ui/TomeSectionHeader.svelte';
	import {tome_get_by_slug} from '@fuzdev/fuz_ui/tome.ts';

	import {benchmarks_json} from './benchmarks.ts';
	import {benchmarks_conformance_json} from './benchmarks_conformance.ts';
	import {benchmarks_cross_runtime_json} from './benchmarks_cross_runtime.ts';
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
			up compared to Oxc and Biome, which are similar tools with wider language support (tsv doesn't
			support JSX/SCSS/etc).
		</p>
		<p>
			After correctness, performance is tsv's priority. For TypeScript its parser is 1.3x Oxc's
			speed and formatting is 1.7x. Each section has notes that attempt to fairly contextualize the
			numbers.
		</p>
	</section>

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
			and <a href="https://biomejs.dev/formatter/">Biome</a>. Today it can format Svelte,
			TypeScript, and CSS, plus JS (as strict-mode TypeScript) and soon JSON and HTML (without the
			Svelte differences):
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
					Speed is shown relative to <code>prettier</code> (the 1.0x anchor) — the canonical
					reference every format entry is measured against, the same baseline the parse groups and
					the summary above anchor on, so every section reads consistently. Prettier runs in JS
					while the headline tsv entry is native, so the headline ratio is a cross-tier comparison;
					for an engine-vs-engine read, compare within a runtime tier: wasm vs wasm, or native vs
					native.
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
					comparison to the other entries - they skip JS-side AST materialization entirely, so
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
			much larger, deliberately hard corpus each parser accepts - Prettier's format-test suites,
			Svelte's compiler test suite, CSS extracted from
			<a href="https://github.com/web-platform-tests/wpt">web-platform-tests</a>, and <a
				href="https://github.com/tc39/test262">test262</a
			>'s expected-valid strict-mode tests. It's a separate corpus from the real-world code timed
			above, which is held to a stricter bar - every tool must fully process every file it supports,
			or the benchmark fails - so coverage there is 100% by construction and the discriminating
			signal is here, on the hard cases.
		</p>
		<BenchmarksConformance groups={conformance_groups} />
		<aside class="mt_xl5">
			<p>Reading these numbers:</p>
			<ul>
				<li>
					Coverage is per engine, not per binding - a parser accepts the same files whether it runs
					native or wasm, so each tool appears once.
				</li>
				<li>
					For Svelte, the corpus excludes the files svelte/compiler itself rejects, so its number is
					100% by construction and the rest read as drop-in fidelity against it - higher is strictly
					better. For TypeScript and CSS the canonical parser isn't a clean validity oracle
					(acorn-typescript trails modern syntax, Svelte's CSS parser is lenient), so those suites
					keep intentionally-invalid and out-of-scope inputs - read them relative to each other, not
					as an absolute target.
				</li>
				<li>
					Accepting a file says nothing about producing the <em>right</em> AST - tsv's output is
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
								<a href={url} rel="external"><code>{source.path}</code></a>
							{:else}
								<code>{source.path}</code>
							{/if}
							- {format_corpus_source_files(source)}
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
				<li>
					Biome includes a parser, formatter, and linter supporting many languages, but doesn't
					expose its parser to JS - <code>@biomejs/js-api</code> offers only formatting and linting
				</li>
				<li>tsv and tsv_wasm include a parser and formatter for Svelte, TypeScript/JS, and CSS</li>
				<li>
					Biome ships a native CLI but not an embeddable library -
					<code>@biomejs/js-api</code> is embeddable wasm, but doesn't expose its parser. Every
					other native entry here (tsv, oxc-parser, oxfmt) is measured as an in-process library
					call, so a CLI binary invoked as a subprocess isn't a comparable artifact and is excluded,
					so only Biome's wasm build is included
				</li>
				<li>
					the <code>oxc-parser + oxfmt</code> entry under Full toolchain sums oxc's separate parser
					and formatter packages, since together they're the closest equivalent to tsv's single
					parse+format build
				</li>
				<li>
					that combined figure is a little unfair to oxc: oxfmt has to parse in order to format, so
					it statically links its own copy of the same oxc parser - but it doesn't depend on the
					<code>oxc-parser</code> package or expose parsing through its own API (only
					<code>format</code>). The two are independently compiled, so summing them double-counts
					the parser's compiled code once per binary, inflating the total past what a single build
					exposing both operations (like tsv's) would actually need
				</li>
				<li>
					oxfmt has no wasm build as of June 2026, so it's shown grayed-out under Formatter, holding
					its slot beside <code>oxfmt (napi)</code>
				</li>
				<li>
					tsv doesn't publish native artifacts yet, but it builds them for benchmarking - an N-API
					addon for Node and Bun, and a C-FFI library for Deno
				</li>
			</ul>
		</aside>
	</TomeSection>

	<TomeSection>
		<TomeSectionHeader text="Benchmarking details" />
		<p>
			All numbers are single-threaded: every library formats or parses one file at a time, measured
			sequentially with no cross-file parallelism. Each row is the total time to process the whole
			corpus once on a single core - not the multi-core batch throughput a CLI gets when it formats
			many files at once, which most of these tools (tsv included) can do.
		</p>
		<p class="mb_xl3">
			What's measured: {corpus_file_count.toLocaleString('en-US')} files of <code>.svelte</code>,
			<code>.ts</code>/<code>.js</code>, and <code>.css</code> - real-world code only, from two
			sources: the author's libraries, apps, and sites (the fuz.dev ecosystem plus personal
			SvelteKit sites), and upstream framework source (Svelte, SvelteKit, and the svelte.dev site).
			The CSS set also includes real-authored CSS extracted from those components'
			<code>&lt;style&gt;</code> blocks, concatenated per repo - standalone CSS files are rare in
			this ecosystem, and the same bytes appear in the Svelte rows (rows are never summed). Test
			files count as real code and stay in; fixture files (the formatter test suites that used to be
			part of this corpus, and fixture subtrees inside the measured repos) are excluded -
			deliberately tricky edge cases measure conformance, not typical throughput, and are covered by
			the parse-conformance section above.
		</p>
		<BenchmarksMeta baseline={benchmarks_json} />
	</TomeSection>

	<TomeSection>
		<TomeSectionHeader text="Cross-runtime" />
		<p>
			The same benchmark harness runs under three JS runtimes - Node, Deno, and Bun. The headline
			numbers above are the Node run. The native entry differs by runtime: Node and Bun load tsv's
			N-API addon, while Deno loads its C-FFI library. They share code but cross a different binding
			boundary, so a per-runtime delta on the same row is a runtime effect - the JS engine or the
			binding boundary - not a difference in tsv's own engine, which is identical across all three.
		</p>
		<aside class="mt_xl5 mb_xl5">
			<p>Reading the tables:</p>
			<ul>
				<li>
					tsv's native binding boundaries are at parity across runtimes - the
					<code>tsv-internal</code> rows, which cross the boundary but hand nothing back to
					materialize, sit within a few percent Node vs Deno. The visible spread is largely confined
					to the JSON-materializing parse rows, where it reflects each JS engine's
					<code>JSON.parse</code> cost rather than the N-API-vs-FFI boundary: Deno and Bun edge out
					Node there. Node is the headline as the default N-API path, not because it's the fastest
					native number.
				</li>
				<li>
					tsv's own paths - native (N-API/FFI) and wasm - run on all three runtimes. Bun currently
					fails to load two third-party wasm implementations (biome's wasm-bundler and oxc-parser's
					wasm32-wasi binding), so they show <code>fail</code> in the Bun column.
				</li>
			</ul>
		</aside>
		<BenchmarksCrossRuntime report={benchmarks_cross_runtime_json} />
	</TomeSection>
</TomeContent>

<script lang="ts">
	import TomeContent from '@fuzdev/fuz_ui/TomeContent.svelte';
	import TomeSection from '@fuzdev/fuz_ui/TomeSection.svelte';
	import TomeSectionHeader from '@fuzdev/fuz_ui/TomeSectionHeader.svelte';
	import {tome_get_by_slug} from '@fuzdev/fuz_ui/tome.ts';

	import {benchmarks_json} from './benchmarks.ts';
	import {benchmarks_cross_runtime_json} from './benchmarks_cross_runtime.ts';
	import {
		category_color,
		derive_benchmark_groups,
		derive_speedup_summary,
	} from './benchmark_data.ts';
	import BenchmarksSummary from './BenchmarksSummary.svelte';
	import BenchmarksGroup from './BenchmarksGroup.svelte';
	import BenchmarksSizes from './BenchmarksSizes.svelte';
	import BenchmarksMeta from './BenchmarksMeta.svelte';
	import BenchmarksCrossRuntime from './BenchmarksCrossRuntime.svelte';

	const LIBRARY_ITEM_NAME = 'benchmarks';

	const tome = tome_get_by_slug(LIBRARY_ITEM_NAME);

	const groups = derive_benchmark_groups(benchmarks_json);
	const speedup_rows = derive_speedup_summary(groups);

	const corpus = $derived(benchmarks_json.corpus);
	const format_groups = groups.filter((g) => g.operation === 'format');
	const parse_groups = groups.filter((g) => g.operation === 'parse');
</script>

<TomeContent {tome}>
	<section>
		<p>tsv is a formatter, parser, and future linter + more for Svelte, TypeScript, and CSS.</p>
		<p>
			Please note, this is an early-stage project and these numbers will change, both upwards and
			downwards.
		</p>
	</section>

	<section>
		<div class="legend">
			<span><i class="swatch" style:background={category_color('tsv_native')}></i> tsv native</span>
			<span
				><i class="swatch" style:background={category_color('tsv_native_json')}></i> tsv native
				json</span
			>
			<span><i class="swatch" style:background={category_color('tsv_wasm')}></i> tsv wasm</span>
			<span
				><i class="swatch" style:background={category_color('tsv_wasm_json')}></i> tsv wasm
				json</span
			>
			<span><i class="swatch" style:background={category_color('biome')}></i> biome</span>
			<span><i class="swatch" style:background={category_color('oxc')}></i> oxc</span>
			<span><i class="swatch" style:background={category_color('canonical')}></i> canonical</span>
		</div>
	</section>

	<TomeSection>
		<TomeSectionHeader text="Speedier than Prettier" />
		<BenchmarksSummary rows={speedup_rows} />
	</TomeSection>

	<TomeSection>
		<TomeSectionHeader text="Format" />
		<p class="mb_xl5">
			tsv's formatter is similar to <a href="https://oxc.rs/docs/guide/usage/formatter.html"
				>Oxfmt</a
			>
			and <a href="https://biomejs.dev/">Biome</a>. Today it can format Svelte, TypeScript, and CSS,
			plus JS (as strict-mode TypeScript) and soon HTML (not Svelte-flavored):
		</p>
		{#each format_groups as group (group.language)}
			<BenchmarksGroup {group} {corpus} />
		{/each}
		<aside class="mt_xl5">
			<p>How to read these numbers:</p>
			<ul>
				<li>
					Each tool is timed producing its own formatting, so outputs may differ. Prettier is the
					reference, and Oxfmt also targets Prettier conformance. tsv tracks Prettier closely but
					intentionally diverges in some documented cases, and Biome formats to its own style.
				</li>
				<li>
					Oxfmt only formats TypeScript and JS with its own native engine. For CSS and Svelte it
					bundles and runs Prettier internally (plus prettier-plugin-svelte for Svelte), so its CSS
					and Svelte entries essentially re-measure Prettier minus a little wrapper overhead.
				</li>
				<li>
					Speed is shown relative to <code>biome (wasm)</code> (the 1.0x anchor) — a fast
					native-engine formatter compiled to wasm, a tougher and fairer yardstick than the slow JS
					Prettier baseline. That anchor is a wasm build while the headline tsv entry is native, so
					the headline ratio is a cross-tier comparison. For an engine-vs-engine read, compare
					within a runtime tier: wasm vs wasm, or native vs native.
				</li>
				<li>
					There's no native Biome entry: its native engine ships only as the <code>biome</code> CLI
					binary, a separate process rather than an embeddable library, so it can't be timed
					in-process the way tsv, oxc-parser, and oxfmt are. Biome's wasm build is the only one
					measured.
				</li>
				<li>
					Entries slower than the anchor read as a negative multiple — <code>-6.67x</code> means
					6.67x slower, not a negative speed — so the factor is directly legible rather than a
					fraction to invert.
				</li>
				<li>
					tsv's CSS coverage is intentionally lower than Prettier's and Biome's - it rejects
					non-standard non-Svelte CSS (SCSS, LESS, CSS Modules, IE hacks) to stay slim and focused.
					Full CSS-spec compliance is on the roadmap, including error recovery.
				</li>
			</ul>
		</aside>
	</TomeSection>

	<TomeSection>
		<TomeSectionHeader text="Parse" />
		<p class="mb_xl5">
			The parse entries that build a full JS AST are directly comparable: tsv and oxc-parser both
			serialize the AST to JSON in Rust and deserialize it in JS, native and wasm alike. The
			tsv-internal and tsv_wasm-internal entries are tsv's parse-only numbers - they build the
			native AST but skip JS-side materialization, so they show raw in-engine speed rather than a
			cross-tool comparison.
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
					Biome is shown grayed-out across all three parse groups, holding its slot rather than
					being omitted: its <code>@biomejs/js-api</code> package doesn't expose a parser to JS
					(only formatting and linting) — Biome parses internally but never surfaces the AST across
					the JS boundary, so there's nothing to time.
				</li>
				<li>
					oxc-parser only parses TypeScript and JS, so it's shown grayed-out under Svelte and CSS —
					holding its slot so the three parse groups line up entry-for-entry.
				</li>
				<li>
					<code>tsv internal (napi)</code> and <code>tsv_wasm internal</code> aren't a fair
					comparison to the other entries - they skip JS-side AST materialization entirely, so
					they're included only to show tsv's own JSON-serialization overhead against its
					non-internal entry.
				</li>
			</ul>
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
				<li>
					Biome includes a parser, formatter, and linter supporting many languages, but doesn't
					expose its parser to JS - <code>@biomejs/js-api</code> offers only formatting and linting
				</li>
				<li>
					Biome's native engine only ships as the <code>biome</code> CLI binary, not an embeddable
					library - <code>@biomejs/js-api</code> wires up wasm builds only. Every other native entry
					here (tsv, oxc-parser, oxfmt) is measured as an in-process library call, so a CLI binary
					invoked as a subprocess isn't a comparable artifact and is excluded; only Biome's wasm
					build is shown
				</li>
				<li>
					tsv and tsv_wasm include a parser and formatter for Svelte/HTML, TypeScript/JS, and CSS
				</li>
				<li>
					oxc-parser only parses TypeScript and JS, not CSS or HTML; oxfmt is its separate formatter
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
			sequentially with no cross-file parallelism. These are per-file, single-core latency and
			throughput numbers - not the multi-core batch throughput a CLI gets when it formats many files
			at once, which most of these tools (tsv included) can do.
		</p>
		<p class="mb_xl3">
			What's measured: around 5,500 files (~15 MB) of
			<code>.svelte</code>/<code>.html</code>, <code>.ts</code>/<code>.js</code>, and
			<code>.css</code>, from three sources: the fuz.dev libraries and apps, upstream framework
			source (Svelte, SvelteKit, and the svelte.dev site), and formatter conformance fixtures
			(Prettier's and prettier-plugin-svelte's own test suites - deliberately tricky edge cases, not
			typical code, so they skew the corpus toward hard cases).
		</p>
		<BenchmarksMeta baseline={benchmarks_json} />
	</TomeSection>

	<TomeSection>
		<TomeSectionHeader text="Cross-runtime" />
		<p>
			The same benchmark harness runs under three JS runtimes - Node, Deno, and Bun. The headline
			numbers above are the Node run. The native entry differs by runtime: Node and Bun load tsv's
			N-API addon, while Deno loads its C-FFI library. They share code but have a different binding
			boundary. A per-runtime delta on the same implementation is a runtime or binding-boundary
			effect, not an engine difference.
		</p>
		<aside class="mt_xl5 mb_xl5">
			<p>Reading the tables:</p>
			<ul>
				<li>
					tsv's native entries are faster under Node/Bun (N-API) than Deno (FFI), which pays a
					per-call marshalling cost - so the Node headline reflects tsv's real native speed better
					than the Deno-FFI numbers do.
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

<style>
	.legend {
		display: flex;
		gap: var(--space_xl);
		flex-wrap: wrap;
		font-size: var(--font_size_sm);
		margin-bottom: var(--space_xl);
	}
	.legend span {
		display: flex;
		align-items: center;
		gap: var(--space_xs);
	}
	.swatch {
		display: inline-block;
		width: 1.6rem;
		height: 1.6rem;
		border-radius: var(--border_radius_xs);
	}
</style>

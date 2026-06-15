<script lang="ts">
	import TomeContent from '@fuzdev/fuz_ui/TomeContent.svelte';
	import TomeSection from '@fuzdev/fuz_ui/TomeSection.svelte';
	import TomeSectionHeader from '@fuzdev/fuz_ui/TomeSectionHeader.svelte';
	import {tome_get_by_slug} from '@fuzdev/fuz_ui/tome.js';

	import {benchmarks_json} from './benchmarks.js';
	import {
		category_color,
		derive_benchmark_groups,
		derive_speedup_summary,
	} from './benchmark_data.js';
	import BenchmarksSummary from './BenchmarksSummary.svelte';
	import BenchmarksGroup from './BenchmarksGroup.svelte';
	import BenchmarksSizes from './BenchmarksSizes.svelte';
	import BenchmarksMeta from './BenchmarksMeta.svelte';

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
				><i class="swatch" style:background={category_color('tsv_native_json')}></i> tsv native json</span
			>
			<span><i class="swatch" style:background={category_color('tsv_wasm')}></i> tsv wasm</span>
			<span
				><i class="swatch" style:background={category_color('tsv_wasm_json')}></i> tsv wasm json</span
			>
			<span><i class="swatch" style:background={category_color('biome')}></i> biome</span>
			<span><i class="swatch" style:background={category_color('oxc')}></i> oxc</span>
			<span><i class="swatch" style:background={category_color('canonical')}></i> canonical</span>
		</div>
	</section>

	<TomeSection>
		<TomeSectionHeader text="Binary size" />
		<p>
			Rather than supporting many languages, tsv focuses on Svelte, TypeScript, and CSS. This lets
			it be smaller when it's all you need, a quality that's more relevant when used in the browser
			via wasm:
		</p>
		<BenchmarksSizes sizes={benchmarks_json.binary_sizes} />
		<aside class="mt_xl5">
			<p>Important notes:</p>
			<ul>
				<li>apples-to-apples comparisons are difficult here because of differing scope</li>
				<li>Biome includes a parser, formatter, and linter supporting many languages</li>
				<li>tsv and tsv_wasm include a parser and formatter for Svelte, TypeScript/JS, and CSS</li>
				<li>oxfmt has no wasm build as of June 2026</li>
				<li>
					tsv doesn't publish native artifacts yet, but it builds them for benchmarking over FFI
					with Deno
				</li>
			</ul>
		</aside>
	</TomeSection>

	<TomeSection>
		<TomeSectionHeader text="Speedier than Prettier" />
		<BenchmarksSummary rows={speedup_rows} {groups} {corpus} />
	</TomeSection>

	<TomeSection>
		<TomeSectionHeader text="Format" />
		<p class="mb_xl5">
			tsv's formatter is similar to <a href="https://oxc.rs/docs/guide/usage/formatter.html"
				>Oxfmt</a
			>
			and <a href="https://biomejs.dev/">Biome</a>. Today it can format Svelte, TypeScript, and CSS,
			plus JS as strict-mode TypeScript:
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
					and Svelte rows essentially re-measure Prettier minus a little wrapper overhead.
				</li>
				<li>
					The Prettier baseline runs in JS while the headline tsv row is the native build, so it's a
					cross-tier comparison. For an engine-vs-engine read, compare within a runtime tier: wasm
					vs wasm, or native vs native.
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
			The parse rows that build a full JS AST are directly comparable: tsv and oxc-parser both
			serialize the AST to JSON in Rust and deserialize it in JS, native and wasm alike. The
			tsv-internal and tsv_wasm-internal rows are tsv's parse-only numbers - they build the native
			AST but skip JS-side materialization, so they show raw in-engine speed rather than a
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
				<li>Some parts of tsv are not well-optimized yet, particularly parsing CSS.</li>
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

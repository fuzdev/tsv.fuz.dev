<script lang="ts">
	import TomeContent from '@fuzdev/fuz_ui/TomeContent.svelte';
	import Code from '@fuzdev/fuz_code/Code.svelte';
	import TomeLink from '@fuzdev/fuz_ui/TomeLink.svelte';
	import TomeSection from '@fuzdev/fuz_ui/TomeSection.svelte';
	import TomeSectionHeader from '@fuzdev/fuz_ui/TomeSectionHeader.svelte';
	import {tome_get_by_slug} from '@fuzdev/fuz_ui/tome.ts';
	import Svg from '@fuzdev/fuz_ui/Svg.svelte';
	import {logo_tsv} from '@fuzdev/fuz_ui/logos.ts';

	const LIBRARY_ITEM_NAME = 'introduction';

	const tome = tome_get_by_slug(LIBRARY_ITEM_NAME);

	const usage_example = `import {format_svelte, parse_svelte, type Root} from '@fuzdev/tsv_wasm';

const formatted = format_svelte('<script>\\nconst   x=1\\n<\\/script>');
const ast: Root = parse_svelte('<script>const x = 1;<\\/script>');`;

	const format_example = `import {format_svelte} from '@fuzdev/tsv_format_wasm';

const formatted = format_svelte('<script>\\nconst   x=1\\n<\\/script>');`;

	const parse_example = `import {parse_svelte, type Root} from '@fuzdev/tsv_parse_wasm';

const ast: Root = parse_svelte('<script>const x = 1;<\\/script>');`;

	const no_locations_example = `import {parse_typescript_no_locations, reconstruct_locations} from '@fuzdev/tsv_parse_wasm';

// span-only AST: start/end offsets, no per-node loc (~46% smaller)
const ast = parse_typescript_no_locations('const x = 1;');

// derive line/column back when you need it, no re-parse
reconstruct_locations(ast, 'const x = 1;');`;
</script>

<TomeContent {tome}>
	<section>
		<Svg data={logo_tsv} size="var(--icon_size_xl2)" class="float:right ml_lg mb_lg" />
		<p>
			tsv is a toolchain for TypeScript/JS, CSS, and Svelte in Rust. The first release has a
			formatter that closely follows <a href="https://prettier.io/">Prettier</a> +
			<a href="https://github.com/sveltejs/prettier-plugin-svelte">prettier-plugin-svelte</a>, and a
			drop-in replacement for <a href="https://svelte.dev/">Svelte</a>'s parser +
			<a href="https://github.com/acornjs/acorn">acorn</a> +
			<a href="https://github.com/sveltejs/acorn-typescript">acorn-typescript</a>.
		</p>
		<p>
			Compared to Oxc, Biome, and SWC, tsv is a set of focused tools, not a generic language
			platform, so the focus is Web standards + Svelte and there's no support for JSX/SCSS/etc. The
			extensibility story is currently limited to using its Rust crates as libraries (or forking);
			bridging to JS or WASM plugins is an open question (leaning against).
		</p>
		<p>tsv prioritizes, in order:</p>
		<ol>
			<li>correctness (Svelte and TypeScript conformance, spec adherence for HTML/CSS/JS)</li>
			<li>speed</li>
			<li>binary size and memory usage</li>
			<li>extensibility (valued but deprioritized)</li>
		</ol>
		<p>
			See the <TomeLink slug="benchmarks" /> for stats. Compared to Oxc and Biome, tsv is faster,
			smaller, and uses less memory to parse and format its supported languages.
		</p>
		<p>
			This is an early release, and reports and feedback are appreciated — see the
			<a href="https://github.com/fuzdev/tsv/issues">issues</a> and
			<a href="https://github.com/fuzdev/tsv/discussions">discussions</a>.
		</p>
		<p>
			AI disclosure: this codebase is mostly LLM-generated, and the usual caveats apply. The first
			release took 7 months and ~1800 manual commits. It's a high-effort project that prioritizes
			quality.
		</p>
		<p>
			These docs are a work in progress. For design details see the <a
				href="https://github.com/fuzdev/tsv">readme</a
			>.
		</p>
		<TomeSection>
			<TomeSectionHeader text="Install" />
			<p>tsv ships as WASM packages on npm, a CLI with a formatter and parser:</p>
			<Code
				lang="sh"
				content={'npm i -D @fuzdev/tsv_wasm\nnpx tsv format src\nnpx tsv parse src/foo.svelte'}
			/>
			<p>For smaller builds, the formatter and parser also ship solo:</p>
			<Code
				lang="sh"
				content={'npm i -D @fuzdev/tsv_format_wasm\nnpm i -D @fuzdev/tsv_parse_wasm'}
			/>
			<p>
				See the <TomeLink slug="benchmarks" /> for size and performance details.
			</p>
			<p>
				Native builds are not yet published — follow
				<a href="https://github.com/fuzdev/tsv/issues/139">issue 139</a>.
			</p>
		</TomeSection>
		<TomeSection>
			<TomeSectionHeader text="Usage" />
			<p>All three packages share the same API. The full package exports both halves:</p>
			<Code lang="ts" content={usage_example} />
			<p>The formatter alone:</p>
			<Code lang="ts" content={format_example} />
			<p>The parser alone:</p>
			<Code lang="ts" content={parse_example} />
			<p>
				<code>format_typescript</code>, <code>format_css</code>, <code>parse_typescript</code>, and
				<code>parse_css</code> work the same way, and the parsers return Svelte-compatible JSON ASTs
				with bundled TS types. Everything works zero-config in Node.js, Bun, and Deno (sync
				auto-init); browsers and bundlers call <code>await init()</code> once first.
			</p>
		</TomeSection>
		<TomeSection>
			<TomeSectionHeader text="Span-only parsing" />
			<p>
				For TypeScript and Svelte, the parsers also emit a span-only AST that drops the per-node
				<code>loc</code> (line/column) object — Svelte also drops <code>name_loc</code> — for a ~46%
				smaller, faster-to-materialize result, mirroring acorn's <code>locations: false</code>. Line
				and column stay derivable from the <code>start</code>/<code>end</code> offsets plus your
				source, so nothing is lost when you have the source.
			</p>
			<Code lang="ts" content={no_locations_example} />
			<p>
				<code>reconstruct_locations(ast, source)</code> walks the tree and adds <code>loc</code>
				back, mutating in place — exact for TypeScript, approximate for Svelte (it skips the
				parser's own
				<code>name_loc</code> and a couple of position quirks). For sparse lookups,
				<code>create_locator(source)</code> reuses one line table across calls. CSS has no
				<code>loc</code>, so there's no span-only variant for it.
			</p>
		</TomeSection>
		<TomeSection>
			<TomeSectionHeader text="Source code" />
			<ul>
				<li>
					<a href="https://github.com/fuzdev/tsv">github.com/fuzdev/tsv</a> — the formatter, parser,
					wasm bindings, CLI, etc
				</li>
				<li>
					<a href="https://github.com/fuzdev/tsv.fuz.dev">github.com/fuzdev/tsv.fuz.dev</a> — this
					website
				</li>
			</ul>
		</TomeSection>
	</section>
</TomeContent>

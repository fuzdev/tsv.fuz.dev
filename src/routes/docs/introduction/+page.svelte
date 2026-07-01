<script lang="ts">
	import TomeContent from '@fuzdev/fuz_ui/TomeContent.svelte';
	import Code from '@fuzdev/fuz_code/Code.svelte';
	import TomeLink from '@fuzdev/fuz_ui/TomeLink.svelte';
	import TomeSection from '@fuzdev/fuz_ui/TomeSection.svelte';
	import TomeSectionHeader from '@fuzdev/fuz_ui/TomeSectionHeader.svelte';
	import {tome_get_by_slug} from '@fuzdev/fuz_ui/tome.ts';

	const LIBRARY_ITEM_NAME = 'introduction';

	const tome = tome_get_by_slug(LIBRARY_ITEM_NAME);

	const usage_example = `import {format_svelte, parse_svelte, type Root} from '@fuzdev/tsv_wasm';

const formatted = format_svelte('<script>\\nconst   x=1\\n<\\/script>');
const ast: Root = parse_svelte('<script>const x = 1;<\\/script>');`;

	const format_example = `import {format_svelte} from '@fuzdev/tsv_format_wasm';

const formatted = format_svelte('<script>\\nconst   x=1\\n<\\/script>');`;

	const parse_example = `import {parse_svelte, type Root} from '@fuzdev/tsv_parse_wasm';

const ast: Root = parse_svelte('<script>const x = 1;<\\/script>');`;
</script>

<TomeContent {tome}>
	<section>
		<p>
			tsv is a formatter, parser, and future linter + more for Svelte, TypeScript, and CSS. This is
			an early release, but it's ready for testing and feedback. It probably won't mangle your code!
		</p>
		<p>
			Compared to Oxc, Biome, and SWC, tsv is a set of focused tools, not a generic language
			platform, with Svelte as the only JS framework. The extensibility story is currently limited
			to using its Rust crates as libraries; bridging to JS and/or WASM plugins is an open question.
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
				Native builds are not yet available but are coming in v0.2, see
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
			<TomeSectionHeader text="Source code" />
			<ul>
				<li>
					<a href="https://github.com/fuzdev/tsv">github.com/fuzdev/tsv</a> - the formatter, parser, wasm
					bindings, CLI, etc
				</li>
				<li>
					<a href="https://github.com/fuzdev/tsv.fuz.dev">github.com/fuzdev/tsv.fuz.dev</a> - this website
				</li>
			</ul>
		</TomeSection>
	</section>
</TomeContent>

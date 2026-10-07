<script lang="ts">
	import TomeContent from '@fuzdev/fuz_ui/TomeContent.svelte';
	import Code from '@fuzdev/fuz_code/Code.svelte';
	import TomeLink from '@fuzdev/fuz_ui/TomeLink.svelte';
	import TomeSection from '@fuzdev/fuz_ui/TomeSection.svelte';
	import TomeSectionHeader from '@fuzdev/fuz_ui/TomeSectionHeader.svelte';
	import { tome_get_by_slug } from '@fuzdev/fuz_ui/tome.ts';
	import Svg from '@fuzdev/fuz_ui/Svg.svelte';
	import { logo_tsv } from '@fuzdev/fuz_ui/logos.ts';

	import {
		format_example,
		locations_example,
		parse_example,
		usage_example
	} from './introduction_examples.ts';

	const LIBRARY_ITEM_NAME = 'introduction';

	const tome = tome_get_by_slug(LIBRARY_ITEM_NAME);
</script>

<TomeContent {tome}>
	<section>
		<Svg data={logo_tsv} size="var(--icon_size_xl2)" class="float:right ml_lg mb_lg" />
		<p>
			tsv is a Rust toolchain for TypeScript/JS, CSS, and Svelte (and planned HTML/JSON). Today it
			ships a formatter that closely follows <a href="https://prettier.io/">Prettier</a> +
			<a href="https://github.com/sveltejs/prettier-plugin-svelte">prettier-plugin-svelte</a>, and a
			drop-in for <a href="https://svelte.dev/">Svelte</a>'s parser +
			<a href="https://github.com/acornjs/acorn">acorn</a> +
			<a href="https://github.com/sveltejs/acorn-typescript">acorn-typescript</a>.
		</p>
		<p>
			tsv aims to simplify its covered domains and stay lean, and so it makes opinionated choices.
			The formatter has a single non-configurable style, using Svelte's Prettier config. Among other
			benefits, this means tsv doesn't depend on a JS runtime, which it would need in order to
			resolve configs the way Prettier does.
		</p>
		<p>
			Compared to Oxc, Biome, and swc, tsv is a set of focused tools, not an extensible language
			platform, so it targets Web standards + TS + Svelte and there's no support for JSX/SCSS/etc.
			tsv's extensibility story is currently limited to using its Rust crates as libraries (or
			forking); bridging to JS or wasm plugins is an open question (leaning against).
		</p>
		<p>
			Compared to <a href="https://github.com/baseballyama/rsvelte">rsvelte</a>, tsv has its own
			TS/JS/CSS parsers instead of using Oxc. rsvelte also ships a Svelte compiler and
			linter/typechecker integration; tsv has experimental work in that direction that may never
			ship.
		</p>
		<p>tsv prioritizes, in order:</p>
		<ol>
			<li>
				correctness (spec conformance for JS/CSS, planned for HTML/JSON; fidelity to Svelte and
				TypeScript)
			</li>
			<li>speed</li>
			<li>binary size and memory usage</li>
			<li>extensibility, modularity, reusability</li>
		</ol>
		<p>
			Staying simple is an overarching goal, and is sometimes at odds with flexibility. Feedback is
			welcome to help navigate these tradeoffs.
		</p>
		<p>
			See the <TomeLink slug="benchmarks" /> for measurements. Compared to Oxc/Oxfmt and Biome, tsv
			is generally faster and smaller, but lacks their features, extensibility, and broad language
			support. One reason for tsv to exist is to help find the performance left on the table in the
			Web's implementations.
		</p>
		<p>
			tsv is near production-ready, with a long tail of rare bugs, and APIs may still change.
			Reports and opinions are appreciated. See the
			<a href="https://github.com/fuzdev/tsv/issues">issues</a> and
			<a href="https://github.com/fuzdev/tsv/discussions">discussions</a>.
		</p>
		<p>
			AI disclosure: this codebase is LLM-generated. It's a high-effort project that prioritizes
			quality.
		</p>
		<p>
			These docs are a work in progress. There are more design details in the
			<a href="https://github.com/fuzdev/tsv#about">readme</a>.
		</p>
		<TomeSection>
			<TomeSectionHeader text="Install" />
			<p>
				For format-on-save in VS Code and vsix-compatible editors, install the
				<a href="https://github.com/fuzdev/vscode-extension-tsv-format">
					<code>fuzdev.tsv-format</code> extension
				</a>. It runs tsv's wasm build, so it works in both desktop VS Code and the browser host:
			</p>
			<ul>
				<li>
					<a href="https://marketplace.visualstudio.com/items?itemName=fuzdev.tsv-format">
						VS Code Marketplace
					</a>
				</li>
				<li>
					<a href="https://open-vsx.org/extension/fuzdev/tsv-format">Open VSX</a>
				</li>
			</ul>
			<p>
				tsv is published to npm as
				<a href="https://www.npmjs.com/package/@fuzdev/tsv"><code>@fuzdev/tsv</code></a> with native
				binaries:
			</p>
			<Code
				lang="sh"
				content={'npm i -D @fuzdev/tsv\nnpx tsv format src\nnpx tsv format --check src\nnpx tsv parse src/foo.svelte'}
			/>
			<p>
				<code>tsv format</code> writes changed files in place; <code>--check</code> writes nothing
				and exits 1 if any file would change. Inside a git repo, discovery honors
				<code>.gitignore</code>, <code>.prettierignore</code>, and <code>.formatignore</code>.
			</p>
			<p>
				The native package covers Linux (x64 gnu and musl, arm64 gnu), macOS (arm64 and x64), and
				Windows x64 - for other platforms use the wasm build below.
			</p>
			<p>
				The same CLI binaries are also attached to each
				<a href="https://github.com/fuzdev/tsv/releases">GitHub Release</a> with a
				<code>SHA256SUMS</code> and a build provenance attestation, for use without npm.
			</p>
			<p>
				tsv also ships as wasm, which runs everywhere including browsers and Deno, and provides the
				same <code>tsv</code> command:
			</p>
			<Code lang="sh" content={'npm i -D @fuzdev/tsv-wasm\nnpx tsv format src'} />
			<p>
				Both packages claim the <code>tsv</code> bin name. (TBD if the wasm package needs a
				different name)
			</p>
			<p>For smaller builds, the formatter and parser also ship solo:</p>
			<Code
				lang="sh"
				content={'npm i -D @fuzdev/tsv-format-wasm\nnpm i -D @fuzdev/tsv-parse-wasm'}
			/>
			<p>
				Optimally-sized builds for parsing and formatting individual languages may be added upon
				request. (open an issue)
			</p>
			<p>
				See the <TomeLink slug="benchmarks" /> for size and performance details.
			</p>
		</TomeSection>
		<TomeSection>
			<TomeSectionHeader text="Usage" />
			<p>
				All four packages share one API — the same function names, options, and errors — so
				<code>@fuzdev/tsv</code> and <code>@fuzdev/tsv-wasm</code> are drop-in swaps for each other.
				Both export the formatter and parser together:
			</p>
			<Code lang="ts" content={usage_example} />
			<p>The formatter alone:</p>
			<Code lang="ts" content={format_example} />
			<p>The parser alone:</p>
			<Code lang="ts" content={parse_example} />
			<p>
				<code>format_typescript</code>, <code>format_css</code>, <code>parse_typescript</code>, and
				<code>parse_css</code> work the same way, and the parsers return acorn- and
				Svelte-compatible JSON ASTs with bundled TS types. Their output is checked against
				acorn-typescript's and Svelte's at corpus scale, but hasn't yet been fed through Svelte's
				compiler end to end.
			</p>
			<p>
				Every parser also takes an acorn-style options object:
				<Code lang="ts" content={'{locations: true}'} inline /> for per-node line and column
				(below), and for TypeScript
				<Code lang="ts" content={"{sourceType: 'script' | 'module'}"} inline /> (default
				<Code lang="ts" content="'module'" inline />). <code>format_typescript</code> takes
				<code>sourceType</code> too; without it, formatting retries as a script when the module
				parse fails, so a legacy sloppy script needs no options.
			</p>
			<p>
				A source that doesn't parse throws a <code>SyntaxError</code> from the parsers and
				formatters alike, carrying <code>start</code> (the UTF-16 offset) and
				<Code lang="ts" content={'loc: {line, column}'} inline />. A bad argument — a source that
				isn't a string, an unknown option — throws a <code>TypeError</code>.
			</p>
			<p>
				The native package needs no initialization; the wasm packages work zero-config in Node.js,
				Bun, and Deno (sync auto-init); in browsers and bundlers, call
				<Code lang="ts" content="await init()" inline /> once first.
			</p>
		</TomeSection>
		<TomeSection>
			<TomeSectionHeader text="Line and column" />
			<p>
				The parsers return a span-only AST: every node carries its
				<code>start</code>/<code>end</code> offsets and no per-node <code>loc</code>, as with
				acorn's defaults and oxc-parser's. A span-only tree is smaller and faster to hand to JS, and
				line and column can be derived from the offsets and the source at any time, without
				re-parsing.
			</p>
			<Code lang="ts" content={locations_example} />
			<p>Details:</p>
			<ul>
				<li>
					<Code lang="ts" content={'{locations: true}'} inline /> adds <code>loc</code> to every
					object that has <code>start</code>/<code>end</code>, and <code>name_loc</code> to the
					Svelte elements, attributes, and directives that carry one. It's computed in JS from the
					offsets after the parse, so it costs nothing when off.
				</li>
				<li>
					<code>loc</code> has one definition: the line and UTF-16 column of the node's own
					<code>start</code> and <code>end</code>. For TypeScript that is exactly acorn's
					<Code lang="ts" content="locations: true" inline />. For Svelte and CSS it covers more
					nodes than the canonical parsers do (template nodes, comments, and CSS nodes included) and
					doesn't reproduce the places where Svelte's <code>loc</code> disagrees with its own
					offsets.
				</li>
				<li>
					Lines break on ECMAScript's line terminators in TypeScript, and on <code>\n</code> alone
					in Svelte and CSS.
				</li>
				<li>
					<Code lang="ts" content="reconstruct_locations(ast, source)" inline /> runs the same walk
					over a tree you already hold, mutating it in place.
				</li>
				<li>
					For sparse lookups,
					<Code lang="ts" content={'create_locator(source, {language})'} inline /> builds the line
					table once, so <code>position_at(offset)</code> and <code>loc_of(node)</code> cost only
					the positions you ask for.
				</li>
				<li>
					The helpers also ship alone, loading no engine, as the <code>./locations</code> subpath of
					every package that parses.
				</li>
				<li>
					On the command line, <Code lang="sh" content="tsv parse --locations" inline /> prints the
					same tree.
				</li>
			</ul>
		</TomeSection>
		<TomeSection>
			<TomeSectionHeader text="Source code" />
			<ul>
				<li>
					<a href="https://github.com/fuzdev/tsv">github.com/fuzdev/tsv</a> — the formatter, parser,
					wasm bindings, CLI, etc.
				</li>
				<li>
					<a href="https://github.com/fuzdev/tsv.fuz.dev">github.com/fuzdev/tsv.fuz.dev</a> — this
					website
				</li>
			</ul>
		</TomeSection>
	</section>
</TomeContent>

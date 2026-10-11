import{$ as e,F as t,N as n,_t as r,dt as i,et as a,ft as o,gt as s,nt as c}from"./DOkK6z1E.js";import{n as l}from"./C_P3y5DQ.js";import{n as u}from"./DGul0cF0.js";import{t as d}from"./DbS3OIWv.js";import{i as f,t as p}from"./BJ09zfND.js";import{t as m}from"./DSAB4Ico.js";import{n as h,t as g}from"./aqhmu7ZV.js";var _=`import { format_svelte, parse_svelte, type Root } from '@fuzdev/tsv';

const formatted = format_svelte('<script>\\nconst   x=1\\n<\/script>');
const ast: Root = parse_svelte('<script>const x = 1;<\/script>');`,v=`import { format_svelte } from '@fuzdev/tsv-format-wasm';

const formatted = format_svelte('<script>\\nconst   x=1\\n<\/script>');`,y=`import { parse_svelte, type Root } from '@fuzdev/tsv-parse-wasm';

const ast: Root = parse_svelte('<script>const x = 1;<\/script>');`,b=`import { parse_typescript, create_locator } from '@fuzdev/tsv-parse-wasm';

const source = 'const x = 1;';

// the default AST is span-only: start/end offsets, no per-node loc
const ast = parse_typescript(source);

// loc on every node, the tree acorn's \`locations: true\` returns
const located = parse_typescript(source, { locations: true });

// or look up only the positions you need, over one line table
const locator = create_locator(source, { language: 'typescript' });
locator.position_at(ast.body[0].start); // {line: 1, column: 0}
locator.loc_of(ast.body[0]); // {start: {line, column}, end: {line, column}}`,x=t(`<!> <p>For format-on-save in VS Code and vsix-compatible editors, install the <a href="https://github.com/fuzdev/vscode-extension-tsv-format"><code>fuzdev.tsv-format</code> extension</a>. It runs tsv's wasm build, so it works in both desktop VS Code and the browser host:</p> <ul><li><a href="https://marketplace.visualstudio.com/items?itemName=fuzdev.tsv-format">VS Code Marketplace</a></li> <li><a href="https://open-vsx.org/extension/fuzdev/tsv-format">Open VSX</a></li></ul> <p>tsv is published to npm as <a href="https://www.npmjs.com/package/@fuzdev/tsv"><code>@fuzdev/tsv</code></a> with native
				binaries:</p> <!> <p><code>tsv format</code> writes changed files in place; <code>--check</code> writes nothing
				and exits 1 if any file would change. Inside a git repo, discovery honors <code>.gitignore</code>, <code>.prettierignore</code>, and <code>.formatignore</code>.</p> <p>The native package covers Linux (x64 gnu and musl, arm64 gnu), macOS (arm64 and x64), and
				Windows x64 - for other platforms use the wasm build below.</p> <p>The same CLI binaries are also attached to each <a href="https://github.com/fuzdev/tsv/releases">GitHub Release</a> with a <code>SHA256SUMS</code> and a build provenance attestation, for use without npm.</p> <p>tsv also ships as wasm, which runs everywhere including browsers and Deno, and provides the
				same <code>tsv</code> command:</p> <!> <p>Both packages claim the <code>tsv</code> bin name. (TBD if the wasm package needs a
				different name)</p> <p>For smaller builds, the formatter and parser also ship solo:</p> <!> <p>Optimally-sized builds for parsing and formatting individual languages may be added upon
				request. (open an issue)</p> <p>See the <!> for size and performance details.</p>`,1),S=t(`<!> <p>All four packages share one API — the same function names, options, and errors — so <code>@fuzdev/tsv</code> and <code>@fuzdev/tsv-wasm</code> are drop-in swaps for each other.
				Both export the formatter and parser together:</p> <!> <p>The formatter alone:</p> <!> <p>The parser alone:</p> <!> <p><code>format_typescript</code>, <code>format_css</code>, <code>parse_typescript</code>, and <code>parse_css</code> work the same way, and the parsers return plain-object ASTs in
				acorn's and Svelte's shapes, with bundled TS types. Their output is checked against
				acorn-typescript's and Svelte's at corpus scale, but hasn't yet been fed through Svelte's
				compiler end to end.</p> <p>Each parser has a <code>_json</code> twin (<code>parse_svelte_json</code> and so on) that
				returns the AST as a JSON string, skipping the <code>JSON.parse</code>, for callers that
				pass it along rather than walk it; it takes every option but <code>locations</code>.</p> <p>The object parsers also take an acorn-style options object: <!> for per-node line and column
				(below), and for TypeScript <!> (default <!>). <code>format_typescript</code> takes <code>sourceType</code> too; without it, formatting retries as a script when the module
				parse fails, so a legacy sloppy script needs no options.</p> <p>A source that doesn't parse throws a <code>SyntaxError</code> from the parsers and
				formatters alike, carrying <code>start</code> (the UTF-16 offset) and <!>. A bad argument — a source that
				isn't a string, an unknown option — throws a <code>TypeError</code>.</p> <p>The native package needs no initialization; the wasm packages work zero-config in Node.js,
				Bun, and Deno (sync auto-init); in browsers and bundlers, call <!> once first.</p>`,1),C=t(`<!> <p>The parsers return a span-only AST: every node carries its <code>start</code>/<code>end</code> offsets and no per-node <code>loc</code>, as with
				acorn's defaults and oxc-parser's. A span-only tree is smaller and faster to hand to JS, and
				line and column can be derived from the offsets and the source at any time, without
				re-parsing.</p> <!> <p>Details:</p> <ul><li><!> adds <code>loc</code> to every
					object that has <code>start</code>/<code>end</code>, and <code>name_loc</code> to the
					Svelte elements, attributes, and directives that carry one. It's computed in JS from the
					offsets after the parse, so it costs nothing when off.</li> <li><code>loc</code> has one definition: the line and UTF-16 column of the node's own <code>start</code> and <code>end</code>, breaking lines on ECMAScript's line terminators
					in TypeScript and on <code>\\n</code> alone in Svelte and CSS. For TypeScript that is
					exactly acorn's <!>; for Svelte and CSS
					it's a superset of the canonical parsers' <code>loc</code> that follows the offsets where
					Svelte's own <code>loc</code> departs from them.</li> <li><!> runs the same walk
					over a tree you already hold, mutating it in place.</li> <li>For sparse lookups, <!> builds the line
					table once, so <code>position_at(offset)</code> and <code>loc_of(node)</code> cost only
					the positions you ask for.</li> <li>The helpers also ship alone, loading no engine, as the <code>./locations</code> subpath of
					every package that parses.</li> <li>On the command line, <!> prints the
					same tree.</li></ul>`,1),w=t(`<!> <ul><li><a href="https://github.com/fuzdev/tsv">github.com/fuzdev/tsv</a> — the formatter, parser,
					wasm bindings, CLI, etc.</li> <li><a href="https://github.com/fuzdev/tsv.fuz.dev">github.com/fuzdev/tsv.fuz.dev</a> — this
					website</li></ul>`,1),T=t(`<section><!> <p>tsv is a Rust toolchain for TypeScript/JS, CSS, and Svelte (and planned HTML/JSON). Today it
			ships a formatter that closely follows <a href="https://prettier.io/">Prettier</a> + <a href="https://github.com/sveltejs/prettier-plugin-svelte">prettier-plugin-svelte</a>, and a
			drop-in for <a href="https://svelte.dev/">Svelte</a>'s parser + <a href="https://github.com/acornjs/acorn">acorn</a> + <a href="https://github.com/sveltejs/acorn-typescript">acorn-typescript</a>.</p> <p>tsv aims to simplify its covered domains and stay lean, and so it makes opinionated choices.
			The formatter has a single non-configurable style, using Svelte's Prettier config. Among other
			benefits, this means tsv doesn't depend on a JS runtime, which it would need in order to
			resolve configs the way Prettier does.</p> <p>Compared to Oxc, Biome, and swc, tsv is a set of focused tools, not an extensible language
			platform, so it targets Web standards + TS + Svelte and there's no support for JSX/SCSS/etc.
			tsv's extensibility story is currently limited to using its Rust crates as libraries (or
			forking); bridging to JS or wasm plugins is an open question (leaning against).</p> <p>Compared to <a href="https://github.com/baseballyama/rsvelte">rsvelte</a>, tsv has its own
			TS/JS/CSS parsers instead of using Oxc. rsvelte also ships a Svelte compiler and
			linter/typechecker integration; tsv has experimental work in that direction that may never
			ship.</p> <p>tsv prioritizes, in order:</p> <ol><li>correctness (spec conformance for JS/CSS, planned for HTML/JSON; fidelity to Svelte and
				TypeScript)</li> <li>speed</li> <li>binary size and memory usage</li> <li>extensibility, modularity, reusability</li></ol> <p>Staying simple is an overarching goal, and is sometimes at odds with flexibility. Feedback is
			welcome to help navigate these tradeoffs.</p> <p>See the <!> for measurements. Compared to Oxc/Oxfmt and Biome, tsv
			is generally faster and smaller, but lacks their features, extensibility, and broad language
			support. One reason for tsv to exist is to help find the performance left on the table in the
			Web's implementations.</p> <p>tsv is near production-ready, with a long tail of rare bugs, and APIs may still change.
			Reports and opinions are appreciated. See the <a href="https://github.com/fuzdev/tsv/issues">issues</a> and <a href="https://github.com/fuzdev/tsv/discussions">discussions</a>.</p> <p>AI disclosure: this codebase is LLM-generated. It's a high-effort project that prioritizes
			quality.</p> <p>These docs are a work in progress. There are more design details in the <a href="https://github.com/fuzdev/tsv#about">readme</a>.</p> <!> <!> <!> <!></section>`);function E(t,E){o(E,!0);let D=u(`introduction`);p(t,{get tome(){return D},children:(t,i)=>{var o=T(),u=e(o);d(u,{get data(){return l},size:`var(--icon_size_xl2)`,class:`float:right ml_lg mb_lg`});var p=c(u,16),E=c(e(p));f(E,{slug:`benchmarks`}),s(),r(p);var D=c(p,8);h(D,{children:(t,i)=>{var o=x(),l=a(o);g(l,{text:`Install`});var u=c(l,8);m(u,{lang:`sh`,content:`npm i -D @fuzdev/tsv
npx tsv format src
npx tsv format --check src
npx tsv parse src/foo.svelte`});var d=c(u,10);m(d,{lang:`sh`,content:`npm i -D @fuzdev/tsv-wasm
npx tsv format src`});var p=c(d,6);m(p,{lang:`sh`,content:`npm i -D @fuzdev/tsv-format-wasm
npm i -D @fuzdev/tsv-parse-wasm`});var h=c(p,4),_=c(e(h));f(_,{slug:`benchmarks`}),s(),r(h),n(t,o)},$$slots:{default:!0}});var O=c(D,2);h(O,{children:(t,i)=>{var o=S(),l=a(o);g(l,{text:`Usage`});var u=c(l,4);m(u,{lang:`ts`,get content(){return _}});var d=c(u,4);m(d,{lang:`ts`,get content(){return v}});var f=c(d,4);m(f,{lang:`ts`,get content(){return y}});var p=c(f,6),h=c(e(p));m(h,{lang:`ts`,dangerous_raw_html:`<span class="token_punctuation">{</span>locations<span class="token_operator">:</span> <span class="token_boolean">true</span><span class="token_punctuation">}</span>`,inline:!0});var b=c(h,2);m(b,{lang:`ts`,dangerous_raw_html:`<span class="token_punctuation">{</span>sourceType<span class="token_operator">:</span> <span class="token_string">'script'</span> <span class="token_operator">|</span> <span class="token_string">'module'</span><span class="token_punctuation">}</span>`,inline:!0});var x=c(b,2);m(x,{lang:`ts`,dangerous_raw_html:`<span class="token_string">'module'</span>`,inline:!0}),s(5),r(p);var C=c(p,2),w=c(e(C),5);m(w,{lang:`ts`,dangerous_raw_html:`loc<span class="token_operator">:</span> <span class="token_punctuation">{</span>line<span class="token_punctuation">,</span> column<span class="token_punctuation">}</span>`,inline:!0}),s(3),r(C);var T=c(C,2),E=c(e(T));m(E,{lang:`ts`,dangerous_raw_html:`<span class="token_special_keyword">await</span> <span class="token_function">init</span><span class="token_punctuation">()</span>`,inline:!0}),s(),r(T),n(t,o)},$$slots:{default:!0}});var k=c(O,2);h(k,{children:(t,i)=>{var o=C(),l=a(o);g(l,{text:`Line and column`});var u=c(l,4);m(u,{lang:`ts`,get content(){return b}});var d=c(u,4),f=e(d),p=e(f);m(p,{lang:`ts`,dangerous_raw_html:`<span class="token_punctuation">{</span>locations<span class="token_operator">:</span> <span class="token_boolean">true</span><span class="token_punctuation">}</span>`,inline:!0}),s(9),r(f);var h=c(f,2),_=c(e(h),8);m(_,{lang:`ts`,dangerous_raw_html:`locations<span class="token_operator">:</span> <span class="token_boolean">true</span>`,inline:!0}),s(5),r(h);var v=c(h,2),y=e(v);m(y,{lang:`ts`,dangerous_raw_html:`<span class="token_function">reconstruct_locations</span><span class="token_punctuation">(</span>ast<span class="token_punctuation">,</span> source<span class="token_punctuation">)</span>`,inline:!0}),s(),r(v);var x=c(v,2),S=c(e(x));m(S,{lang:`ts`,dangerous_raw_html:`<span class="token_function">create_locator</span><span class="token_punctuation">(</span>source<span class="token_punctuation">,</span> <span class="token_punctuation">{</span>language<span class="token_punctuation">})</span>`,inline:!0}),s(5),r(x);var w=c(x,4),T=c(e(w));m(T,{lang:`sh`,content:`tsv parse --locations`,inline:!0}),s(),r(w),r(d),n(t,o)},$$slots:{default:!0}});var A=c(k,2);h(A,{children:(e,t)=>{var r=w(),i=a(r);g(i,{text:`Source code`}),s(2),n(e,r)},$$slots:{default:!0}}),r(o),n(t,o)},$$slots:{default:!0}}),i()}export{E as t};
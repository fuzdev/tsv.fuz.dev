import{$ as e,F as t,N as n,_t as r,dt as i,et as a,ft as o,gt as s,nt as c}from"./DOkK6z1E.js";import{n as l}from"./C_P3y5DQ.js";import{n as u}from"./D6xHBEYi.js";import{t as d}from"./DbS3OIWv.js";import{i as f,t as p}from"./CV_oYweD.js";import{t as m}from"./CG9fjYIS.js";import{n as h,t as g}from"./K3K_iwnx.js";var _=`import { format_svelte, parse_svelte, strip_typescript, type Root } from '@fuzdev/tsv';

const formatted = format_svelte('<script>\\nconst   x=1\\n<\/script>');
if (formatted.ok) console.log(formatted.code);

const parsed = parse_svelte('<script>const x = 1;<\/script>');
if (!parsed.ok) throw new Error(parsed.error.message);
const ast: Root = parsed.ast;

const stripped = strip_typescript('let x: number = 1;');`,v=`import { format_svelte } from '@fuzdev/tsv-format-wasm';

const formatted = format_svelte('<script>\\nconst   x=1\\n<\/script>');`,y=`import { parse_svelte } from '@fuzdev/tsv-parse-wasm';

const parsed = parse_svelte('<script>const x = 1;<\/script>');`,b=`import { format_typescript } from '@fuzdev/tsv';

const result = format_typescript('let a;\\nconst = ;');
if (!result.ok) {
	result.error.kind; // 'parse'
	result.error.message; // "Expected identifier or destructuring pattern, found '='"
	result.error.frame; // '2:7 const = ;\\n          ^ here'
	result.error.loc.start; // {line: 2, column: 6}
}`,x=`import { strip_typescript } from '@fuzdev/tsv';

const result = strip_typescript('let x: number = 1;');
if (result.ok) {
	result.code; // 'let x         = 1;'
} else {
	result.error.kind; // 'parse' or 'unsupported'
}`,S=`import { parse_typescript, create_locator } from '@fuzdev/tsv-parse-wasm';

const source = 'const x = 1;';

// the default AST is span-only: start/end offsets, no per-node loc
const parsed = parse_typescript(source);

// loc on every node, the tree acorn's \`locations: true\` returns
const located = parse_typescript(source, { locations: true });

// or look up only the positions you need, over one line table
const locator = create_locator(source, { language: 'typescript' });
if (parsed.ok) {
	const [declaration] = parsed.ast.body;
	locator.position_at(declaration.start); // {line: 1, column: 0}
	locator.loc_of(declaration); // {start: {line, column}, end: {line, column}}
}`,C=t(`<!> <p>For format-on-save in VS Code and vsix-compatible editors, install the <a href="https://github.com/fuzdev/vscode-extension-tsv-format"><code>fuzdev.tsv-format</code> extension</a>. It runs tsv's wasm build, so it works in both desktop VS Code and the browser host:</p> <ul><li><a href="https://marketplace.visualstudio.com/items?itemName=fuzdev.tsv-format">VS Code Marketplace</a></li> <li><a href="https://open-vsx.org/extension/fuzdev/tsv-format">Open VSX</a></li></ul> <p>tsv is published to npm as <a href="https://www.npmjs.com/package/@fuzdev/tsv"><code>@fuzdev/tsv</code></a> with native
				binaries:</p> <!> <p><code>tsv format</code> writes changed files in place; <code>--check</code> writes nothing
				and exits 1 if any file would change. Inside a git repo, discovery honors <code>.gitignore</code>, <code>.formatignore</code>, and <code>.prettierignore</code>;
				outside one, only <code>.formatignore</code>.</p> <p>The native package covers Linux (x64 gnu and musl, arm64 gnu), macOS (arm64 and x64), and
				Windows x64 - for other platforms use the wasm build below.</p> <p>The same CLI binaries are also attached to each <a href="https://github.com/fuzdev/tsv/releases">GitHub Release</a> with a <code>SHA256SUMS</code> and a build provenance attestation, for use without npm.</p> <p>tsv also ships as wasm, which runs everywhere including browsers and Deno, and provides the
				same <code>tsv</code> command:</p> <!> <p>Both packages claim the <code>tsv</code> bin name. (TBD if the wasm package needs a
				different name)</p> <p>For smaller builds, the formatter and parser also ship solo:</p> <!> <p>Optimally-sized builds for parsing and formatting individual languages may be added upon
				request. (open an issue)</p> <p>See the <!> for size and performance details.</p>`,1),w=t(`<!> <p>All four packages share one API — the same function names, options, and errors, each solo
				package carrying its part — so <code>@fuzdev/tsv</code> and <code>@fuzdev/tsv-wasm</code> are drop-in swaps for each other. Both export the formatter, the parser, and the type
				stripper together:</p> <!> <p>The formatter alone:</p> <!> <p>The parser alone:</p> <!> <p><code>format_typescript</code>, <code>format_css</code>, <code>parse_typescript</code>, and <code>parse_css</code> work the same way. Every export returns a result object rather than
				throwing for what it finds in the source: <!> from the formatters and <!> from the parsers, whose ASTs are plain
				objects in acorn's and Svelte's shapes, with bundled TS types. Their output is checked
				against acorn-typescript's and Svelte's at corpus scale, but hasn't yet been fed through
				Svelte's compiler end to end.</p> <p>Each parser has a <code>_json</code> twin (<code>parse_svelte_json</code> and so on) that
				returns the AST as a JSON string, <!>,
				skipping the <code>JSON.parse</code>, for callers that pass it along rather than walk it; it
				takes every option but <code>locations</code>.</p> <p>The object parsers also take an acorn-style options object: <!> for per-node line and column
				(below), and for TypeScript <!> (default <!>). <code>format_typescript</code> takes <code>sourceType</code> too, as does <code>strip_typescript</code>; without it, they retry
				as a script when the module parse fails, so a legacy sloppy script needs no options.</p> <p>A source that doesn't parse returns <!> from the parsers, formatters, and type stripper alike. The <code>error</code> is a plain
				object shaped like an AST node: <code>kind</code>, a one-line <code>message</code>, a <code>frame</code> with the excerpt and caret, its <code>start</code>/<code>end</code> UTF-16 offsets, and their <code>loc</code>:</p> <!> <p>Its type is <code>TsvParseError</code>, and every error type extends <code>TsvError</code>.
				A bad argument — a source that isn't a string, an unknown option — still throws a <code>TypeError</code>, and an engine failure with no position in the source, like an input
				over the size cap or a wasm trap, still throws as itself.</p> <p>The native package needs no initialization; the wasm packages work zero-config in Node.js,
				Bun, and Deno (sync auto-init); in browsers and bundlers, call <!> once first.</p>`,1),T=t(`<!> <p><code>strip_typescript</code>, in <code>@fuzdev/tsv</code> and <code>@fuzdev/tsv-wasm</code>, blanks every type to whitespace, so the JS keeps the
				TypeScript's lines and columns and needs no source map. TypeScript that blanking can't
				erase, like an <code>enum</code> or a parameter property, is refused rather than
				transformed, returned as an error with <!>:</p> <!> <p><code>tsv strip</code> does the same for one TypeScript file (<code>.ts</code>, <code>.mts</code>, or <code>.cts</code>), <code>--content</code>, or <code>--stdin</code>,
				printing the JS to stdout; it exits 1 on a refusal and 2 on a parse error, and <code>--check</code> prints nothing and keeps those exit codes. See <a href="https://github.com/fuzdev/tsv/blob/main/docs/strip.md">docs/strip.md</a> for the
				details.</p>`,1),E=t(`<!> <p>The parsers return a span-only AST: every node carries its <code>start</code>/<code>end</code> offsets and no per-node <code>loc</code>, as with
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
					same tree.</li></ul>`,1),D=t(`<!> <ul><li><a href="https://github.com/fuzdev/tsv">github.com/fuzdev/tsv</a> — the formatter, parser,
					type stripper, wasm bindings, CLI, etc.</li> <li><a href="https://github.com/fuzdev/tsv.fuz.dev">github.com/fuzdev/tsv.fuz.dev</a> — this
					website</li></ul>`,1),O=t(`<section><!> <p>tsv is a Rust toolchain for TypeScript/JS, CSS, and Svelte (and planned HTML/JSON). Today it
			ships a formatter that closely follows <a href="https://prettier.io/">Prettier</a> + <a href="https://github.com/sveltejs/prettier-plugin-svelte">prettier-plugin-svelte</a>, and a
			drop-in for <a href="https://svelte.dev/">Svelte</a>'s parser + <a href="https://github.com/acornjs/acorn">acorn</a> + <a href="https://github.com/sveltejs/acorn-typescript">acorn-typescript</a>, plus a type
			stripper that turns TypeScript into JS by blanking its types to whitespace, so every line and
			column stays put.</p> <p>tsv aims to simplify its covered domains and stay lean, and so it makes opinionated choices.
			The formatter has a single non-configurable style, using Svelte's Prettier config. Among other
			benefits, this means tsv doesn't depend on a JS runtime, which it would need in order to
			resolve configs the way Prettier does.</p> <p>Compared to Oxc, Biome, and swc, tsv is a set of focused tools, not an extensible language
			platform, so it targets Web standards + TS + Svelte and there's no support for JSX/SCSS/etc.
			tsv's extensibility story is currently limited to using its Rust crates as libraries (or
			forking); bridging to JS or wasm plugins is an open question (leaning against).</p> <p>Compared to <a href="https://github.com/baseballyama/rsvelte">rsvelte</a>, tsv has its own
			TS/JS/CSS parsers instead of using Oxc. rsvelte also ships a Svelte compiler and
			linter/typechecker integration; tsv has experimental work in that direction that may never
			ship.</p> <p>tsv prioritizes, in order:</p> <ol><li>correctness (spec conformance for JS/CSS, planned for HTML/JSON; fidelity to Svelte and
				TypeScript)</li> <li>speed</li> <li>binary size and memory usage</li> <li>extensibility, modularity, reusability</li></ol> <p>Staying simple is an overarching goal. Feedback is welcome to help navigate these tradeoffs.</p> <p>See the <!> for measurements. Compared to Oxc/Oxfmt and Biome, tsv
			is faster and smaller and uses less memory, but lacks their features, extensibility, and broad
			language support. One reason for tsv to exist is to help find the performance left on the
			table in the Web's implementations.</p> <p>tsv's formatters are near production-ready, with a long tail of rare bugs, and APIs may still
			change. Reports and opinions are appreciated. See the <a href="https://github.com/fuzdev/tsv/issues">issues</a> and <a href="https://github.com/fuzdev/tsv/discussions">discussions</a>.</p> <p>AI disclosure: this codebase is LLM-generated. It's a high-effort project that prioritizes
			quality.</p> <p>These docs are a work in progress. There are more design details in the <a href="https://github.com/fuzdev/tsv#about">readme</a>.</p> <!> <!> <!> <!> <!></section>`);function k(t,k){o(k,!0);let A=u(`introduction`);p(t,{get tome(){return A},children:(t,i)=>{var o=O(),u=e(o);d(u,{get data(){return l},size:`var(--icon_size_xl2)`,class:`float:right ml_lg mb_lg`});var p=c(u,16),k=c(e(p));f(k,{slug:`benchmarks`}),s(),r(p);var A=c(p,8);h(A,{children:(t,i)=>{var o=C(),l=a(o);g(l,{text:`Install`});var u=c(l,8);m(u,{lang:`sh`,content:`npm i -D @fuzdev/tsv
npx tsv format src
npx tsv format --check src
npx tsv parse src/foo.svelte
npx tsv strip src/foo.ts`});var d=c(u,10);m(d,{lang:`sh`,content:`npm i -D @fuzdev/tsv-wasm
npx tsv format src`});var p=c(d,6);m(p,{lang:`sh`,content:`npm i -D @fuzdev/tsv-format-wasm
npm i -D @fuzdev/tsv-parse-wasm`});var h=c(p,4),_=c(e(h));f(_,{slug:`benchmarks`}),s(),r(h),n(t,o)},$$slots:{default:!0}});var j=c(A,2);h(j,{children:(t,i)=>{var o=w(),l=a(o);g(l,{text:`Usage`});var u=c(l,4);m(u,{lang:`ts`,get content(){return _}});var d=c(u,4);m(d,{lang:`ts`,get content(){return v}});var f=c(d,4);m(f,{lang:`ts`,get content(){return y}});var p=c(f,2),h=c(e(p),8);m(h,{lang:`ts`,dangerous_raw_html:`<span class="token_punctuation">{</span>ok<span class="token_operator">:</span> <span class="token_boolean">true</span><span class="token_punctuation">,</span> code<span class="token_punctuation">}</span>`,inline:!0});var x=c(h,2);m(x,{lang:`ts`,dangerous_raw_html:`<span class="token_punctuation">{</span>ok<span class="token_operator">:</span> <span class="token_boolean">true</span><span class="token_punctuation">,</span> ast<span class="token_punctuation">}</span>`,inline:!0}),s(),r(p);var S=c(p,2),C=c(e(S),5);m(C,{lang:`ts`,dangerous_raw_html:`<span class="token_punctuation">{</span>ok<span class="token_operator">:</span> <span class="token_boolean">true</span><span class="token_punctuation">,</span> json<span class="token_punctuation">}</span>`,inline:!0}),s(5),r(S);var T=c(S,2),E=c(e(T));m(E,{lang:`ts`,dangerous_raw_html:`<span class="token_punctuation">{</span>locations<span class="token_operator">:</span> <span class="token_boolean">true</span><span class="token_punctuation">}</span>`,inline:!0});var D=c(E,2);m(D,{lang:`ts`,dangerous_raw_html:`<span class="token_punctuation">{</span>sourceType<span class="token_operator">:</span> <span class="token_string">'script'</span> <span class="token_operator">|</span> <span class="token_string">'module'</span><span class="token_punctuation">}</span>`,inline:!0});var O=c(D,2);m(O,{lang:`ts`,dangerous_raw_html:`<span class="token_string">'module'</span>`,inline:!0}),s(7),r(T);var k=c(T,2),A=c(e(k));m(A,{lang:`ts`,dangerous_raw_html:`<span class="token_punctuation">{</span>ok<span class="token_operator">:</span> <span class="token_boolean">false</span><span class="token_punctuation">,</span> error<span class="token_punctuation">}</span>`,inline:!0}),s(15),r(k);var j=c(k,2);m(j,{lang:`ts`,get content(){return b}});var M=c(j,4),N=c(e(M));m(N,{lang:`ts`,dangerous_raw_html:`<span class="token_special_keyword">await</span> <span class="token_function">init</span><span class="token_punctuation">()</span>`,inline:!0}),s(),r(M),n(t,o)},$$slots:{default:!0}});var M=c(j,2);h(M,{children:(t,i)=>{var o=T(),l=a(o);g(l,{text:`Type stripping`});var u=c(l,2),d=c(e(u),8);m(d,{lang:`ts`,dangerous_raw_html:`kind<span class="token_operator">:</span> <span class="token_string">'unsupported'</span>`,inline:!0}),s(),r(u);var f=c(u,2);m(f,{lang:`ts`,get content(){return x}}),s(2),n(t,o)},$$slots:{default:!0}});var N=c(M,2);h(N,{children:(t,i)=>{var o=E(),l=a(o);g(l,{text:`Line and column`});var u=c(l,4);m(u,{lang:`ts`,get content(){return S}});var d=c(u,4),f=e(d),p=e(f);m(p,{lang:`ts`,dangerous_raw_html:`<span class="token_punctuation">{</span>locations<span class="token_operator">:</span> <span class="token_boolean">true</span><span class="token_punctuation">}</span>`,inline:!0}),s(9),r(f);var h=c(f,2),_=c(e(h),8);m(_,{lang:`ts`,dangerous_raw_html:`locations<span class="token_operator">:</span> <span class="token_boolean">true</span>`,inline:!0}),s(5),r(h);var v=c(h,2),y=e(v);m(y,{lang:`ts`,dangerous_raw_html:`<span class="token_function">reconstruct_locations</span><span class="token_punctuation">(</span>ast<span class="token_punctuation">,</span> source<span class="token_punctuation">)</span>`,inline:!0}),s(),r(v);var b=c(v,2),x=c(e(b));m(x,{lang:`ts`,dangerous_raw_html:`<span class="token_function">create_locator</span><span class="token_punctuation">(</span>source<span class="token_punctuation">,</span> <span class="token_punctuation">{</span>language<span class="token_punctuation">})</span>`,inline:!0}),s(5),r(b);var C=c(b,4),w=c(e(C));m(w,{lang:`sh`,content:`tsv parse --locations`,inline:!0}),s(),r(C),r(d),n(t,o)},$$slots:{default:!0}});var P=c(N,2);h(P,{children:(e,t)=>{var r=D(),i=a(r);g(i,{text:`Source code`}),s(2),n(e,r)},$$slots:{default:!0}}),r(o),n(t,o)},$$slots:{default:!0}}),i()}export{k as t};
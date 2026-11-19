import{F as e,N as t,bt as n,ht as r,it as i,mt as a,nt as o,tt as s,yt as c}from"./DueBUEi8.js";import{i as l,t as u}from"./D_8jDKym.js";import{t as d}from"./_WE_nYit.js";import{n as f,t as p}from"./CpviucJX.js";import{n as m}from"./CT1YSWXK.js";import{t as h}from"./OPV5Ichf.js";import{n as g}from"./CRoEIyQu.js";var _=`import { format_svelte, parse_svelte, strip_typescript, type Root } from '@fuzdev/tsv';

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
}

const refused = strip_typescript('enum Color { Red }');
if (!refused.ok && refused.error.kind === 'unsupported') {
	refused.error.construct; // 'enum'
}`,S=`import { parse_imports_svelte } from '@fuzdev/tsv';

const result = parse_imports_svelte('<script>\\n\\timport Button from "./Button.svelte";\\n<\/script>');
if (result.ok) {
	result.hasModuleSyntax; // true
	result.imports[0]?.kind; // 'static'
	result.imports[0]?.specifier?.value; // './Button.svelte'
	result.imports[0]?.typeOnly; // null, or 'statement' / 'specifiers' for a type-only request
}`,C=`import { parse_typescript, create_locator } from '@fuzdev/tsv-parse-wasm';

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
}`,w=e(`<!> <p>For format-on-save in VS Code and vsix-compatible editors, install the <a href="https://github.com/fuzdev/vscode-extension-tsv-format"><code>fuzdev.tsv-format</code> extension</a>. It runs tsv's wasm build, so it works in both desktop VS Code and the browser host:</p> <ul><li><a href="https://marketplace.visualstudio.com/items?itemName=fuzdev.tsv-format">VS Code Marketplace</a></li> <li><a href="https://open-vsx.org/extension/fuzdev/tsv-format">Open VSX</a></li></ul> <p>tsv is published to npm as <a href="https://www.npmjs.com/package/@fuzdev/tsv"><code>@fuzdev/tsv</code></a> with native
				binaries:</p> <!> <p><code>tsv format</code> writes changed files in place; <code>--check</code> writes nothing
				and only reports, and <code>--list</code> prints the files it would touch. Inside a git
				repo, discovery honors <code>.gitignore</code>, <code>.formatignore</code>, and <code>.prettierignore</code>; outside one, only <code>.formatignore</code>. Files format in
				parallel (<code>--jobs N</code> sets the count). <code>--content</code> or <code>--stdin</code> with <code>--parser svelte|typescript|css</code> formats or parses a
				string to stdout.</p> <p>Exit codes: <code>format</code> exits 0 when clean, 1 when <code>--check</code> finds a
				change, and 2 on errors; <code>parse</code> exits 0 when parsed, 1 when the input doesn't
				parse, and 2 on a usage or read error. See <a href="https://github.com/fuzdev/tsv/blob/main/docs/cli.md">docs/cli.md</a> for the full
				CLI.</p> <p>The npm packages need Node.js 22+ or Bun. The native package covers Linux (x64 gnu and musl,
				arm64 gnu), macOS (arm64 and x64), and Windows x64 - for other platforms use the wasm build
				below.</p> <p>The same CLI binaries are also attached to each <a href="https://github.com/fuzdev/tsv/releases">GitHub Release</a> with a <code>SHA512SUMS</code> and a build provenance attestation, for use without npm.</p> <p>The CLI is also on crates.io as <a href="https://crates.io/crates/tsv_cli"><code>tsv_cli</code></a>: <code>cargo binstall tsv_cli</code> fetches the same prebuilt binary, and <code>cargo install --locked tsv_cli</code> builds it from source (without the release
				profile or profile-guided optimization, so it runs slower). The libraries are crates too,
				one per language: <a href="https://docs.rs/tsv_ts"><code>tsv_ts</code></a>, <a href="https://docs.rs/tsv_css"><code>tsv_css</code></a>, and <a href="https://docs.rs/tsv_svelte"><code>tsv_svelte</code></a>. Also published: <a href="https://docs.rs/tsv_ignore"><code>tsv_ignore</code></a>, the gitignore-faithful
				matcher behind discovery, and <a href="https://docs.rs/tsv_html"><code>tsv_html</code></a>,
				the WHATWG named character references; <code>tsv_lang</code> and <code>tsv_discover</code> are support crates. See the readme's <a href="https://github.com/fuzdev/tsv#rust">Rust section</a> for examples and how the npm
				API maps to the crates.</p> <p>tsv also ships as wasm, which runs everywhere including browsers, and provides the same <code>tsv</code> command:</p> <!> <p>Both packages claim the <code>tsv</code> bin name. (TBD if the wasm package needs a
				different name)</p> <p>For smaller builds, the formatter and parser also ship solo:</p> <!> <p>Optimally-sized builds for parsing and formatting individual languages may be added upon
				request. (open an issue)</p> <p>See the <!> for size and performance details.</p>`,1),T=e(`<!> <p>All four packages share one API — the same function names, options, and errors, each solo
				package carrying its part — so <code>@fuzdev/tsv</code> and <code>@fuzdev/tsv-wasm</code> are drop-in swaps for each other. Both export the formatter, the parser, the type stripper,
				and the import lister together:</p> <!> <p>The formatter alone:</p> <!> <p>The parser alone:</p> <!> <p><code>format_typescript</code>, <code>format_css</code>, <code>parse_typescript</code>, and <code>parse_css</code> work the same way. Every export returns a result object rather than
				throwing for what it finds in the source: <!> from the formatters and <!> from the parsers, whose ASTs are plain
				objects in acorn's and Svelte's shapes, with bundled TS types. Their output is checked
				against acorn-typescript's and Svelte's at corpus scale, but hasn't yet been fed through
				Svelte's compiler end to end.</p> <p>Each parser has a <code>_json</code> twin (<code>parse_svelte_json</code> and so on) that
				returns the AST as a JSON string, <!>,
				skipping the <code>JSON.parse</code>, for callers that pass it along rather than walk it; it
				takes every option but <code>locations</code>.</p> <p>The object parsers also take an acorn-style options object: <!> for per-node line and column
				(below), and for TypeScript <!> (default <!>). <code>format_typescript</code> takes <code>sourceType</code> too, as do <code>strip_typescript</code> and <code>parse_imports_typescript</code>; without it, they retry as a script when the module
				parse fails, so a legacy sloppy script needs no options.</p> <p>The second argument must be an options object, so write <!>, not <!>, which passes the array
				index and throws.</p> <p>A source that doesn't parse returns <!> from the parsers, formatters, and type stripper alike. The <code>error</code> is a plain
				object shaped like an AST node: <code>kind</code>, a one-line <code>message</code>, a <code>frame</code> with the excerpt and caret, its <code>start</code>/<code>end</code> UTF-16 offsets, and their <code>loc</code>:</p> <!> <p>Its type is <code>TsvParseError</code>, and every error type extends <code>TsvError</code>.
				Two other kinds share its shape: the type stripper's <!> (below), and <!> (<code>FormatRefusedError</code>), which <code>format_svelte</code> returns for a rare source it parses but can't format without
				changing its meaning.</p> <p>A bad argument — a source that isn't a string, an unknown option — still throws a <code>TypeError</code>, and an engine failure with no position in the source, like an input
				over the size cap or a wasm trap, still throws as itself. A wasm trap, a stack overflow on a
				stack smaller than tsv's depth limits assume, also breaks the instance, so every later call
				throws too; <!> swaps in a fresh one from
				the already-compiled module.</p> <p>The packages are ESM; a CommonJS host loads them with <!>. The native package needs no
				initialization; the wasm packages work zero-config in Node.js and Bun (sync auto-init); in
				browsers and bundlers, call <!> once first. To
				run a wasm package across worker threads without recompiling, hand its exported <code>wasm_module</code> to each worker, which imports the <code>/worker</code> subpath and
				calls <!>; the <a href="https://www.npmjs.com/package/@fuzdev/tsv-format-wasm"><code>@fuzdev/tsv-format-wasm</code> readme</a> shows the pattern.</p> <p><code>IgnoreStack</code>, exported by <code>@fuzdev/tsv</code> and the format-capable wasm
				packages, is the matcher and discovery policy behind <code>tsv format</code>, for tooling
				that needs to reproduce exactly which files it touches.</p>`,1),E=e(`<!> <p><code>strip_typescript</code>, in <code>@fuzdev/tsv</code> and <code>@fuzdev/tsv-wasm</code>, blanks every type to whitespace, so the JS keeps the
				TypeScript's lines and columns and needs no source map. TypeScript that blanking can't
				erase, like an <code>enum</code> or a parameter property, is refused rather than
				transformed, returned as an error with <!> and the refused <code>construct</code>:</p> <!> <p><code>tsv strip</code> does the same for one TypeScript file (<code>.ts</code>, <code>.mts</code>, or <code>.cts</code>), <code>--content</code>, or <code>--stdin</code>,
				printing the JS to stdout; it exits 1 on a refusal and 2 on a parse error, and <code>--check</code> prints nothing and keeps those exit codes. See <a href="https://github.com/fuzdev/tsv/blob/main/docs/strip.md">docs/strip.md</a> for the
				details.</p>`,1),D=e(`<!> <p><code>parse_imports_typescript</code> and <code>parse_imports_svelte</code>, in <code>@fuzdev/tsv</code> and <code>@fuzdev/tsv-wasm</code>, list the modules a source
				requests without handing over an AST: every static <code>import</code>, re-export, dynamic <code>import()</code>, and <code>import x = require()</code>, in source order. Each is a
				full parse, not a scan, so strings, regexes, and comments that look like imports aren't
				mistaken for them:</p> <!> <p>Each record carries its <code>kind</code>, its <code>start</code>/<code>end</code>, the
				decoded <code>specifier</code> with its own span (<code>null</code> for a computed <code>import(x)</code>), <code>typeOnly</code>, <code>phase</code> for source-phase and
				deferred imports, and the span of its <code>attributes</code>, all in UTF-16 offsets. <code>hasModuleSyntax</code> says whether the source uses syntax only a module parses. A
				source that doesn't parse returns <!> as the parsers do. See <a href="https://github.com/fuzdev/tsv/blob/main/docs/imports.md">docs/imports.md</a> for
				the details.</p>`,1),O=e(`<!> <p>The parsers return a span-only AST: every node carries its <code>start</code>/<code>end</code> offsets and no per-node <code>loc</code>, as with
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
					same tree.</li></ul>`,1),k=e(`<!> <ul><li><a href="https://github.com/fuzdev/tsv">github.com/fuzdev/tsv</a> — the formatter, parser,
					type stripper, wasm bindings, CLI, etc.</li> <li><a href="https://github.com/fuzdev/tsv.fuz.dev">github.com/fuzdev/tsv.fuz.dev</a> — this
					website</li></ul>`,1),A=e(`<section><!> <p>tsv is a Rust toolchain for TypeScript/JS, CSS, and Svelte (and planned HTML/JSON). Today it
			ships a formatter that closely follows <a href="https://prettier.io/">Prettier</a> + <a href="https://github.com/sveltejs/prettier-plugin-svelte">prettier-plugin-svelte</a> and a
			parser that can output an AST compatible with <a href="https://svelte.dev/">Svelte</a>'s
			parser + <a href="https://github.com/acornjs/acorn">acorn</a> + <a href="https://github.com/sveltejs/acorn-typescript">acorn-typescript</a>. Alongside them
			are a position-preserving type stripper and an import lister.</p> <p>tsv aims to simplify its covered domains and stay lean, and so it makes opinionated choices.
			The formatter has a single non-configurable style, using Svelte's Prettier config. Among other
			benefits, this means tsv doesn't depend on a JS runtime, which it would need in order to
			resolve configs the way Prettier does, avoiding complexity and performance costs.</p> <p>Compared to Oxc, Biome, and swc, tsv is a set of focused tools, not an extensible language
			platform, so it targets Web standards + TS + Svelte and there's no support for JSX/SCSS/etc.
			tsv's extensibility story is currently limited to using its Rust crates as libraries (or
			forking); bridging to JS or wasm plugins is an open question (leaning against).</p> <p>Compared to <a href="https://github.com/baseballyama/rsvelte">rsvelte</a>, tsv has its own
			TS/JS/CSS parsers instead of using Oxc. rsvelte also ships a Svelte compiler and
			linter/typechecker integration; tsv has experimental work in that direction that may never
			ship.</p> <p>tsv prioritizes, in order:</p> <ol><li>correctness (spec conformance for JS/CSS, planned for HTML/JSON; fidelity to Svelte and
				TypeScript)</li> <li>speed</li> <li>binary size and memory usage</li> <li>extensibility, modularity, reusability</li></ol> <p>Staying simple is an overarching goal. Feedback is welcome to help navigate these tradeoffs.</p> <p>See the <!> for measurements. Compared to Oxfmt and Biome, tsv
			formats faster with smaller artifacts and less memory, but lacks their features,
			extensibility, and broad language support. Parsing into JS is mixed, since Oxc's raw transfer
			and Yuku hand over their trees faster than tsv's JSON. One reason for tsv to exist is to help
			find the performance left on the table in the Web's implementations.</p> <p>tsv's formatters are near production-ready, with a long tail of rare bugs, and APIs may still
			change. The parsers have good <!> on valid code, but negative
			cases (rejecting invalid code) are unfinished. Reports and opinions are appreciated. See the <a href="https://github.com/fuzdev/tsv/issues">issues</a> and <a href="https://github.com/fuzdev/tsv/discussions">discussions</a>.</p> <p>AI disclosure: this codebase is LLM-generated using Claude Code. It's a high-effort project
			that prioritizes quality.</p> <p>These docs are a work in progress. There are more design details in the <a href="https://github.com/fuzdev/tsv#design">readme</a>.</p> <!> <!> <!> <!> <!> <!></section>`);function j(e,j){r(j,!0);let M=m(`introduction`);u(e,{get tome(){return M},children:(e,r)=>{var a=A(),u=s(a);h(u,{get data(){return g},size:`var(--icon_size_xl2)`,class:`float:right ml_lg mb_lg`});var m=i(u,16),j=i(s(m));l(j,{slug:`benchmarks`}),c(),n(m);var M=i(m,2),N=i(s(M));l(N,{slug:`conformance`}),c(5),n(M);var P=i(M,6);f(P,{children:(e,r)=>{var a=w(),u=o(a);p(u,{text:`Install`});var f=i(u,8);d(f,{lang:`sh`,content:`npm i -D @fuzdev/tsv
npx tsv format src
npx tsv format --check src
npx tsv parse src/foo.svelte
npx tsv strip src/foo.ts`});var m=i(f,14);d(m,{lang:`sh`,content:`npm i -D @fuzdev/tsv-wasm
npx tsv format src`});var h=i(m,6);d(h,{lang:`sh`,content:`npm i -D @fuzdev/tsv-format-wasm
npm i -D @fuzdev/tsv-parse-wasm`});var g=i(h,4),_=i(s(g));l(_,{slug:`benchmarks`}),c(),n(g),t(e,a)},$$slots:{default:!0}});var F=i(P,2);f(F,{children:(e,r)=>{var a=T(),l=o(a);p(l,{text:`Usage`});var u=i(l,4);d(u,{lang:`ts`,get content(){return _}});var f=i(u,4);d(f,{lang:`ts`,get content(){return v}});var m=i(f,4);d(m,{lang:`ts`,get content(){return y}});var h=i(m,2),g=i(s(h),8);d(g,{lang:`ts`,dangerous_raw_html:`<span class="token_punctuation">{</span>ok<span class="token_operator">:</span> <span class="token_boolean">true</span><span class="token_punctuation">,</span> code<span class="token_punctuation">}</span>`,inline:!0});var x=i(g,2);d(x,{lang:`ts`,dangerous_raw_html:`<span class="token_punctuation">{</span>ok<span class="token_operator">:</span> <span class="token_boolean">true</span><span class="token_punctuation">,</span> ast<span class="token_punctuation">}</span>`,inline:!0}),c(),n(h);var S=i(h,2),C=i(s(S),5);d(C,{lang:`ts`,dangerous_raw_html:`<span class="token_punctuation">{</span>ok<span class="token_operator">:</span> <span class="token_boolean">true</span><span class="token_punctuation">,</span> json<span class="token_punctuation">}</span>`,inline:!0}),c(5),n(S);var w=i(S,2),E=i(s(w));d(E,{lang:`ts`,dangerous_raw_html:`<span class="token_punctuation">{</span>locations<span class="token_operator">:</span> <span class="token_boolean">true</span><span class="token_punctuation">}</span>`,inline:!0});var D=i(E,2);d(D,{lang:`ts`,dangerous_raw_html:`<span class="token_punctuation">{</span>sourceType<span class="token_operator">:</span> <span class="token_string">'script'</span> <span class="token_operator">|</span> <span class="token_string">'module'</span><span class="token_punctuation">}</span>`,inline:!0});var O=i(D,2);d(O,{lang:`ts`,dangerous_raw_html:`<span class="token_string">'module'</span>`,inline:!0}),c(9),n(w);var k=i(w,2),A=i(s(k));d(A,{lang:`ts`,dangerous_raw_html:`sources<span class="token_punctuation">.</span><span class="token_function">map</span><span class="token_punctuation">((</span>s<span class="token_punctuation">)</span> <span class="token_operator">=></span> <span class="token_function">format_typescript</span><span class="token_punctuation">(</span>s<span class="token_punctuation">))</span>`,inline:!0});var j=i(A,2);d(j,{lang:`ts`,dangerous_raw_html:`sources<span class="token_punctuation">.</span><span class="token_function">map</span><span class="token_punctuation">(</span>format_typescript<span class="token_punctuation">)</span>`,inline:!0}),c(),n(k);var M=i(k,2),N=i(s(M));d(N,{lang:`ts`,dangerous_raw_html:`<span class="token_punctuation">{</span>ok<span class="token_operator">:</span> <span class="token_boolean">false</span><span class="token_punctuation">,</span> error<span class="token_punctuation">}</span>`,inline:!0}),c(15),n(M);var P=i(M,2);d(P,{lang:`ts`,get content(){return b}});var F=i(P,2),I=i(s(F),5);d(I,{lang:`ts`,dangerous_raw_html:`kind<span class="token_operator">:</span> <span class="token_string">'unsupported'</span>`,inline:!0});var L=i(I,2);d(L,{lang:`ts`,dangerous_raw_html:`kind<span class="token_operator">:</span> <span class="token_string">'refused'</span>`,inline:!0}),c(5),n(F);var R=i(F,2),z=i(s(R),3);d(z,{lang:`ts`,dangerous_raw_html:`<span class="token_function">reinstantiate</span><span class="token_punctuation">()</span>`,inline:!0}),c(),n(R);var B=i(R,2),V=i(s(B));d(V,{lang:`ts`,dangerous_raw_html:`<span class="token_special_keyword">await</span> <span class="token_special_keyword">import</span><span class="token_punctuation">(</span><span class="token_string">'@fuzdev/tsv'</span><span class="token_punctuation">)</span>`,inline:!0});var H=i(V,2);d(H,{lang:`ts`,dangerous_raw_html:`<span class="token_special_keyword">await</span> <span class="token_function">init</span><span class="token_punctuation">()</span>`,inline:!0});var U=i(H,6);d(U,{lang:`ts`,dangerous_raw_html:`<span class="token_function">init_sync</span><span class="token_punctuation">({</span>module<span class="token_operator">:</span> wasm_module<span class="token_punctuation">})</span>`,inline:!0}),c(3),n(B),c(2),t(e,a)},$$slots:{default:!0}});var I=i(F,2);f(I,{children:(e,r)=>{var a=E(),l=o(a);p(l,{text:`Type stripping`});var u=i(l,2),f=i(s(u),8);d(f,{lang:`ts`,dangerous_raw_html:`kind<span class="token_operator">:</span> <span class="token_string">'unsupported'</span>`,inline:!0}),c(3),n(u);var m=i(u,2);d(m,{lang:`ts`,get content(){return x}}),c(2),t(e,a)},$$slots:{default:!0}});var L=i(I,2);f(L,{children:(e,r)=>{var a=D(),l=o(a);p(l,{text:`Import records`});var u=i(l,4);d(u,{lang:`ts`,get content(){return S}});var f=i(u,2),m=i(s(f),21);d(m,{lang:`ts`,dangerous_raw_html:`<span class="token_punctuation">{</span>ok<span class="token_operator">:</span> <span class="token_boolean">false</span><span class="token_punctuation">,</span> error<span class="token_punctuation">}</span>`,inline:!0}),c(3),n(f),t(e,a)},$$slots:{default:!0}});var R=i(L,2);f(R,{children:(e,r)=>{var a=O(),l=o(a);p(l,{text:`Line and column`});var u=i(l,4);d(u,{lang:`ts`,get content(){return C}});var f=i(u,4),m=s(f),h=s(m);d(h,{lang:`ts`,dangerous_raw_html:`<span class="token_punctuation">{</span>locations<span class="token_operator">:</span> <span class="token_boolean">true</span><span class="token_punctuation">}</span>`,inline:!0}),c(9),n(m);var g=i(m,2),_=i(s(g),8);d(_,{lang:`ts`,dangerous_raw_html:`locations<span class="token_operator">:</span> <span class="token_boolean">true</span>`,inline:!0}),c(5),n(g);var v=i(g,2),y=s(v);d(y,{lang:`ts`,dangerous_raw_html:`<span class="token_function">reconstruct_locations</span><span class="token_punctuation">(</span>ast<span class="token_punctuation">,</span> source<span class="token_punctuation">)</span>`,inline:!0}),c(),n(v);var b=i(v,2),x=i(s(b));d(x,{lang:`ts`,dangerous_raw_html:`<span class="token_function">create_locator</span><span class="token_punctuation">(</span>source<span class="token_punctuation">,</span> <span class="token_punctuation">{</span>language<span class="token_punctuation">})</span>`,inline:!0}),c(5),n(b);var S=i(b,4),w=i(s(S));d(w,{lang:`sh`,content:`tsv parse --locations`,inline:!0}),c(),n(S),n(f),t(e,a)},$$slots:{default:!0}});var z=i(R,2);f(z,{children:(e,n)=>{var r=k(),i=o(r);p(i,{text:`Source code`}),c(2),t(e,r)},$$slots:{default:!0}}),n(a),t(e,a)},$$slots:{default:!0}}),a()}export{j as t};
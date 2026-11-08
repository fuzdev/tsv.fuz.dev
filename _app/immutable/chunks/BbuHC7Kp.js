import{F as e,N as t,_t as n,et as r,ft as i,pt as a,rt as o,tt as s,vt as c}from"./CcCt9sBg.js";import{n as l}from"./CRoEIyQu.js";import{n as u}from"./MOxfhW-Z.js";import{t as d}from"./BKuse8TM.js";import{i as f,t as p}from"./DoLmIRyS.js";import{t as m}from"./BvBR_YQH.js";import{n as h,t as g}from"./xui8qSUr.js";var _=`import { format_svelte, parse_svelte, strip_typescript, type Root } from '@fuzdev/tsv';

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
				API maps to the crates.</p> <p>tsv also ships as wasm, which runs everywhere including browsers and Deno, and provides the
				same <code>tsv</code> command:</p> <!> <p>Both packages claim the <code>tsv</code> bin name. (TBD if the wasm package needs a
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
				initialization; the wasm packages work zero-config in Node.js, Bun, and Deno (sync
				auto-init); in browsers and bundlers, call <!> once first. To run a wasm package across worker threads without recompiling, hand its
				exported <code>wasm_module</code> to each worker, which imports the <code>/worker</code> subpath and calls <!>;
				the <a href="https://www.npmjs.com/package/@fuzdev/tsv-format-wasm"><code>@fuzdev/tsv-format-wasm</code> readme</a> shows the pattern.</p> <p><code>IgnoreStack</code>, exported by <code>@fuzdev/tsv</code> and the format-capable wasm
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
			that prioritizes quality.</p> <p>These docs are a work in progress. There are more design details in the <a href="https://github.com/fuzdev/tsv#design">readme</a>.</p> <!> <!> <!> <!> <!> <!></section>`);function j(e,j){a(j,!0);let M=u(`introduction`);p(e,{get tome(){return M},children:(e,i)=>{var a=A(),u=r(a);d(u,{get data(){return l},size:`var(--icon_size_xl2)`,class:`float:right ml_lg mb_lg`});var p=o(u,16),j=o(r(p));f(j,{slug:`benchmarks`}),n(),c(p);var M=o(p,2),N=o(r(M));f(N,{slug:`conformance`}),n(5),c(M);var P=o(M,6);h(P,{children:(e,i)=>{var a=w(),l=s(a);g(l,{text:`Install`});var u=o(l,8);m(u,{lang:`sh`,content:`npm i -D @fuzdev/tsv
npx tsv format src
npx tsv format --check src
npx tsv parse src/foo.svelte
npx tsv strip src/foo.ts`});var d=o(u,14);m(d,{lang:`sh`,content:`npm i -D @fuzdev/tsv-wasm
npx tsv format src`});var p=o(d,6);m(p,{lang:`sh`,content:`npm i -D @fuzdev/tsv-format-wasm
npm i -D @fuzdev/tsv-parse-wasm`});var h=o(p,4),_=o(r(h));f(_,{slug:`benchmarks`}),n(),c(h),t(e,a)},$$slots:{default:!0}});var F=o(P,2);h(F,{children:(e,i)=>{var a=T(),l=s(a);g(l,{text:`Usage`});var u=o(l,4);m(u,{lang:`ts`,get content(){return _}});var d=o(u,4);m(d,{lang:`ts`,get content(){return v}});var f=o(d,4);m(f,{lang:`ts`,get content(){return y}});var p=o(f,2),h=o(r(p),8);m(h,{lang:`ts`,dangerous_raw_html:`<span class="token_punctuation">{</span>ok<span class="token_operator">:</span> <span class="token_boolean">true</span><span class="token_punctuation">,</span> code<span class="token_punctuation">}</span>`,inline:!0});var x=o(h,2);m(x,{lang:`ts`,dangerous_raw_html:`<span class="token_punctuation">{</span>ok<span class="token_operator">:</span> <span class="token_boolean">true</span><span class="token_punctuation">,</span> ast<span class="token_punctuation">}</span>`,inline:!0}),n(),c(p);var S=o(p,2),C=o(r(S),5);m(C,{lang:`ts`,dangerous_raw_html:`<span class="token_punctuation">{</span>ok<span class="token_operator">:</span> <span class="token_boolean">true</span><span class="token_punctuation">,</span> json<span class="token_punctuation">}</span>`,inline:!0}),n(5),c(S);var w=o(S,2),E=o(r(w));m(E,{lang:`ts`,dangerous_raw_html:`<span class="token_punctuation">{</span>locations<span class="token_operator">:</span> <span class="token_boolean">true</span><span class="token_punctuation">}</span>`,inline:!0});var D=o(E,2);m(D,{lang:`ts`,dangerous_raw_html:`<span class="token_punctuation">{</span>sourceType<span class="token_operator">:</span> <span class="token_string">'script'</span> <span class="token_operator">|</span> <span class="token_string">'module'</span><span class="token_punctuation">}</span>`,inline:!0});var O=o(D,2);m(O,{lang:`ts`,dangerous_raw_html:`<span class="token_string">'module'</span>`,inline:!0}),n(9),c(w);var k=o(w,2),A=o(r(k));m(A,{lang:`ts`,dangerous_raw_html:`sources<span class="token_punctuation">.</span><span class="token_function">map</span><span class="token_punctuation">((</span>s<span class="token_punctuation">)</span> <span class="token_operator">=></span> <span class="token_function">format_typescript</span><span class="token_punctuation">(</span>s<span class="token_punctuation">))</span>`,inline:!0});var j=o(A,2);m(j,{lang:`ts`,dangerous_raw_html:`sources<span class="token_punctuation">.</span><span class="token_function">map</span><span class="token_punctuation">(</span>format_typescript<span class="token_punctuation">)</span>`,inline:!0}),n(),c(k);var M=o(k,2),N=o(r(M));m(N,{lang:`ts`,dangerous_raw_html:`<span class="token_punctuation">{</span>ok<span class="token_operator">:</span> <span class="token_boolean">false</span><span class="token_punctuation">,</span> error<span class="token_punctuation">}</span>`,inline:!0}),n(15),c(M);var P=o(M,2);m(P,{lang:`ts`,get content(){return b}});var F=o(P,2),I=o(r(F),5);m(I,{lang:`ts`,dangerous_raw_html:`kind<span class="token_operator">:</span> <span class="token_string">'unsupported'</span>`,inline:!0});var L=o(I,2);m(L,{lang:`ts`,dangerous_raw_html:`kind<span class="token_operator">:</span> <span class="token_string">'refused'</span>`,inline:!0}),n(5),c(F);var R=o(F,2),z=o(r(R),3);m(z,{lang:`ts`,dangerous_raw_html:`<span class="token_function">reinstantiate</span><span class="token_punctuation">()</span>`,inline:!0}),n(),c(R);var B=o(R,2),V=o(r(B));m(V,{lang:`ts`,dangerous_raw_html:`<span class="token_special_keyword">await</span> <span class="token_special_keyword">import</span><span class="token_punctuation">(</span><span class="token_string">'@fuzdev/tsv'</span><span class="token_punctuation">)</span>`,inline:!0});var H=o(V,2);m(H,{lang:`ts`,dangerous_raw_html:`<span class="token_special_keyword">await</span> <span class="token_function">init</span><span class="token_punctuation">()</span>`,inline:!0});var U=o(H,6);m(U,{lang:`ts`,dangerous_raw_html:`<span class="token_function">init_sync</span><span class="token_punctuation">({</span>module<span class="token_operator">:</span> wasm_module<span class="token_punctuation">})</span>`,inline:!0}),n(3),c(B),n(2),t(e,a)},$$slots:{default:!0}});var I=o(F,2);h(I,{children:(e,i)=>{var a=E(),l=s(a);g(l,{text:`Type stripping`});var u=o(l,2),d=o(r(u),8);m(d,{lang:`ts`,dangerous_raw_html:`kind<span class="token_operator">:</span> <span class="token_string">'unsupported'</span>`,inline:!0}),n(3),c(u);var f=o(u,2);m(f,{lang:`ts`,get content(){return x}}),n(2),t(e,a)},$$slots:{default:!0}});var L=o(I,2);h(L,{children:(e,i)=>{var a=D(),l=s(a);g(l,{text:`Import records`});var u=o(l,4);m(u,{lang:`ts`,get content(){return S}});var d=o(u,2),f=o(r(d),21);m(f,{lang:`ts`,dangerous_raw_html:`<span class="token_punctuation">{</span>ok<span class="token_operator">:</span> <span class="token_boolean">false</span><span class="token_punctuation">,</span> error<span class="token_punctuation">}</span>`,inline:!0}),n(3),c(d),t(e,a)},$$slots:{default:!0}});var R=o(L,2);h(R,{children:(e,i)=>{var a=O(),l=s(a);g(l,{text:`Line and column`});var u=o(l,4);m(u,{lang:`ts`,get content(){return C}});var d=o(u,4),f=r(d),p=r(f);m(p,{lang:`ts`,dangerous_raw_html:`<span class="token_punctuation">{</span>locations<span class="token_operator">:</span> <span class="token_boolean">true</span><span class="token_punctuation">}</span>`,inline:!0}),n(9),c(f);var h=o(f,2),_=o(r(h),8);m(_,{lang:`ts`,dangerous_raw_html:`locations<span class="token_operator">:</span> <span class="token_boolean">true</span>`,inline:!0}),n(5),c(h);var v=o(h,2),y=r(v);m(y,{lang:`ts`,dangerous_raw_html:`<span class="token_function">reconstruct_locations</span><span class="token_punctuation">(</span>ast<span class="token_punctuation">,</span> source<span class="token_punctuation">)</span>`,inline:!0}),n(),c(v);var b=o(v,2),x=o(r(b));m(x,{lang:`ts`,dangerous_raw_html:`<span class="token_function">create_locator</span><span class="token_punctuation">(</span>source<span class="token_punctuation">,</span> <span class="token_punctuation">{</span>language<span class="token_punctuation">})</span>`,inline:!0}),n(5),c(b);var S=o(b,4),w=o(r(S));m(w,{lang:`sh`,content:`tsv parse --locations`,inline:!0}),n(),c(S),c(d),t(e,a)},$$slots:{default:!0}});var z=o(R,2);h(z,{children:(e,r)=>{var i=k(),a=s(i);g(a,{text:`Source code`}),n(2),t(e,i)},$$slots:{default:!0}}),c(a),t(e,a)},$$slots:{default:!0}}),i()}export{j as t};
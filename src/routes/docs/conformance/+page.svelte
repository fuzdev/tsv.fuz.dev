<script lang="ts">
	// the table classes the benchmarks components share
	import '../benchmarks/benchmarks.css';

	import TomeContent from '@fuzdev/fuz_ui/TomeContent.svelte';
	import TomeLink from '@fuzdev/fuz_ui/TomeLink.svelte';
	import { tome_get_by_slug } from '@fuzdev/fuz_ui/tome.ts';

	import { corpus_source_url } from '../benchmarks/benchmark_data.ts';
	import {
		format_corpus_source_files,
		format_count_maybe,
		format_share_approx
	} from '../benchmarks/benchmark_display.ts';
	import { conformance_json } from './conformance.ts';
	import {
		CONFORMANCE_SOURCE_PATHS,
		derive_conformance_groups,
		derive_conformance_slice
	} from './conformance_data.ts';
	import BenchmarksMeta from '../benchmarks/BenchmarksMeta.svelte';
	import ConformanceTable from './ConformanceTable.svelte';

	const LIBRARY_ITEM_NAME = 'conformance';

	const tome = tome_get_by_slug(LIBRARY_ITEM_NAME);

	const conformance_groups = derive_conformance_groups(conformance_json);
	// the `tsc` row runs on the conformance surface alone, so its version is
	// disclosed beside its note rather than in the perf report's meta panel (a
	// plain string, so the leading space survives Svelte's block-edge trimming)
	const tsc_version = conformance_json.versions.tsc;
	const tsc_label = tsc_version ? ` (typescript ${tsc_version})` : '';
	// The TypeScript conformance aggregate read by slice: the two validity-filtered
	// slices each selected by one parser here, and Prettier's own JS fixture suite,
	// the largest slice neither scoped, with each engine's count on it.
	const ts_slice = (path: string) =>
		derive_conformance_slice(conformance_json, 'parse/typescript', path);
	const ts_test262 = ts_slice(CONFORMANCE_SOURCE_PATHS.test262);
	const ts_repo = ts_slice(CONFORMANCE_SOURCE_PATHS.ts_repo);
	const ts_prettier_js = ts_slice(CONFORMANCE_SOURCE_PATHS.prettier_js);
	const prettier_js_accepted = (engine: string): string =>
		format_count_maybe(ts_prettier_js?.rows[engine]?.processed);
	// Prettier's HTML fixtures' share of the Svelte conformance corpus, read off the
	// report so the aside can't outlive a re-harvest.
	const svelte_prettier_html = derive_conformance_slice(
		conformance_json,
		'parse/svelte',
		CONFORMANCE_SOURCE_PATHS.prettier_html
	);
</script>

<TomeContent {tome}>
	<section>
		<p>
			Where the <TomeLink slug="benchmarks" /> time real-world code, this page measures parse
			<em>coverage</em>: how much of a much larger, deliberately hard corpus each parser accepts —
			Prettier's and prettier-plugin-svelte's format-test suites (Prettier's HTML fixtures ride
			along in the Svelte set as plain HTML
			documents{svelte_prettier_html
				? `, ~${format_share_approx(svelte_prettier_html.share)} of it`
				: ''}), Svelte's compiler test suite, CSS extracted from
			<a href="https://github.com/web-platform-tests/wpt">web-platform-tests</a>,
			<a href="https://github.com/tc39/test262">test262</a>'s expected-valid tests parsed at the
			goal each declares (every other file is parsed as a module), and the single-file cases from
			the <a href="https://github.com/microsoft/TypeScript">TypeScript compiler</a>'s own test suite
			that tsc's parser accepts and whose recorded baselines carry no syntax error. JSX is out by
			construction — Prettier's JSX fixtures and the compiler's <code>.tsx</code> cases are dropped,
			since tsv rejects JSX by design where oxc-parser, yuku-parser, swc, and tsc can parse it — so
			this table says nothing about that gap.
		</p>
		<ConformanceTable groups={conformance_groups} />
		<aside>
			<p>Notes:</p>
			<ul>
				<li>
					Coverage is per engine, not per binding, so each tool appears once. That is exact for tsv,
					whose native and wasm rows the bench holds to byte-identical output (bar one
					pathologically deep TypeScript file the check can't digest, which the report discloses).
					The other tools' bindings are only expected to agree, and oxc-parser's don't quite: its
					wasm binding is pinned to an older release (see the benchmarks' parse notes) and accepts a
					couple of files the native one doesn't; the native row stands.
				</li>
				<li>
					The yuku-parser row is its wasm binding: the native one segfaults on some of test262's
					escaped-identifier tests. Wasm runs the same parser with the fault contained, so the
					number stands.
				</li>
				<li>
					For Svelte the corpus excludes the files svelte/compiler itself rejects, so its number is
					100% by construction and the rest read as drop-in fidelity against it. For TypeScript and
					CSS the canonical parser is no clean validity oracle
					(<a href="https://github.com/sveltejs/acorn-typescript">acorn-typescript</a> trails modern
					syntax; Svelte's CSS parser errs in both directions), so Prettier's fixtures and the CSS
					suites keep intentionally-invalid and out-of-scope inputs (wpt's deliberately-invalid CSS,
					preprocessor syntax in Prettier's <code>.css</code> fixtures) — read those relative to
					each other, not as an absolute target. The two large TypeScript slices, test262 and the
					TypeScript compiler's, are validity-filtered and get their own note below.
				</li>
				<li>
					The CSS spread is a grammar difference, not a verdict. The reference row is Svelte's
					<code>parseCss</code>, which tsv is a drop-in for. PostCSS rejects a handful of files
					<code>parseCss</code> accepts and accepts more that it rejects — modern CSS Svelte's
					parser doesn't implement yet, and the preprocessor syntax and malformed rules in
					Prettier's <code>.css</code> fixtures, which PostCSS parses structurally because it keeps
					selectors and at-rule preludes as unparsed strings. So PostCSS landing a shade above tsv
					in the aggregate is two grammars, not a gap. tsv, too, lands a little above
					<code>parseCss</code>, nearly all of it on wpt files.
				</li>
				<li>
					Read the TypeScript aggregate by slice: ~{format_share_approx(ts_test262?.share)} of it is
					the test262 slice and ~{format_share_approx(ts_repo?.share)} the TypeScript compiler's, so
					the column is mostly two validity-filtered slices, one selected by tsv and one by tsc. On
					Prettier's own JS fixture suite ({format_count_maybe(ts_prettier_js?.total)} files), the
					largest slice neither of them scoped, tsv accepts {prettier_js_accepted('tsv')},
					oxc-parser {prettier_js_accepted('oxc-parser')}, yuku-parser
					{prettier_js_accepted('yuku-parser')}, and tsc {prettier_js_accepted('tsc')}.
				</li>
				<li>
					Two rows read 100% on a slice they selected themselves. The <code>tsc</code> row is the
					TypeScript compiler's own parser{tsc_label}, here as a verdict, not a speed: it chose the
					TypeScript-compiler slice (its conformance and compiler cases, keeping only those it
					parses cleanly), and elsewhere rejects a share of Prettier's TypeScript/JS suites and a
					small tail of test262, so it doesn't read 100% overall. The test262 slice is tsv's: the
					cache keeps the expected-valid subset of the tests tsv's runner grades, dropping what's
					outside tsv's scope before the split — every Annex B <code>noStrict</code> positive among
					them, a web-compatibility grammar tsv declines as a non-browser host — and tsv's repo
					gates on passing all of it. Another parser's number there is its rate on tsv's slice, not
					on test262.
				</li>
				<li>
					Accepting a file says nothing about producing the <em>right</em> AST — tsv's output is
					separately verified against the canonical parsers (svelte/compiler and its
					<code>parseCss</code>, acorn-typescript) at corpus scale in
					<a href="https://github.com/fuzdev/tsv">its repo's conformance gates</a>. Nor does
					coverage reward rejecting what should be rejected: it counts acceptance only, so a
					permissive parser scores well here. tsv defers most early errors — of test262's
					should-reject parse tests it currently rejects fewer than half, tracked in
					<a href="https://github.com/fuzdev/tsv/blob/main/docs/conformance_test262.md">
						its test262 notes
					</a>.
				</li>
			</ul>
			{#if conformance_json.corpus_sources.length}
				<p>
					Corpus sources ({conformance_json.corpus_sources.length}) — a source the report pins links
					to its measured commit; a harvested upstream cache links to the repo root:
				</p>
				<ul>
					{#each conformance_json.corpus_sources as source (source.path)}
						{@const url = corpus_source_url(source)}
						<li>
							{#if url}
								<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
								<a href={url} rel="external"><code>{source.path}</code></a>
							{:else}
								<code>{source.path}</code>
							{/if}
							— {format_corpus_source_files(source)}
						</li>
					{/each}
				</ul>
			{/if}
		</aside>
		<BenchmarksMeta baseline={conformance_json} />
	</section>
</TomeContent>

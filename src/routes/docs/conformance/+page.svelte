<script lang="ts">
	// the table classes the benchmarks components share
	import '../benchmarks/benchmarks.css';

	import { page } from '$app/state';
	import TomeContent from '@fuzdev/fuz_ui/TomeContent.svelte';
	import TomeLink from '@fuzdev/fuz_ui/TomeLink.svelte';
	import TomeSection from '@fuzdev/fuz_ui/TomeSection.svelte';
	import TomeSectionHeader from '@fuzdev/fuz_ui/TomeSectionHeader.svelte';
	import { DOCS_PATH, docs_slugify } from '@fuzdev/fuz_ui/docs_helpers.svelte.ts';
	import { tome_get_by_slug } from '@fuzdev/fuz_ui/tome.ts';

	import { conformance_json } from './conformance.ts';
	import {
		CONFORMANCE_SOURCE_LABELS,
		CONFORMANCE_VERSION_KEYS,
		derive_conformance_matrices
	} from './conformance_data.ts';
	import { derive_corpus_source_table } from '../benchmarks/benchmark_data.ts';
	import { format_count } from '../benchmarks/benchmark_display.ts';
	import BenchmarksCorpus from '../benchmarks/BenchmarksCorpus.svelte';
	import BenchmarksMeta from '../benchmarks/BenchmarksMeta.svelte';
	import ConformanceTable from './ConformanceTable.svelte';

	const LIBRARY_ITEM_NAME = 'conformance';

	const tome = tome_get_by_slug(LIBRARY_ITEM_NAME);

	// the `/docs` index renders every tome, so there this one is a link, as the playground's is
	const at_root = $derived(page.url.pathname === DOCS_PATH);

	// slugified the same way `TomeSectionHeader` builds its id, so a rename can't
	// orphan the links to it
	const CORPUS_SECTION_TITLE = 'Test corpus';

	const conformance_matrices = derive_conformance_matrices(conformance_json);
	const corpus_source_table = derive_corpus_source_table(
		conformance_json,
		CONFORMANCE_SOURCE_LABELS
	);
</script>

<TomeContent {tome}>
	{#if at_root}
		<section>
			<p>
				The <TomeLink slug="conformance" /> page compares parser coverage on deliberately hard test
				suites.
			</p>
		</section>
	{:else}
		<section>
			<p>
				Where the <TomeLink slug="benchmarks" /> measure performance on real-world code, this page
				compares one aspect of parser correctness — which files each parser accepts — on a
				deliberately hard <a href="#{docs_slugify(CORPUS_SECTION_TITLE)}">corpus</a>.
			</p>
		</section>

		<TomeSection>
			<TomeSectionHeader text="Coverage" />
			<ConformanceTable matrices={conformance_matrices} />
			<aside class="mb_xl5">
				<p>Notes:</p>
				<ul>
					<li>
						The dimmed <code>−n</code> beside a percentage is the number of files rejected. A dimmed
						<code>100%</code> marks a parser that selected the source, so its 100% is by
						construction: svelte/compiler on the Svelte set and <code>tsc</code> on the TypeScript
						compiler's cases. tsv's 100% on test262 is a result: test262's own metadata picks those
						tests, not any parser's verdict (see
						<a href="#{docs_slugify(CORPUS_SECTION_TITLE)}">{CORPUS_SECTION_TITLE}</a>).
					</li>
					<li>
						Accepting a file says nothing about producing the <em>right</em> AST — tsv's output is
						separately verified against the parsers it's a drop-in for (svelte/compiler, its
						<code>parseCss</code>, and acorn-typescript) at corpus scale in
						<a href="https://github.com/fuzdev/tsv/blob/main/docs/conformance_svelte.md">
							its repo's conformance gates
						</a>. Nor does coverage reward rejecting what should be rejected, so a permissive parser
						scores well here: tsv doesn't yet check most early errors, rejecting fewer than half of
						test262's should-reject parse tests, tracked in
						<a href="https://github.com/fuzdev/tsv/blob/main/docs/conformance_test262.md">
							its test262 notes
						</a>.
					</li>
					<li>
						No CSS parser here is a validity oracle, so the CSS sources keep invalid and
						out-of-scope inputs (wpt's deliberately invalid CSS, the preprocessor syntax in
						Prettier's <code>.css</code> fixtures): read a row's parsers against each other, not
						against 100%. tsv, a drop-in for Svelte's <code>parseCss</code>, sits above it by also
						parsing spec-valid CSS that <code>parseCss</code> rejects. PostCSS leads by parsing
						less, not because tsv falls short: it keeps selectors as unparsed strings, so it accepts
						preprocessor syntax and modern CSS <code>parseCss</code> doesn't implement yet.
					</li>
					<li>
						oxc-parser's column is its native binding; the wasm one, pinned to an older release (see
						<TomeLink slug="benchmarks" hash={docs_slugify('Parse speed')} />), accepts a couple
						more files. yuku-parser's is its wasm binding, since the native one segfaults on some of
						test262's tests.
					</li>
				</ul>
			</aside>
			<BenchmarksMeta baseline={conformance_json} version_keys={CONFORMANCE_VERSION_KEYS} />
		</TomeSection>

		<TomeSection>
			<TomeSectionHeader text={CORPUS_SECTION_TITLE} />
			<p>
				{format_count(corpus_source_table.totals.files)} files from
				{corpus_source_table.rows.length} sources, none of them the real-world code used in the
				<TomeLink slug="benchmarks" />: formatter, compiler, and conformance test suites. Each links
				its upstream at the commit the harness pinned, except the three harvested into caches —
				test262, web-platform-tests CSS, and the TypeScript compiler's cases — which carry no
				commit.
			</p>
			<ul>
				<li>
					The Svelte set is every <code>.svelte</code> and <code>.html</code> file, less those
					svelte/compiler rejects. The <code>.html</code> files load as Svelte:
					prettier-plugin-svelte's are components, Prettier's HTML fixtures real HTML documents.
				</li>
				<li>
					test262 is its expected-valid tests outside <code>test/staging/</code>, less the
					sloppy-mode tests under <code>test/annexB/</code>: Annex B is the web-browser layer,
					optional for a non-browser host like tsv.
				</li>
				<li>
					The TypeScript compiler's cases are the single-file <code>.ts</code> ones tsc's parser
					accepts and whose recorded baselines carry no grammar error.
				</li>
				<li>
					The web-platform-tests CSS is the <code>&lt;style&gt;</code> blocks of its
					<code>.html</code> pages.
				</li>
				<li>
					From Prettier's suites the harness drops range- and cursor-marker files, front-matter and
					multiparser fixtures, Babel-only proposals, error cases its specs expect every parser to
					reject, and the spec files themselves.
				</li>
				<li>
					JSX is out by construction: Prettier's JSX suite, every <code>.tsx</code> file, and the
					<code>.js</code> fixtures Prettier reads as JSX are dropped, since every parser here runs
					in TypeScript mode and rejects them alike. tsv rejects JSX by design, whereas the other
					TypeScript parsers here parse it, so these tables say nothing about that gap.
				</li>
				<li>
					TS/JS files parse as modules, with two exceptions: test262's parse as script or module, as
					each test's flags declare, and Prettier's <code>.js</code> and <code>.ts</code> fixtures
					retry as scripts when the module parse fails. <code>tsc</code> decides for itself.
				</li>
			</ul>
			<BenchmarksCorpus table={corpus_source_table} />
		</TomeSection>
	{/if}
</TomeContent>

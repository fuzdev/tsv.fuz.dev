<script lang="ts">
	// the table classes the benchmarks components share
	import '../benchmarks/benchmarks.css';

	import TomeContent from '@fuzdev/fuz_ui/TomeContent.svelte';
	import TomeLink from '@fuzdev/fuz_ui/TomeLink.svelte';
	import TomeSection from '@fuzdev/fuz_ui/TomeSection.svelte';
	import TomeSectionHeader from '@fuzdev/fuz_ui/TomeSectionHeader.svelte';
	import { docs_slugify } from '@fuzdev/fuz_ui/docs_helpers.svelte.ts';
	import { tome_get_by_slug } from '@fuzdev/fuz_ui/tome.ts';

	import { conformance_json } from './conformance.ts';
	import { CONFORMANCE_SOURCE_LABELS, derive_conformance_matrices } from './conformance_data.ts';
	import { derive_corpus_source_table } from '../benchmarks/benchmark_data.ts';
	import { format_count } from '../benchmarks/benchmark_display.ts';
	import BenchmarksCorpus from '../benchmarks/BenchmarksCorpus.svelte';
	import BenchmarksMeta from '../benchmarks/BenchmarksMeta.svelte';
	import ConformanceTable from './ConformanceTable.svelte';

	const LIBRARY_ITEM_NAME = 'conformance';

	const tome = tome_get_by_slug(LIBRARY_ITEM_NAME);

	// slugified the same way `TomeSectionHeader` builds its id, so a rename can't
	// orphan the links to it
	const CORPUS_SECTION_TITLE = 'Corpus';

	const conformance_matrices = derive_conformance_matrices(conformance_json);
	const corpus_source_table = derive_corpus_source_table(
		conformance_json,
		CONFORMANCE_SOURCE_LABELS
	);
	// the `tsc` column runs on the conformance surface alone, so its version is
	// disclosed beside its note rather than in the perf report's meta panel (a
	// plain string, so the leading space survives Svelte's block-edge trimming)
	const tsc_version = conformance_json.versions.tsc;
	const tsc_label = tsc_version ? ` (typescript ${tsc_version})` : '';
</script>

<TomeContent {tome}>
	<section>
		<p>
			Where the <TomeLink slug="benchmarks" /> use real-world code to compare performance, this page
			shows parser coverage using a deliberately hard
			<a href="#{docs_slugify(CORPUS_SECTION_TITLE)}">corpus</a> to compare one aspect of
			correctness:
		</p>
		<ConformanceTable matrices={conformance_matrices} />
		<aside class="mb_xl5">
			<p>Notes:</p>
			<ul>
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
				<li>
					A dimmed count beside a percentage is the files rejected. A greyed <code>100%</code> marks
					the parser that chose a source, so reads 100% on it by construction: svelte/compiler on
					the Svelte set (the files it rejects are excluded, so the others read as drop-in fidelity
					against it) and <code>tsc</code>{tsc_label} on its compiler's cases. tsv's 100% on test262
					is a result, not a selection (see
					<a href="#{docs_slugify(CORPUS_SECTION_TITLE)}">Corpus</a>).
				</li>
				<li>
					The CSS sources keep intentionally-invalid and out-of-scope inputs (wpt's
					deliberately-invalid CSS, preprocessor syntax in Prettier's <code>.css</code> fixtures),
					since no CSS parser here is a validity oracle, so read a row's parsers against each other,
					not against 100%.
				</li>
				<li>
					PostCSS sitting above tsv is two grammars, not a gap. The CSS reference is Svelte's
					<code>parseCss</code>, which tsv is a drop-in for and no validity oracle in either
					direction; PostCSS keeps selectors and at-rule preludes as unparsed strings, so it accepts
					preprocessor syntax, malformed rules, and modern CSS <code>parseCss</code> doesn't
					implement yet.
				</li>
				<li>
					oxc-parser's wasm binding is pinned to an older release (see the benchmarks' parse notes)
					and accepts a couple of files the native one doesn't; the native column stands.
					yuku-parser's is its wasm binding, since the native one segfaults on some of test262's
					tests.
				</li>
			</ul>
		</aside>
		<BenchmarksMeta baseline={conformance_json} />
	</section>

	<TomeSection>
		<TomeSectionHeader text={CORPUS_SECTION_TITLE} />
		<p>
			{format_count(corpus_source_table.totals.files)} files from {corpus_source_table.rows.length}
			sources, none of them the real-world code used in the <TomeLink slug="benchmarks" />: includes
			formatter and compiler test suites, read from pinned checkouts, and three conformance suites
			the harness harvests into caches.
		</p>
		<ul>
			<li>
				The Svelte set is the <code>.svelte</code> files plus the <code>.html</code> ones, which
				load as Svelte — prettier-plugin-svelte's samples are components under that extension,
				Prettier's HTML fixtures real HTML documents — less the files svelte/compiler rejects.
			</li>
			<li>
				test262 is its expected-valid tests, as far as tsv's runner grades them: the cache drops
				those outside tsv's scope — every Annex B <code>noStrict</code> positive among them, a
				web-compatibility grammar tsv declines as a non-browser host.
			</li>
			<li>
				The TypeScript compiler's cases are the single-file ones tsc's parser accepts and whose
				recorded baselines carry no syntax error.
			</li>
			<li>
				The web-platform-tests CSS is extracted from its tests' <code>&lt;style&gt;</code> blocks.
			</li>
			<li>
				Prettier's suites are what Prettier's own specs expect a parser of the language to accept.
				Dropped: range- and cursor-marker files, front-matter fixtures, Babel-only proposals,
				deliberate error cases a directory's spec marks as rejected by every parser it verifies
				against, and the spec files themselves, which Prettier never runs as fixtures.
			</li>
			<li>
				JSX is out by construction: Prettier's JSX suite and the compiler's <code>.tsx</code> cases
				are dropped, and so are the <code>.js</code> fixtures Prettier's own parser reads as JSX,
				since every parser here runs in TypeScript mode and rejects them alike. tsv rejects JSX by
				design where oxc-parser, yuku-parser, swc, and tsc can parse it, so these tables say nothing
				about that gap.
			</li>
			<li>
				Every TS/JS file is parsed as a module, except test262's, parsed at the goal each test
				declares, and Prettier's JS and TypeScript fixtures, retried as a script when the module
				parse fails, as Prettier's own parsers retry; <code>tsc</code> alone infers the goal itself.
			</li>
		</ul>
		<p>
			Files count under the language their extension names. The harvested suites link their upstream
			unpinned.
		</p>
		<BenchmarksCorpus table={corpus_source_table} />
	</TomeSection>
</TomeContent>

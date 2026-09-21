<script lang="ts">
	// the table classes the benchmarks components share
	import '../benchmarks/benchmarks.css';

	import TomeContent from '@fuzdev/fuz_ui/TomeContent.svelte';
	import TomeLink from '@fuzdev/fuz_ui/TomeLink.svelte';
	import { tome_get_by_slug } from '@fuzdev/fuz_ui/tome.ts';

	import { conformance_json } from './conformance.ts';
	import { derive_conformance_matrices } from './conformance_data.ts';
	import BenchmarksMeta from '../benchmarks/BenchmarksMeta.svelte';
	import ConformanceTable from './ConformanceTable.svelte';

	const LIBRARY_ITEM_NAME = 'conformance';

	const tome = tome_get_by_slug(LIBRARY_ITEM_NAME);

	const conformance_matrices = derive_conformance_matrices(conformance_json);
	// the `tsc` column runs on the conformance surface alone, so its version is
	// disclosed beside its note rather than in the perf report's meta panel (a
	// plain string, so the leading space survives Svelte's block-edge trimming)
	const tsc_version = conformance_json.versions.tsc;
	const tsc_label = tsc_version ? ` (typescript ${tsc_version})` : '';
</script>

<TomeContent {tome}>
	<section>
		<p>
			Where the <TomeLink slug="benchmarks" /> time real-world code, this page measures parse
			<em>coverage</em>: how much of a much larger, deliberately hard corpus each parser accepts,
			one row per corpus source, since a single percentage would blend sources that ask different
			questions. The test262 rows are its expected-valid tests, parsed at the goal each declares
			(every other file is parsed as a module); the TypeScript compiler's are the single-file cases
			tsc's parser accepts and whose recorded baselines carry no syntax error; the
			web-platform-tests CSS is extracted from its <code>&lt;style&gt;</code> blocks. JSX is out by
			construction — Prettier's JSX fixtures and the compiler's <code>.tsx</code> cases are dropped,
			since tsv rejects JSX by design where oxc-parser, yuku-parser, swc, and tsc can parse it — so
			these tables say nothing about that gap.
		</p>
		<ConformanceTable matrices={conformance_matrices} />
		<aside>
			<p>Notes:</p>
			<ul>
				<li>
					<em>selected</em> marks the parser that chose a source, so reads 100% on it by
					construction: svelte/compiler on the Svelte set (the files it rejects are excluded, so the
					others read as drop-in fidelity against it), <code>tsc</code>{tsc_label} on its compiler's
					cases, and tsv on test262 — the cache keeps the expected-valid tests tsv's runner grades,
					dropping those outside tsv's scope (every Annex B <code>noStrict</code> positive among
					them, a web-compatibility grammar tsv declines as a non-browser host), so another parser's
					number there is its rate on tsv's slice, not on test262.
				</li>
				<li>
					The other sources keep intentionally-invalid and out-of-scope inputs (wpt's
					deliberately-invalid CSS, preprocessor syntax in Prettier's <code>.css</code> fixtures),
					so read a row's parsers against each other, not against 100%. The dimmed count beside a
					percentage is the files rejected.
				</li>
				<li>
					PostCSS sitting above tsv is two grammars, not a gap. The CSS reference is Svelte's
					<code>parseCss</code>, which tsv is a drop-in for and no validity oracle in either
					direction; PostCSS keeps selectors and at-rule preludes as unparsed strings, so it accepts
					preprocessor syntax, malformed rules, and modern CSS <code>parseCss</code> doesn't
					implement yet.
				</li>
				<li>
					One column per engine, not per binding. That is exact for tsv, whose native and wasm rows
					the bench holds to byte-identical output (bar one pathologically deep TypeScript file the
					check can't digest, which the report discloses). oxc-parser's wasm binding is pinned to an
					older release (see the benchmarks' parse notes) and accepts a couple of files the native
					one doesn't; the native column stands. yuku-parser's is its wasm binding: the native one
					segfaults on some of test262's escaped-identifier tests, and wasm runs the same parser
					with the fault contained.
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
		</aside>
		<BenchmarksMeta baseline={conformance_json} corpus_repos={false} />
	</section>
</TomeContent>

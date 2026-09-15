import { assert, describe, test } from 'vitest';

import { benchmarks_json } from '$routes/docs/benchmarks/benchmarks.ts';
import {
	categorize_size_capability,
	compute_baseline_ratio,
	derive_corpus_repos,
	derive_cross_runtime_groups,
	derive_unavailable_by_runtime,
	is_impl_unavailable,
	format_speedup_signed,
	order_cross_runtime_runtimes,
	OXC_FULL_LABEL,
	type CrossRuntimeReport
} from '$routes/docs/benchmarks/benchmark_data.ts';

describe('derive_corpus_repos', () => {
	test('maps the committed corpus sources to deduped org/name repo links', () => {
		const repos = derive_corpus_repos(benchmarks_json.corpus_sources);
		assert.isNotEmpty(repos);
		// one entry per URL — no repo appears twice even though svelte.dev contributes
		// several source subpaths
		const urls = repos.map((r) => r.url);
		assert.strictEqual(new Set(urls).size, urls.length, 'urls are distinct');
		const svelte_dev = repos.filter((r) => r.url === 'https://github.com/sveltejs/svelte.dev');
		assert.strictEqual(svelte_dev.length, 1, 'svelte.dev collapses to one entry');
		// each label is the linkified `org/name`, derived from (and ending) its URL
		for (const repo of repos) {
			assert.match(repo.label, /^[^/]+\/[^/]+$/, repo.url);
			assert.isTrue(repo.url.endsWith(repo.label), `${repo.url} ends with ${repo.label}`);
		}
	});

	test('collapses shared repos and drops sources with no detected repo', () => {
		const ref = (slug: string, subpath: string) => ({
			url: `https://github.com/${slug}`,
			slug,
			commit: '0123456789abcdef0123456789abcdef01234567',
			subpath
		});
		const repos = derive_corpus_repos([
			{
				path: '../corpora/collections/zzz/src',
				files: 1,
				repo: ref('fuzdev/zzz', 'src')
			},
			{
				path: '../corpora/collections/svelte.dev/apps/svelte.dev/src',
				files: 1,
				repo: ref('sveltejs/svelte.dev', 'apps/svelte.dev/src')
			},
			{
				path: '../corpora/collections/svelte.dev/packages/repl/src',
				files: 1,
				repo: ref('sveltejs/svelte.dev', 'packages/repl/src') // same repo → collapsed
			},
			{ path: 'benches/js/.cache/svelte_styles', files: 1 } // no detected repo → dropped
		]);
		assert.deepStrictEqual(repos, [
			{ url: 'https://github.com/fuzdev/zzz', label: 'fuzdev/zzz' },
			{
				url: 'https://github.com/sveltejs/svelte.dev',
				label: 'sveltejs/svelte.dev'
			}
		]);
	});

	test('handles a missing corpus_sources field', () => {
		assert.deepStrictEqual(derive_corpus_repos(undefined), []);
	});
});

describe('format_speedup_signed', () => {
	test('anchor-and-faster entries read as a plain multiple', () => {
		assert.strictEqual(format_speedup_signed(1), '1.00x');
		assert.strictEqual(format_speedup_signed(2.5), '2.50x');
		assert.strictEqual(format_speedup_signed(12.3), '12.3x'); // >= 10 drops to one decimal
	});

	test('slower entries negate the reciprocal so the factor is directly legible', () => {
		assert.strictEqual(format_speedup_signed(0.15), '-6.67x');
		assert.strictEqual(format_speedup_signed(0.05), '-20.0x'); // >= 10 magnitude → one decimal
		assert.strictEqual(format_speedup_signed(0.98), '-1.02x'); // near-parity sign flip
	});
});

describe('compute_baseline_ratio', () => {
	test('speed reads the anchor as the reference — faster entries exceed 1', () => {
		// anchor 100ns; a 50ns entry is 2x faster, a 200ns entry is half the speed
		assert.strictEqual(compute_baseline_ratio('speed', 50, 100), 2);
		assert.strictEqual(compute_baseline_ratio('speed', 200, 100), 0.5);
	});

	test('size reads the anchor as the reference — bigger entries exceed 1', () => {
		// anchor 100 bytes; a 300-byte build is 3x bigger, a 50-byte build is half
		assert.strictEqual(compute_baseline_ratio('size', 300, 100), 3);
		assert.strictEqual(compute_baseline_ratio('size', 50, 100), 0.5);
	});
});

describe('order_cross_runtime_runtimes', () => {
	test('reorders the report storage order to node-first display order', () => {
		assert.deepStrictEqual(order_cross_runtime_runtimes(['deno', 'node', 'bun']), [
			'node',
			'deno',
			'bun'
		]);
	});

	test('anchors on the next runtime in display order when node is absent', () => {
		assert.deepStrictEqual(order_cross_runtime_runtimes(['bun', 'deno']), ['deno', 'bun']);
		assert.deepStrictEqual(order_cross_runtime_runtimes([]), []);
	});
});

// Per-runtime load failures (the composer's `unavailable_by_runtime`, combined
// `version` 9+ — it carried init-line labels under `impls` at 8, which matched no
// row name). Synthetic reports: the committed one predates the field, and the
// point of these is the DISTINCTION the field draws — a runtime that couldn't load
// the impl behind a row versus a report that simply has no such row. Both render
// as `fail`.
describe('derive_unavailable_by_runtime', () => {
	const report = (
		unavailable_by_runtime?: CrossRuntimeReport['unavailable_by_runtime']
	): CrossRuntimeReport => ({
		version: 9,
		kind: 'combined',
		generated: '2026-01-01T00:00:00.000Z',
		runtimes: ['deno', 'node', 'bun'],
		unavailable_by_runtime,
		sources: [],
		rows: []
	});

	test('lists each runtime in the site column order, not the report storage order', () => {
		// the report stores deno-first; the tables read node-first, and a disclosure
		// listing runtimes in a different order than the columns invites misreading
		const derived = derive_unavailable_by_runtime(
			report([
				{ runtime: 'bun', rows: ['biome-wasm', 'oxc-parser-wasm'] },
				{ runtime: 'node', rows: ['biome-wasm'] }
			])
		);
		assert.deepStrictEqual(
			derived.map((entry) => entry.runtime),
			['node', 'bun']
		);
	});

	test('an empty row list is not a disclosure', () => {
		assert.isEmpty(derive_unavailable_by_runtime(report([{ runtime: 'bun', rows: [] }])));
	});

	test('a report predating the field discloses nothing — silence, not an all-clear', () => {
		assert.isEmpty(derive_unavailable_by_runtime(report(undefined)));
	});

	test('is_impl_unavailable answers per runtime, and never guesses on an older report', () => {
		// keyed by ROW name (`biome-wasm`), which is what the tables render — the
		// bench's init label (`Biome`) would match no cell
		const recorded = report([{ runtime: 'bun', rows: ['biome-wasm'] }]);
		assert.isTrue(is_impl_unavailable(recorded, 'bun', 'biome-wasm'));
		assert.isFalse(is_impl_unavailable(recorded, 'node', 'biome-wasm'));
		assert.isFalse(is_impl_unavailable(recorded, 'bun', 'oxfmt'));
		// absent field → every cell reads as "not measured here", which is the only
		// claim the data supports
		assert.isFalse(is_impl_unavailable(report(undefined), 'bun', 'biome-wasm'));
	});
});

// Binary-size capability grouping. The heuristic reads the tool's NAME, so the
// tools not named after their job are the ones that can silently land under a
// heading that misdescribes them (a formatter filed as "parse + format").
describe('categorize_size_capability', () => {
	test('reads the job out of a label that names it', () => {
		assert.strictEqual(categorize_size_capability('tsv parse (ffi)'), 'parser');
		assert.strictEqual(categorize_size_capability('tsv_format_wasm'), 'formatter');
		assert.strictEqual(categorize_size_capability('oxfmt (napi)'), 'formatter');
		assert.strictEqual(categorize_size_capability(OXC_FULL_LABEL), 'full');
		assert.strictEqual(categorize_size_capability('tsv (napi)'), 'full');
	});

	test('the tools whose names say nothing are stated, not guessed', () => {
		// each of these would otherwise fall through to `full` — a "parse + format"
		// heading over four builds, two shipping only a formatter and two no formatter
		assert.strictEqual(categorize_size_capability('dprint (wasm)'), 'formatter');
		assert.strictEqual(categorize_size_capability('malva (wasm)'), 'formatter');
		assert.strictEqual(categorize_size_capability('swc (napi)'), 'parser');
		assert.strictEqual(categorize_size_capability('rsvelte compiler (napi)'), 'parser');
	});

	test('the two dprint plugins share a bucket', () => {
		// `dprint (wasm)` and `malva (wasm)` are the same kind of artifact — plugins
		// over the one @dprint/formatter host, neither exposing a parser — so they
		// must never be filed apart. Only `malva` reads as a formatter to a human
		// eye, which is exactly how `dprint` sat under "parse + format" alone.
		assert.strictEqual(
			categorize_size_capability('dprint (wasm)'),
			categorize_size_capability('malva (wasm)')
		);
	});
});

// The per-row file-set-mismatch annotation (the site rendering of the composer's
// `⚠ files a/b/c`), on a synthetic report since the committed one is healthy.
describe('derive_cross_runtime_groups files_iterated_mismatch', () => {
	const report = (
		files_iterated: CrossRuntimeReport['rows'][number]['files_iterated']
	): CrossRuntimeReport => ({
		version: 7,
		kind: 'combined',
		generated: '2026-01-01T00:00:00.000Z',
		runtimes: ['deno', 'node', 'bun'],
		sources: [],
		rows: [
			{
				group: 'parse/typescript',
				name: 'tsv-json',
				ops_per_second: { deno: 1, node: 2, bun: 3 },
				mean_ns: { deno: 3, node: 2, bun: 1 },
				files_iterated
			}
		]
	});

	const derive_row = (files_iterated: CrossRuntimeReport['rows'][number]['files_iterated']) =>
		derive_cross_runtime_groups(report(files_iterated))[0]!.rows[0]!;

	test('equal counts across runtimes derive null', () => {
		assert.isNull(derive_row({ deno: 767, node: 767, bun: 767 }).files_iterated_mismatch);
	});

	test('unequal counts surface the raw per-runtime counts', () => {
		const mismatch = { deno: 765, node: 767, bun: 767 };
		assert.deepStrictEqual(derive_row(mismatch).files_iterated_mismatch, mismatch);
	});

	test('a null count (untimed runtime) is not a mismatch by itself', () => {
		assert.isNull(derive_row({ deno: null, node: 767, bun: 767 }).files_iterated_mismatch);
	});
});

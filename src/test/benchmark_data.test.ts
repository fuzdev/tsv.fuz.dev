import { assert, describe, test } from 'vitest';

import { benchmarks_json } from '$routes/docs/benchmarks/benchmarks.ts';
import {
	derive_corpus_repos,
	derive_unstable_entries,
	format_coverage_percent,
	format_unstable_readings,
	is_entry_unstable,
	parse_group_key,
	type BaselineEntry,
	type BenchmarkBaseline
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

const entry = (overrides: Partial<BaselineEntry>): BaselineEntry => ({
	name: 'x',
	group: 'format/css',
	mean_ns: 1,
	p50_ns: 1,
	p75_ns: 1,
	p90_ns: 1,
	p95_ns: 1,
	p99_ns: 1,
	min_ns: 1,
	max_ns: 1,
	std_dev_ns: 0,
	cv: 0.01,
	ops_per_second: 1,
	sample_size: 100,
	cv_raw: 0.01,
	drift: 0,
	raw_sample_size: 100,
	...overrides
});

describe('is_entry_unstable', () => {
	test('a clean row is stable', () => {
		assert.isFalse(is_entry_unstable(entry({})));
	});

	test('a cleaned cv at the threshold is unstable', () => {
		assert.isTrue(is_entry_unstable(entry({ cv: 0.1 })));
	});

	test('a raw cv past the threshold counts only on a small sample', () => {
		assert.isTrue(is_entry_unstable(entry({ cv_raw: 0.2, raw_sample_size: 29 })));
		assert.isFalse(is_entry_unstable(entry({ cv_raw: 0.2, raw_sample_size: 30 })));
	});

	test('drift counts in either direction', () => {
		assert.isTrue(is_entry_unstable(entry({ drift: -0.05 })));
		assert.isTrue(is_entry_unstable(entry({ drift: 0.07 })));
		assert.isFalse(is_entry_unstable(entry({ drift: -0.049 })));
	});

	test('an untimed row is not unstable, and missing raw fields are silence', () => {
		assert.isFalse(is_entry_unstable(entry({ cv: null, mean_ns: null })));
		assert.isFalse(is_entry_unstable(entry({ cv_raw: null, drift: null, raw_sample_size: null })));
	});
});

describe('derive_unstable_entries', () => {
	const baseline = (entries: Array<BaselineEntry>): BenchmarkBaseline =>
		({ entries }) as unknown as BenchmarkBaseline;

	test('keeps only the unstable rows, worst reading first across cv, raw cv, and |drift|', () => {
		const derived = derive_unstable_entries(
			baseline([
				entry({ name: 'clean' }),
				entry({ name: 'cv', cv: 0.12 }),
				entry({ name: 'drift', drift: -0.3 }),
				entry({ name: 'raw', cv_raw: 0.2, raw_sample_size: 10 })
			])
		);
		assert.deepStrictEqual(
			derived.map((e) => e.name),
			['drift', 'raw', 'cv']
		);
	});
});

describe('format_unstable_readings', () => {
	test('names each reading, signs drift, and omits absent ones', () => {
		assert.strictEqual(
			format_unstable_readings({ cv: 0.478, cv_raw: 0.52, drift: 0.38 }),
			'cv 47.8%, raw cv 52.0%, drift +38.0%'
		);
		assert.strictEqual(
			format_unstable_readings({ cv: 0.1, drift: -0.05 }),
			'cv 10.0%, drift -5.0%'
		);
		assert.strictEqual(format_unstable_readings({ cv: null, cv_raw: null, drift: null }), '');
	});
});

describe('format_coverage_percent', () => {
	test('floors — only exact totality reads 100%', () => {
		// 44219/44220 rounds to 100.00% but must not display as it: floor, so a
		// visibly non-total count never sits beside a "100.00%" label.
		assert.strictEqual(format_coverage_percent(44_219 / 44_220), '99.99%');
		assert.strictEqual(format_coverage_percent(1), '100.00%');
		assert.strictEqual(format_coverage_percent(0.998549), '99.85%');
		assert.strictEqual(format_coverage_percent(0), '0.00%');
	});
});

describe('parse_group_key', () => {
	test('splits an operation/language key', () => {
		assert.deepStrictEqual(parse_group_key('format/svelte'), {
			operation: 'format',
			language: 'svelte'
		});
	});

	test('a key missing its language yields an empty one rather than undefined', () => {
		assert.deepStrictEqual(parse_group_key('format'), { operation: 'format', language: '' });
	});
});

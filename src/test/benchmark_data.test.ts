import { assert, describe, test } from 'vitest';

import { benchmarks_json } from '$routes/docs/benchmarks/benchmarks.ts';
import {
	benchmark_time_share_beyond,
	derive_benchmark_groups,
	derive_corpus_counts,
	derive_corpus_repos,
	derive_sweep_stats,
	derive_unstable_entries,
	format_unstable_readings,
	is_entry_unstable,
	is_payload_matched,
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
		assert.isFalse(is_entry_unstable(entry({ cv: null, mean_ns: null, drift: 0.4 })));
		assert.isFalse(is_entry_unstable(entry({ cv_raw: null, drift: null, raw_sample_size: null })));
	});

	test('a timed row missing only its cleaned cv is still checked by drift and raw cv', () => {
		assert.isTrue(is_entry_unstable(entry({ cv: null, drift: 0.4 })));
		assert.isTrue(is_entry_unstable(entry({ cv: null, cv_raw: 0.5, raw_sample_size: 10 })));
		assert.isFalse(is_entry_unstable(entry({ cv: null })));
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

describe('derive_benchmark_groups omissions', () => {
	const baseline = (omissions: BenchmarkBaseline['omissions']): BenchmarkBaseline => ({
		...benchmarks_json,
		entries: [
			entry({ name: 'prettier', group: 'format/css' }),
			entry({ name: 'biome-wasm', group: 'format/css' })
		],
		omissions
	});
	const css_omissions = {
		group: 'format/css',
		files_total: 55,
		bytes_total: 378_000,
		omitted_files: 1,
		omitted_bytes: 41_125,
		by_tool: [{ name: 'biome-wasm', files: 1, bytes: 41_125, categories: { harvest_artifact: 1 } }]
	};

	test('a group carries the omissions reported under its key', () => {
		const [group] = derive_benchmark_groups(baseline([css_omissions]));
		assert.deepEqual(group?.omissions, css_omissions);
	});

	test('nothing omitted, another group, and an older report all read as null', () => {
		const none = { ...css_omissions, omitted_files: 0, omitted_bytes: 0, by_tool: [] };
		for (const omissions of [[none], [{ ...css_omissions, group: 'parse/css' }], undefined]) {
			const [group] = derive_benchmark_groups(baseline(omissions));
			assert.isNull(group?.omissions);
		}
	});
});

describe('derive_benchmark_groups placeholders state a scope gap only', () => {
	const groups = derive_benchmark_groups({
		...benchmarks_json,
		entries: [
			entry({ name: 'prettier', group: 'format/svelte' }),
			entry({ name: 'dprint-wasm', group: 'format/typescript' }),
			entry({ name: 'svelte/compiler', group: 'parse/svelte' }),
			entry({ name: 'svelte/compiler', group: 'parse/css' }),
			entry({ name: 'oxc-parser', group: 'parse/typescript' }),
			entry({ name: 'yuku-parser', group: 'parse/typescript' })
		]
	});
	const disabled = (operation: string, language: string) =>
		groups
			.find((g) => g.operation === operation && g.language === language)
			?.entries.filter((e) => e.disabled)
			.map((e) => e.name);

	test('a TypeScript-only plugin is not mirrored into the svelte format group', () => {
		assert.deepEqual(disabled('format', 'svelte'), []);
	});

	test('oxc-parser holds a slot in the css parse group, never the svelte one', () => {
		assert.deepEqual(disabled('parse', 'css'), ['biome-wasm', 'oxc-parser']);
		assert.deepEqual(disabled('parse', 'svelte'), ['biome-wasm']);
	});

	test('biome holds one in every parse group', () => {
		assert.deepEqual(disabled('parse', 'typescript'), ['biome-wasm']);
	});
});

describe('to_placeholder via derive_benchmark_groups', () => {
	test('a mirrored row carries nothing its template measured', () => {
		const groups = derive_benchmark_groups({
			...benchmarks_json,
			entries: [
				entry({ name: 'svelte/compiler', group: 'parse/css' }),
				entry({ name: 'oxc-parser', group: 'parse/typescript', mean_ns: 9_000, files_processed: 7 })
			]
		});
		const css = groups.find((g) => g.language === 'css');
		const mirrored = css?.entries.find((e) => e.name === 'oxc-parser');
		assert.deepEqual(mirrored, {
			name: 'oxc-parser',
			category: 'oxc',
			mean_ns: 0,
			bar_fraction: 0,
			files_processed: null,
			files_total: null,
			disabled: true
		});
	});
});

describe('derive_corpus_counts', () => {
	const baseline = (corpus_sources: BenchmarkBaseline['corpus_sources']): BenchmarkBaseline => ({
		...benchmarks_json,
		corpus: { svelte: 10, typescript: 20, css: 5 },
		corpus_sources
	});

	test('the harvest is the CSS of the sources with no upstream repo', () => {
		const counts = derive_corpus_counts(
			baseline([
				{
					path: 'a',
					files: 12,
					repo: { slug: 'fuzdev/a', commit: 'abc' },
					by_language: { css: 2 }
				},
				{ path: '.cache/svelte_styles', files: 3, by_language: { css: 3 } }
			] as BenchmarkBaseline['corpus_sources'])
		);
		assert.deepEqual(counts, { files: 35, harvested_css: 3, standalone_css: 2 });
	});

	test('a report that does not distinguish the harvest quotes no standalone count', () => {
		assert.deepEqual(derive_corpus_counts(baseline(undefined)), {
			files: 35,
			harvested_css: 0,
			standalone_css: undefined
		});
	});
});

describe('derive_sweep_stats', () => {
	test('the reference rows get a floor of their own', () => {
		const stats = derive_sweep_stats({
			...benchmarks_json,
			entries: [
				entry({ name: 'prettier', min_iterations: 16, sample_size: 16 }),
				entry({ name: 'tsv', min_iterations: 8, sample_size: 900 }),
				entry({ name: 'biome-wasm', min_iterations: 8, sample_size: 6 })
			]
		});
		assert.deepEqual(stats, {
			floor: 8,
			canonical_floor: 16,
			sample_size_min: 6,
			sample_size_max: 900
		});
	});

	test('a report without the fields reads as undefined, never Infinity', () => {
		const stats = derive_sweep_stats({
			...benchmarks_json,
			entries: [entry({ sample_size: null })]
		});
		assert.deepEqual(stats, {
			floor: undefined,
			canonical_floor: undefined,
			sample_size_min: undefined,
			sample_size_max: undefined
		});
	});
});

describe('benchmark_time_share_beyond', () => {
	const baseline: BenchmarkBaseline = {
		...benchmarks_json,
		entries: [
			entry({ name: 'tsv-json', group: 'parse/css', mean_ns: 100 }),
			entry({ name: 'tsv-internal', group: 'parse/css', mean_ns: 20 })
		]
	};

	test('is what the whole row spends beyond the part', () => {
		assert.closeTo(
			benchmark_time_share_beyond(baseline, 'parse/css', 'tsv-json', 'tsv-internal')!,
			0.8,
			1e-9
		);
	});

	test('a missing row has no share', () => {
		assert.isUndefined(benchmark_time_share_beyond(baseline, 'parse/css', 'tsv-json', 'nope'));
	});
});

describe('is_payload_matched', () => {
	test('equal tiers match, except own_shape — two dialects are two products', () => {
		assert.isTrue(is_payload_matched({ payload: 'drop_in' }, { payload: 'drop_in' }));
		assert.isTrue(is_payload_matched({ payload: 'span_only' }, { payload: 'span_only' }));
		assert.isFalse(is_payload_matched({ payload: 'drop_in' }, { payload: 'span_only' }));
		assert.isFalse(is_payload_matched({ payload: 'own_shape' }, { payload: 'own_shape' }));
	});

	test('a row with no tier makes the question unanswerable, not false', () => {
		assert.isNull(is_payload_matched({ payload: null }, { payload: 'drop_in' }));
		assert.isNull(is_payload_matched({}, { payload: 'drop_in' }));
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

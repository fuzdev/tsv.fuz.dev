import type {Gen} from '@fuzdev/gro/gen.ts';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';

import {parse_formatter_benchmarks} from './formatter_benchmark_data.ts';

// The formatter comparison harness lives in a sibling checkout and publishes its
// results only as prose — see `formatter_benchmark_data.ts`.
const README_PATH = '../oxc-bench-formatter/README.md';

/**
 * Generate `benchmarks_formatters.json` from the sibling formatter-benchmark
 * harness's README.
 *
 * The sibling checkout is optional: when it's absent or its README carries no
 * parseable results, generation is skipped and the committed JSON stands, so
 * `gro gen --check` passes on a machine that has only this repo.
 */
export const gen: Gen = {
	generate: async ({log}) => {
		const path = resolve(README_PATH);

		let readme;
		try {
			readme = await readFile(path, 'utf8');
		} catch {
			log.info(`skipping formatter benchmarks, no readme at ${path}`);
			return null;
		}

		const benchmarks = parse_formatter_benchmarks(readme);
		if (!benchmarks) {
			log.warn(`skipping formatter benchmarks, no tsv results parsed from ${path}`);
			return null;
		}

		log.info(`parsed ${benchmarks.scenarios.length} tsv scenario(s) from ${path}`);
		return JSON.stringify(benchmarks);
	},
	dependencies: {files: [resolve(README_PATH)]},
};

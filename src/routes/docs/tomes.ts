import type {Tome} from '@fuzdev/fuz_ui/tome.js';
import IntroductionPage from '$routes/docs/introduction/+page.svelte';
import BenchmarksPage from '$routes/docs/benchmarks/+page.svelte';

export const tomes: Array<Tome> = [
	{
		slug: 'introduction',
		category: 'guide',
		Component: IntroductionPage,
		related_tomes: ['benchmarks'],
		related_modules: [],
		related_declarations: [],
	},
	{
		slug: 'benchmarks',
		category: 'guide',
		Component: BenchmarksPage,
		related_tomes: ['introduction'],
		related_modules: [],
		related_declarations: [],
	},
];

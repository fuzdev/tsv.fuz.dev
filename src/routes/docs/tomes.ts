import type {Tome} from '@fuzdev/fuz_ui/tome.js';
import IntroductionPage from '$routes/docs/introduction/+page.svelte';
import PlaygroundPage from '$routes/docs/playground/+page.svelte';
import BenchmarksPage from '$routes/docs/benchmarks/+page.svelte';

export const tomes: Array<Tome> = [
	{
		slug: 'introduction',
		category: 'guide',
		Component: IntroductionPage,
		related_tomes: ['playground', 'benchmarks'],
		related_modules: [],
		related_declarations: [],
	},
	{
		slug: 'playground',
		category: 'guide',
		Component: PlaygroundPage,
		related_tomes: ['introduction', 'benchmarks'],
		related_modules: [],
		related_declarations: [],
	},
	{
		slug: 'benchmarks',
		category: 'guide',
		Component: BenchmarksPage,
		related_tomes: ['introduction', 'playground'],
		related_modules: [],
		related_declarations: [],
	},
];

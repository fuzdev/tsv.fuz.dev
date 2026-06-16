<script lang="ts">
	import {resolve} from '$app/paths';
	import DocsFooter from '@fuzdev/fuz_ui/DocsFooter.svelte';
	import {FUZ_DEV_URL} from '@fuzdev/fuz_ui/constants.ts';
	import {site_context} from '@fuzdev/fuz_ui/site.svelte.ts';

	const site = site_context.get();
</script>

<main>
	<section>
		<header class="box pt_xl">
			<h1 class="mt_xl2">tsv</h1>
			<p class="panel p_md" style:text-align="center">
				tsv is a formatter, parser, and future linter + more<br />for Svelte, TypeScript, and CSS
			</p>
		</header>
	</section>
	<section class="box">
		<div class="column gap_lg">
			<a class="font_size_xl chip px_xl py_sm text-align:center" href={resolve('/docs')}>docs</a>
			<a class="font_size_xl chip px_xl py_sm text-align:center" href={resolve('/docs/benchmarks')}
				>benchmarks</a
			>
		</div>
	</section>
	<section class="box">
		<DocsFooter repo_url={site.repo_url} root_url={FUZ_DEV_URL} />
	</section>
</main>

<style>
	main {
		display: flex;
		flex-direction: column;
		align-items: center;
		margin: 0 auto;
	}
</style>

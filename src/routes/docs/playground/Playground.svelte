<script lang="ts">
	import Code from '@fuzdev/fuz_code/Code.svelte';
	import {playground_example} from './playground_example.js';

	// `@fuzdev/tsv_wasm` is loaded lazily, in the browser only — a dynamic import
	// so the ~900KB WASM lands in its own chunk, fetched the first time this
	// component mounts and never pulled into `/docs` or the prerendered HTML.
	let tsv: typeof import('@fuzdev/tsv_wasm') | null = $state(null);
	let load_error: string | null = $state(null);

	let source = $state(playground_example);
	// the source as of the last successful format; `dirty` diffs against it
	let formatted_source = $state(playground_example);
	let ast_json = $state('');
	let format_error: string | null = $state(null);
	let parse_error: string | null = $state(null);

	const ready = $derived(tsv !== null);
	const dirty = $derived(source !== formatted_source);

	$effect(() => {
		if (tsv) return;
		let cancelled = false;
		void (async () => {
			try {
				const mod = await import('@fuzdev/tsv_wasm');
				await mod.init();
				if (cancelled) return;
				tsv = mod;
				format(); // format the initial example once the formatter is ready
			} catch (err) {
				if (!cancelled) load_error = err instanceof Error ? err.message : String(err);
			}
		})();
		return () => {
			cancelled = true;
		};
	});

	const update_ast = (): void => {
		if (!tsv) return;
		try {
			ast_json = JSON.stringify(tsv.parse_svelte(source), null, 2);
			parse_error = null;
		} catch (err) {
			parse_error = err instanceof Error ? err.message : String(err);
		}
	};

	// Format the source in place (on blur or the Format button). Blur means the
	// caret has already left the textarea, so replacing its value is safe.
	const format = (): void => {
		if (!tsv) return;
		try {
			const formatted = tsv.format_svelte(source);
			source = formatted;
			formatted_source = formatted;
			format_error = null;
		} catch (err) {
			format_error = err instanceof Error ? err.message : String(err);
		}
		update_ast();
	};

	const reset = (): void => {
		source = playground_example;
		format();
	};
</script>

<div class="playground">
	<header class="row gap_sm">
		<button type="button" class="plain" onclick={format} disabled={!ready || !dirty}>format</button>
		<button type="button" class="plain" onclick={reset} disabled={!ready}>reset</button>
		{#if dirty}
			<span class="dirty" title="edits haven't been formatted yet">● unformatted</span>
		{/if}
	</header>

	{#if load_error}
		<p class="error">Couldn't load the tsv formatter: {load_error}</p>
	{/if}

	<div class="panes">
		<textarea
			class="plain"
			bind:value={source}
			onblur={format}
			spellcheck="false"
			autocapitalize="off"
			autocomplete="off"
		></textarea>

		{#if !ready}
			<p class="muted">loading the formatter…</p>
		{:else if parse_error}
			<p class="error">{parse_error}</p>
		{:else}
			<div class="ast">
				<Code lang="json" content={ast_json} />
			</div>
		{/if}
	</div>

	{#if format_error}
		<p class="error">format error: {format_error}</p>
	{/if}
</div>

<style>
	.playground {
		display: flex;
		flex-direction: column;
		gap: var(--space_md);
		margin-bottom: var(--space_lg);
	}
	header {
		align-items: center;
	}
	.muted {
		opacity: 0.7;
		font-size: var(--font_size_sm, 0.875em);
	}
	.dirty {
		color: var(--color_e_40, #c97a00);
		font-size: var(--font_size_sm, 0.875em);
	}
	/* Stacked panes; each is capped at 400px and scrolls. */
	.panes {
		display: flex;
		flex-direction: column;
	}
	textarea {
		min-width: 0;
		height: 400px;
		margin-bottom: 0;
		resize: vertical;
		font-family: var(--font_family_mono, ui-monospace, monospace);
		tab-size: 2;
		white-space: pre;
		overflow-wrap: normal;
	}
	.ast {
		min-width: 0;
		height: 400px;
		overflow: auto;
	}
	.error {
		color: var(--color_e_40, #c0392b);
		white-space: pre-wrap;
	}
</style>

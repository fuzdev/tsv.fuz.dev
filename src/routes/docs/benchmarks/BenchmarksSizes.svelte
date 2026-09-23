<script lang="ts">
	import type { BaselineRow } from './benchmark_baseline.ts';
	import { format_bytes, format_gzip_size } from './benchmark_display.ts';
	import type { SizeCapabilityGroup } from './benchmark_sizes.ts';
	import BenchmarksBaselineGroup from './BenchmarksBaselineGroup.svelte';

	const {
		groups
	}: {
		/** One target's builds by capability (full toolchain / formatter / parser) — see `derive_size_targets`. */
		groups: Array<SizeCapabilityGroup>;
	} = $props();

	// a row without a gzip size — a disabled placeholder (e.g. oxfmt's absent wasm
	// build), or an entry the report left null — falls back to 'n/a' when its group's
	// other entries carry one, rather than omitting the annotation entirely:
	// otherwise that row drops the annotation column and its bar-track renders
	// wider than its siblings'
	const to_rows = (group: SizeCapabilityGroup): Array<BaselineRow> => {
		const group_has_gzip = group.entries.some((e) => e.gzip_bytes != null);
		return group.entries.map((s) => ({
			key: s.label,
			label: s.label,
			category: s.category,
			bar_fraction: s.bar_fraction,
			value: format_bytes(s.bytes),
			raw: s.bytes,
			annotation:
				(s.disabled ? undefined : format_gzip_size(s.gzip_bytes)) ??
				(group_has_gzip ? 'n/a' : undefined),
			disabled: s.disabled ?? false
		}));
	};
</script>

{#each groups as group (group.capability)}
	<div class="mb_xl5">
		<!-- under the target's own section heading -->
		<h4>{group.heading}</h4>
		<BenchmarksBaselineGroup rows={to_rows(group)} label={group.heading} />
	</div>
{/each}

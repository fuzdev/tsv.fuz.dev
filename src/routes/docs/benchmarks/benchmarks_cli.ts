// The independent end-to-end CLI benchmark — a fork of Oxc's official
// `bench-formatter` that adds tsv (https://github.com/ryanatkn/oxc-bench-formatter,
// forked from https://github.com/oxc-project/bench-formatter — `tsv` is the fork's
// DEFAULT branch, so the bare fork URL already lands on it; upstream carries
// neither tsv nor this analysis). Unlike the in-process, single-threaded numbers
// elsewhere on this page, it measures the WHOLE CLI: process spawn, file
// discovery, I/O, and each tool's default multi-file parallelism. tsv, oxfmt, and
// biome parallelize across files while prettier is effectively serial, so the
// wall-clock ratios scale with core count and are machine-dependent — the
// parallelism-neutral view is CPU work (hyperfine `User` time). tsv runs only in
// the JSX-free scenarios (it has no JSX/TSX parser); the Svelte scenario benches
// it against rsvelte-fmt (`@rsvelte/fmt`), the other Rust Svelte-native formatter.
//
// The numbers come from `benchmarks_formatters.json`, generated from that
// harness's README by `benchmarks_formatters.gen.json.ts`; only the prose below
// is authored here. To refresh: run `pnpm run update-readme` in the harness, then
// `gro gen` here.

import { benchmarks_formatters_json } from "./benchmarks_formatters.ts";
import type { FormatterScenario } from "./formatter_benchmark_data.ts";

export interface CliFormatterResult {
  /** Display label; `tsv` is the reference row every ratio is computed against. */
  label: string;
  /** hyperfine wall-clock mean, in milliseconds — what you experience typing the command. */
  wall_ms: number;
  /** hyperfine `User` time (total CPU across all threads), in ms — the parallelism-neutral view. */
  cpu_ms: number;
  /** Peak resident set size (RSS), in megabytes; `null` when the harness measured no memory. */
  memory_mb: number | null;
}

export interface CliScenario {
  key: string;
  heading: string;
  /** The harness's own one-line corpus label, rendered beside the heading. */
  target: string;
  /** One-line description of what makes the comparison fair. */
  description: string;
  /** Results ascending by wall-clock time, tsv-relative ratios computed by the component. */
  results: Array<CliFormatterResult>;
}

export interface BenchmarksCliReport {
  machine: string;
  versions: Record<string, string>;
  scenarios: Array<CliScenario>;
}

/**
 * The prose framing for each scenario, keyed by its generated scenario id — the
 * harness measures the numbers but doesn't explain them. Also fixes the page
 * order, which is by narrative weight (the multi-file repo leads), not the order
 * the harness runs them in. A scenario missing from here is dropped rather than
 * rendered unexplained.
 */
/**
 * The tsv-vs-rsvelte-fmt Svelte scenario's id. Absent from the generated data
 * until the harness README is regenerated with it, so prose about it must be
 * conditional on the scenario actually being present.
 */
export const CLI_SVELTE_KEY = "svelte-tsv-vs-rsvelte-fmt";

const SCENARIO_COPY: Record<
  string,
  Omit<CliScenario, "key" | "target" | "results">
> = {
  "typescript-only-tsv-fair": {
    heading: "TypeScript repo",
    description:
      "Every formatter scoped to the same file set, with a preflight parse check confirming none reject anything — the fair way to put tsv on a real multi-file repo.",
  },
  "large-single-file": {
    heading: "Large single file",
    description:
      "With a single input every formatter is effectively single-threaded, so wall-clock is close to an engine comparison here.",
  },
  [CLI_SVELTE_KEY]: {
    heading: "Svelte corpus",
    description:
      "The two Rust Svelte-native formatters head-to-head on a third-party .svelte corpus, with rsvelte-fmt configured to tsv’s fixed style (width 100, tabs, single quotes) so both do comparable line-break work.",
  },
};

/**
 * Display labels for the harness's hyperfine command names, which read better
 * spaced out in a table. Names absent here are displayed as-is.
 */
export const CLI_LABELS: Record<string, string> = {
  "prettier+oxc-parser": "prettier + oxc-parser",
};

const to_results = (scenario: FormatterScenario): Array<CliFormatterResult> =>
  scenario.timings
    .map((timing) => ({
      label: CLI_LABELS[timing.name] ?? timing.name,
      wall_ms: timing.mean_ms,
      cpu_ms: timing.user_ms,
      memory_mb:
        scenario.memory.find((m) => m.name === timing.name)?.mean_mb ?? null,
    }))
    .sort((a, b) => a.wall_ms - b.wall_ms);

/** The scenarios the page has prose for; every non-optional one must resolve to generated data. */
export const CLI_SCENARIO_KEYS = Object.keys(SCENARIO_COPY);

/**
 * The copy entries allowed to be absent from the generated data — prose staged
 * ahead of the harness README carrying the scenario, so this repo can land
 * support for a new scenario before the harness's numbers are regenerated.
 * Every other `SCENARIO_COPY` entry must resolve; the shape test enforces
 * exactly that split.
 */
export const CLI_OPTIONAL_SCENARIO_KEYS: Array<string> = [CLI_SVELTE_KEY];

const to_scenarios = (): Array<CliScenario> =>
  Object.entries(SCENARIO_COPY).flatMap(([key, copy]) => {
    const scenario = benchmarks_formatters_json.scenarios.find(
      (s) => s.id === key,
    );
    return scenario
      ? [
          {
            key,
            ...copy,
            target: scenario.target,
            results: to_results(scenario),
          },
        ]
      : [];
  });

export const benchmarks_cli: BenchmarksCliReport = {
  machine: benchmarks_formatters_json.machine,
  versions: benchmarks_formatters_json.versions,
  scenarios: to_scenarios(),
};

/** The scenario id the page's prose calls "the TypeScript repo" — the multi-file, real-repo run. */
export const CLI_TS_REPO_KEY = "typescript-only-tsv-fair";

/**
 * How many times faster or lighter tsv is than `label` in one CLI scenario, by
 * the given metric — the ratios the page's prose quotes.
 *
 * @returns the ratio, or `undefined` when the scenario, the formatter, or either
 * side's measurement is absent
 */
export const cli_speedup_vs_tsv = (
  scenario_key: string,
  label: string,
  metric: keyof Omit<CliFormatterResult, "label">,
): number | undefined => {
  const results = benchmarks_cli.scenarios.find(
    (s) => s.key === scenario_key,
  )?.results;
  const tsv = results?.find((r) => r.label === "tsv")?.[metric];
  const other = results?.find((r) => r.label === label)?.[metric];
  if (tsv == null || other == null || !tsv) return undefined;
  return other / tsv;
};

/**
 * The span of "times less memory than tsv" across the non-tsv rows, over one
 * scenario or all of them — the range claims the page's prose quotes. An
 * optional `labels` list narrows the span to just those formatters, so a
 * sentence naming specific tools quotes a range measured over exactly them.
 *
 * @returns the low and high ratio, or `undefined` when nothing was measured
 */
export const cli_memory_ratio_range = (
  scenario_key?: string,
  labels?: Array<string>,
): { min: number; max: number } | undefined => {
  const scenarios = benchmarks_cli.scenarios.filter(
    (s) => !scenario_key || s.key === scenario_key,
  );
  const ratios = scenarios.flatMap((scenario) =>
    scenario.results
      .filter((r) => r.label !== "tsv" && (!labels || labels.includes(r.label)))
      .map((r) => cli_speedup_vs_tsv(scenario.key, r.label, "memory_mb"))
      .filter((ratio) => ratio !== undefined),
  );
  if (ratios.length === 0) return undefined;
  return { min: Math.min(...ratios), max: Math.max(...ratios) };
};

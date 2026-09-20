# tsv.fuz.dev

> website for tsv, precise language tools for TypeScript/JS, CSS, and Svelte in Rust

tsv.fuz.dev is the public website for the tsv tool — landing page, benchmarks, docs, and an interactive playground. Built with SvelteKit + fuz stack, statically deployed.

For coding conventions, see Skill(fuz-stack).

## Gro commands

```bash
gro check     # typecheck, test, lint, format check (run before committing)
gro typecheck # typecheck only (faster iteration)
gro test      # run tests with vitest
gro build     # build for production (static adapter)
gro deploy    # build, commit, and push to deploy branch
gro sync      # regenerate files and run svelte-kit sync
```

IMPORTANT for AI agents: Do NOT run `gro dev` - the developer will manage the dev server.

## Key dependencies

- Svelte 5 - component framework with runes
- SvelteKit - application framework with static adapter
- fuz_css (`@fuzdev/fuz_css`) - semantic-first CSS framework and design system
- fuz_ui (`@fuzdev/fuz_ui`) - UI components, theming, docs system
- fuz_util (`@fuzdev/fuz_util`) - utility functions
- fuz_code (`@fuzdev/fuz_code`) - syntax highlighting
- Gro (`@fuzdev/gro`) - build system and task runner
- tsv (via Gro) - code formatting
- mdz (`@fuzdev/mdz`) - markdown preprocessor wired into `svelte.config.js`
- `@fuzdev/tsv-wasm` - tsv's formatter + parser as WASM; powers the playground, loaded lazily in the browser

Note: `@fuzdev/tsv-wasm` is loaded only on `/docs/playground` via a browser-only dynamic `import()`, so the ~1MB-gzipped WASM (~2.8MB decoded) never weighs down `/docs` or the prerendered pages.

Note: several devDependencies — `@webref/css` (CSS spec data), `zimmerframe` (AST traversal), `@sveltejs/acorn-typescript`, `zod`, and `@fuzdev/blake3-wasm` — are *optional peer dependencies* of `@fuzdev/fuz_css`'s `vite_plugin_fuz_css`, declared here so its build-time CSS generation resolves them (e.g. `css_literal.ts` imports `@webref/css`, `css_class_extractor.ts` walks ASTs with `zimmerframe`). Of those only `zod` is imported by this app's own source — `formatter_benchmark_data.ts`'s schemas, read at gen and test time and as erased types by the page, so it never reaches the client bundle — so don't mistake the rest for dead deps. Likewise `esm-env`, `@types/estree`, and `@types/node` are optional peers of `@fuzdev/fuz_util`, `@fuzdev/mdz`, and `@fuzdev/fuz_ui`, and `tslib` backs `tsconfig.json`'s `importHelpers` — none is imported here directly either.

Note: `vite` is deliberately held at 7.x (with `@sveltejs/vite-plugin-svelte` 6.x) — vite 8 + plugin-svelte 7 was buggy with this app or SvelteKit's integration. Don't upgrade to vite 8 without deliberately re-verifying the site works.

## Scope

tsv.fuz.dev is the public face of the tsv tool:

- Landing page (home) with links to benchmarks and docs
- Benchmarks page with bar charts and summary tables
- Docs section (introduction, playground, benchmarks)
- Interactive playground (`/docs/playground`) — edit a deliberately-unformatted Svelte example in a syntax-highlighted editor (fuz_code's `CodeTextarea`); the formatted output and parsed AST update live alongside it; runs `@fuzdev/tsv-wasm` as lazily-loaded WASM
- Theme controls via fuz_ui's `ThemeRoot` in the root layout (no separate about/settings page)
- Shows install instructions led by the native `@fuzdev/tsv` (prebuilt N-API addon for Node/Bun, ships the `tsv` CLI), then `@fuzdev/tsv-wasm` (universal, same `tsv` CLI) and the format/parse subsets

### What tsv.fuz.dev does NOT include (yet)

- Authentication or backend
- Standalone native-binary downloads (the native path ships as the `@fuzdev/tsv` npm addon, not as a downloadable executable)

## Routes

```
src/
├── routes/
│   ├── +page.svelte          # Home: hero, links to docs and benchmarks
│   ├── +layout.svelte        # Root layout: fuz_css/fuz_code CSS, ThemeRoot, SiteState
│   ├── +layout.ts            # prerender: true, ssr: true
│   ├── style.css             # global styles
│   ├── library.ts            # builds library_json from virtual:svelte-docinfo + pkg.json
│   └── docs/
│       ├── +layout.svelte    # Docs layout (Docs wrapper; sets library_context)
│       ├── +page.svelte      # Docs index (DocsContent)
│       ├── tomes.ts          # Docs structure (introduction, playground, benchmarks)
│       ├── introduction/     # Introduction page (install + usage)
│       ├── playground/       # Interactive playground (Playground.svelte + playground_example.ts; lazy @fuzdev/tsv-wasm)
│       └── benchmarks/       # Benchmarks page: the four JSON reports, benchmark_data.ts / benchmark_sizes.ts / benchmark_cross_runtime.ts / benchmark_display.ts / benchmark_baseline.ts / benchmarks_cli.ts / formatter_benchmark_data.ts, the .gen.json.ts for the CLI harness, and the Benchmarks*.svelte visualizations (see Benchmarks below)
└── test/
    ├── benchmark_data.test.ts       # unit tests for the per-runtime derivations (corpus repos, stability, coverage)
    ├── benchmark_data.shape.test.ts # shape gates over the committed per-runtime and conformance reports
    ├── benchmark_data.prose.test.ts # gates every ratio and direction claim the page's prose quotes
    ├── benchmark_sizes.test.ts      # unit tests for the binary-size capability grouping
    ├── benchmark_sizes.shape.test.ts # shape gates over the committed report's binary sizes, and the tldr's like-for-like size claim
    ├── benchmark_cross_runtime.test.ts # unit tests for the combined-report derivations
    ├── benchmark_cross_runtime.shape.test.ts # shape gates over the committed combined report
    ├── benchmark_display.test.ts    # unit tests for the value formatters and row labels
    ├── benchmark_baseline.test.ts   # unit tests for the hover-to-rebaseline ratio math
    ├── benchmarks_cli.test.ts       # the CLI-harness data as the page consumes it
    └── formatter_benchmark_data.test.ts # the harness report's validation
```

## Benchmarks

Benchmark data comes from `tsv`. Full workflow to update:

```bash
# 1. In ~/dev/tsv — run benchmarks across deno/node/bun (builds artifacts automatically)
deno task bench

# 2. In ~/dev/tsv.fuz.dev — copy the latest results
npm run update-benchmarks
```

Step 1 writes the per-runtime `benches/js/results/report.<runtime>.{json,md}`
siblings, the composed cross-runtime `report.{json,md}`, and the conformance
coverage report `report.conformance.node.json` (committed to tsv).
Step 2 copies three of them — `report.node.json` → `benchmarks.json`, the
composed `report.json` → `benchmarks_cross_runtime.json`, and
`report.conformance.node.json` → `benchmarks_conformance.json` — verbatim;
tsv already writes them tab-indented, and Gro's formatter leaves JSON untouched,
so the committed copies are byte-identical to tsv's reports and the tests
gate their shape. Note the script's source paths are hardcoded to
`../tsv` — if the reports were generated in a different worktree, copy them
into `~/dev/tsv` (or copy manually) first.
The JSON formats match the types in `benchmark_data.ts`.

The end-to-end CLI comparison against Prettier, Biome, and Oxfmt comes from a
separate harness, a fork of Oxc's `bench-formatter` that adds tsv
(../oxc-bench-formatter). Beside the console dump in its README it writes
`results.json`: hyperfine's own export at full precision, the memory pass, the
preflight rows, the versions and machine the README lists, and (on newer reports)
`node_startup`, a bare `node -e ""` timed on the same machine — the launch floor
every npm-bin row pays, kept beside `machine` rather than as a row — and, per
settling scenario, `settle_seconds`, the idle before each formatter's warmups, which
the tables' run-count notes and the run-order note quote when present. To update:

```bash
# 1. In ~/dev/oxc-bench-formatter — re-run, rewriting its README and results.json (times the npm-installed @fuzdev/tsv its lockfile pins)
pnpm run update-readme

# 2. In ~/dev/tsv.fuz.dev — validate results.json into the committed report
gro gen
```

`benchmarks_formatters.gen.json.ts` validates that report against
`formatter_benchmark_data.ts`'s Zod schemas and writes
`benchmarks_formatters.json`, keeping only the scenarios tsv participates in
(it has no JSX/TSX parser, so the harness runs it on the JSX-free corpora
only). That includes the harness's Svelte scenario, which benches tsv against
rsvelte-fmt (`@rsvelte/fmt`), and its tsv-only delivery scenario (the native
binary vs `@fuzdev/tsv`'s Node dispatcher vs `@fuzdev/tsv-wasm`, flagged
`tsv_only` so "every other tool" claims skip it). The dispatcher row
(`tsv-npm`) also runs beside native tsv in every scenario that faces another
tool, since Prettier, Biome, Oxfmt, and rsvelte-fmt are all timed through Node
bins the bare binary skips: it is a second tsv row there, never a competitor
(`cli_comparison_results` keeps it out of the "every other tool" ranges). Each
table's ratio columns start out against it (`cli_default_anchor_label`; native
tsv in the tsv-only delivery table) and re-baseline on whichever row is hovered,
as the format, parse, and size groups do. The page's headline
CLI claims lead with the like-for-like dispatcher ratios
(`cli_speedup_vs_tsv_npm`, `cli_memory_ratio_range`'s `baseline_label`) and give
the bare-binary ones second; the copy has no fallback for a report without the
row, and the prose test requires those ratios to resolve. The harness runs tsv's
Node-launched rows through a bin shim derived from pnpm's own, so they pay the
launch cost every other row pays; when it can't, it records the row as
`unshimmed` and the table shows a note under it. A scenario renders on the
page only once it has an entry in `SCENARIO_COPY` (`benchmarks_cli.ts`), and
prose claims about the Svelte head-to-head are conditional on its data being
present, so the site stays correct when the harness publishes that scenario
aborted.

A **missing** sibling checkout is the one tolerated case — generation is
skipped, the committed JSON stands, and `gro gen --check` passes on any machine
or CI that has only this repo (CI never checks out the harness, so it always
takes this path; no `--no-gen` needed). A report that **is** present but doesn't
validate — a renamed or unknown key, a scenario with neither timings nor an
abort, no tsv row anywhere — fails the task loudly, naming the path that failed,
rather than publishing stale or scenario-stripped numbers. A drift that still
validates but renames a scenario is caught on the site side instead: every
key in `benchmarks_cli.ts`'s `SCENARIO_COPY` must resolve to generated data, and
a test asserts it.

Key files in `src/routes/docs/benchmarks/`:

- `benchmarks.json` — per-runtime Node report (copied from tsv)
- `benchmarks_cross_runtime.json` — composed cross-runtime report (copied from tsv)
- `benchmarks_conformance.json` — conformance parse-coverage report (copied from tsv)
- `benchmarks_formatters.json` — formatter CLI comparison, generated from the sibling harness's `results.json`
- `benchmark_data.ts` — TypeScript types matching the per-runtime JSON format, plus the format/parse, conformance, stability, and corpus derivations
- `benchmark_sizes.ts` — the binary-size domain: category and capability grouping, and the synthesized combined builds
- `benchmark_cross_runtime.ts` — the combined cross-runtime report: its types, derivations, and display helpers
- `benchmark_display.ts` — value formatters (times, sizes, ratios), row labels, and per-category colors shared across the page; sizes print in decimal units (1 KB = 1,000 B) so an artifact reads the same here as in tsv's own report
- `benchmark_baseline.ts` — the hover-to-rebaseline ratios: `BaselineRow`, `BaselineDirection`, and the per-direction ratio, format (`format_speedup_signed` for speed, `benchmark_display.ts`'s `format_ratio_plain` for size), and color scales
- `formatter_benchmark_data.ts` — the report's Zod schemas and types, plus `parse_formatter_benchmarks`, which validates the harness's `results.json` and keeps tsv's scenarios
- `benchmarks_cli.ts` — shapes `benchmarks_formatters.json` for `BenchmarksCli.svelte` and owns the per-scenario prose; the numbers are all generated
- `benchmarks.ts`, `benchmarks_cross_runtime.ts`, `benchmarks_conformance.ts`, `benchmarks_formatters.ts` — re-export the JSON with types
- `BenchmarksBar.svelte`, `BenchmarksGroup.svelte`, etc. — visualization components
- `BenchmarksBaselineGroup.svelte` — shared interactive column behind the format, parse, and binary-size groups: hovering a row re-baselines that group's ratios (each of the three groups per section is independent), restoring the default anchor (the canonical reference — Prettier for format, the JS baseline for parse — and the smallest build for size) on mouseleave. `benchmark_baseline.ts`'s `compute_baseline_ratio`/`format_baseline_ratio`/`baseline_ratio_color` carry the per-`BaselineDirection` (`speed`/`size`) formulas it and the derivations share

## Architecture

- Static SvelteKit app (`adapter-static`), deploys to GitHub Pages
- Uses fuz_ui tome system for docs navigation
- `docs/tomes.ts` defines the doc sections: introduction, playground, benchmarks
- Benchmark data lives in `src/routes/docs/benchmarks/` as four JSON reports — three copied from tsv, one generated from the sibling CLI harness (see [Benchmarks](#benchmarks))
- The report types and derivations split across sibling modules: `benchmark_data.ts` (the per-runtime and conformance reports), `benchmark_sizes.ts` (binary sizes, read by `BenchmarksSizes.svelte`), `benchmark_cross_runtime.ts` (the combined report, read by `BenchmarksCrossRuntime.svelte`), `benchmark_display.ts` (formatters, labels, colors), and `benchmark_baseline.ts` (the rebaseline ratios, read by `BenchmarksBaselineGroup.svelte`). The dependency runs one way — `benchmark_data.ts` imports none of the others, `benchmark_display.ts` imports only its types, and the rest build on those two
- The benchmarks page quotes no hand-written ratios — its prose computes them from the same reports the charts render, via `benchmark_data.ts`'s `benchmark_speedup`, `benchmark_display.ts`'s `format_ratio_approx`/`format_ratio_range`/`format_share_approx`, and `benchmarks_cli.ts`'s `cli_speedup_vs_tsv_npm`/`cli_speedup_vs_tsv`/`cli_memory_ratio_range` (plus `cli_tsv_npm_memory_mb`, `cli_tsv_npm_overhead_ms_range`, and `cli_tsv_npm_overhead_share` for the dispatcher's own cost, and `cli_scenario_find` for the Svelte scenario's abort state). A test gates that every pair the copy names still resolves
- Tests and routes import route modules through the `$routes` alias (`svelte.config.js`), not a `#routes/*` subpath import — this repo has no `package.json` `imports` map
- `library.ts` builds component metadata at runtime from the `virtual:svelte-docinfo` module (provided by the `svelte-docinfo` Vite plugin); the docs index passes it to `DocsContent`
- The playground (`/docs/playground`) loads `@fuzdev/tsv-wasm` via a browser-only dynamic `import()` inside `Playground.svelte`, so the WASM code-splits into its own chunk fetched only on that route, keeping `/docs` and the prerendered pages WASM-free. `@fuzdev/tsv-wasm` is in `vite.config.ts` `optimizeDeps.exclude` (like `@fuzdev/blake3-wasm`)
- The playground's editor is fuz_code's `CodeTextarea` (live syntax highlighting via the experimental CSS Custom Highlight API). It needs `@fuzdev/fuz_code/theme_highlight.css`, imported inside `Playground.svelte` rather than the root layout so it stays on this route only; `supports_css_highlight_api()` drives a graceful-degradation note where the API is unavailable (the editor still works, unstyled)

## Deployment

Deploys to `https://tsv.fuz.dev/` via `gro deploy` (builds and pushes to deploy branch).

## Project standards

- TypeScript strict mode
- Svelte 5 with runes API
- tsv with tabs, 100 char width
- Node >= 24.14
- Private package (not published to npm)

## Related projects

- [`tsv`](../tsv/CLAUDE.md) - the tsv parser/formatter (source of truth)
- [`fuz_css`](../fuz_css/CLAUDE.md) - CSS framework
- [`fuz_ui`](../fuz_ui/CLAUDE.md) - UI components and docs system
- [`fuz_util`](../fuz_util/CLAUDE.md) - utility functions

## Committing

`git add` and `git commit` are denied by `.claude/settings.local.json` in
this repo — make the edits and stop, the user commits.

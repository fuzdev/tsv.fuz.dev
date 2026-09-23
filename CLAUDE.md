# tsv.fuz.dev

> website for tsv, precise language tools for TypeScript/JS, CSS, and Svelte in Rust

tsv.fuz.dev is the public website for the tsv tool — landing page, benchmarks, parse conformance, docs, and an interactive playground. Built with SvelteKit + fuz stack, statically deployed.

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

Note: `@fuzdev/tsv-wasm` is loaded only on `/docs/playground` via a browser-only dynamic `import()`, so the ~1MB-gzipped WASM (~2.5MB decoded) never weighs down `/docs` or the prerendered pages.

Note: several devDependencies — `@webref/css` (CSS spec data), `zimmerframe` (AST traversal), `@sveltejs/acorn-typescript`, `zod`, and `@fuzdev/blake3-wasm` — are *optional peer dependencies* of `@fuzdev/fuz_css`'s `vite_plugin_fuz_css`, declared here so its build-time CSS generation resolves them (e.g. `css_literal.ts` imports `@webref/css`, `css_class_extractor.ts` walks ASTs with `zimmerframe`). Of those only `zod` is imported by this app's own source — `formatter_benchmark_data.ts`'s schemas, read at gen and test time and as erased types by the page, so it never reaches the client bundle — so don't mistake the rest for dead deps. Likewise `esm-env`, `@types/estree`, and `@types/node` are peers of `@fuzdev/fuz_util` (the latter two optional), and `esm-env` and `@types/estree` optional peers of `@fuzdev/mdz` and `esm-env` of `@fuzdev/fuz_ui`, and `tslib` backs `tsconfig.json`'s `importHelpers` — none is imported here directly either.

Note: `vite` is deliberately held at 7.x (with `@sveltejs/vite-plugin-svelte` 6.x) — vite 8 + plugin-svelte 7 was buggy with this app or SvelteKit's integration. Don't upgrade to vite 8 without deliberately re-verifying the site works.

## Scope

tsv.fuz.dev is the public face of the tsv tool:

- Landing page (home) with links to benchmarks and docs
- Benchmarks page with bar charts and tables
- Docs section (introduction, playground, benchmarks, conformance)
- Conformance page with per-corpus-source parse-coverage tables over deliberately hard corpora, and a `Test corpus` section on how each source was chosen
- Interactive playground (`/docs/playground`) — edit a deliberately-unformatted Svelte example in a syntax-highlighted editor (fuz_code's `CodeTextarea`); the formatted output below it updates live and the parsed AST follows on a short idle; runs `@fuzdev/tsv-wasm` as lazily-loaded WASM
- Theme controls via fuz_ui's `ThemeRoot` in the root layout (no separate about/settings page)
- Shows install instructions: the `fuzdev.tsv-format` VS Code extension, then the native `@fuzdev/tsv` (prebuilt N-API addon for Node/Bun, ships the `tsv` CLI), then `@fuzdev/tsv-wasm` (universal, same `tsv` CLI) and the format/parse subsets

### What tsv.fuz.dev does NOT include (yet)

- Authentication or backend
- Standalone native-binary downloads (the introduction links tsv's GitHub Releases, which attach the CLI binaries, rather than hosting them)

## Routes

```
src/
├── routes/
│   ├── +page.svelte          # Home: hero, links to docs and benchmarks
│   ├── +layout.svelte        # Root layout: fuz_css/fuz_code CSS, ThemeRoot, SiteState
│   ├── +layout.ts            # prerender: true, ssr: true
│   ├── style.css             # global styles (currently empty of rules)
│   ├── library.ts            # builds library_json from virtual:svelte-docinfo + pkg.json
│   └── docs/
│       ├── +layout.svelte    # Docs layout (Docs wrapper; sets library_context and the per-page title)
│       ├── +page.svelte      # Docs index (DocsContent)
│       ├── tomes.ts          # Docs structure (introduction, playground, benchmarks, conformance)
│       ├── introduction/     # Introduction page (install + usage; code samples in introduction_examples.ts)
│       ├── playground/       # Interactive playground (Playground.svelte + playground_example.ts; lazy @fuzdev/tsv-wasm)
│       ├── conformance/      # Parse-conformance page: its report (conformance.json + conformance.ts), conformance_data.ts, ConformanceTable.svelte; builds on the benchmarks modules
│       └── benchmarks/       # Benchmarks page: the three JSON reports, the benchmark_*.ts / benchmarks_*.ts modules, the .gen.json.ts for the CLI harness, and the Benchmarks*.svelte visualizations (see Benchmarks below)
└── test/
    ├── benchmark_data.test.ts       # unit tests for the per-runtime derivations (groups, stability, corpus, sweeps)
    ├── benchmark_data.shape.test.ts # shape gates over the committed per-runtime report
    ├── benchmark_data.prose.test.ts # gates the ratio, direction, and count claims the benchmarks page's prose quotes
    ├── conformance_data.test.ts     # unit tests for the conformance grouping and per-source matrices
    ├── conformance_data.shape.test.ts # shape gates over the committed conformance report
    ├── conformance_data.prose.test.ts # gates the claims the conformance page's prose quotes
    ├── benchmark_sizes.test.ts      # unit tests for the binary-size capability grouping
    ├── benchmark_sizes.shape.test.ts # shape gates over the committed report's binary sizes, and the tldr's like-for-like size claim
    ├── benchmark_cross_runtime.test.ts # unit tests for the combined-report derivations
    ├── benchmark_cross_runtime.shape.test.ts # shape gates over the committed combined report
    ├── benchmark_display.test.ts    # unit tests for the value formatters and row labels
    ├── benchmark_baseline.test.ts   # unit tests for the hover-to-rebaseline ratio math
    ├── benchmarks_cli.test.ts       # unit tests for the CLI report shaping and claim helpers
    ├── benchmarks_cli.shape.test.ts # shape gates over the CLI-harness data as the page consumes it, and its machine and versions against the in-process report's
    ├── benchmark_test_helpers.ts    # fixture factories the benchmark tests share
    └── formatter_benchmark_data.test.ts # the harness report's validation
```

## Benchmarks

Four JSON reports, three copied verbatim from `tsv` and one generated from the
sibling CLI harness. Three live in `src/routes/docs/benchmarks/`; the conformance
report lives with its page in `src/routes/docs/conformance/`, which shares the
per-runtime report types and the display helpers.

| committed file | source |
| --- | --- |
| `benchmarks.json` | tsv's `benches/js/results/report.node.json` (per-runtime Node report) |
| `benchmarks_cross_runtime.json` | tsv's composed `report.json` |
| `../conformance/conformance.json` | tsv's `report.conformance.node.json` (parse coverage) |
| `benchmarks_formatters.json` | `gro gen`, from ../oxc-bench-formatter's `results.json` |

### Refreshing

```bash
# tsv reports: in ~/dev/tsv (runs deno/node/bun, builds artifacts), then here
deno task bench
npm run update-benchmarks

# CLI harness: in ~/dev/oxc-bench-formatter (rewrites its README and results.json,
# timing the npm-installed @fuzdev/tsv its lockfile pins), then here
pnpm run update-readme
gro gen
```

`update-benchmarks` is three `cp`s hardcoded to `../tsv` — if the reports were
generated in a different worktree, copy them into `~/dev/tsv` (or copy manually)
first. tsv writes them tab-indented and Gro's formatter leaves JSON untouched, so
the copies stay byte-identical and the `*.shape.test.ts` files gate their shape.
Those tests pin each report's `version` exactly, so the types in
`benchmark_data.ts` and `benchmark_cross_runtime.ts` describe the current report
only — re-pin and update the types together on a bump.

`benchmarks_formatters.gen.json.ts` validates the harness's `results.json`
against `formatter_benchmark_data.ts`'s Zod schemas and keeps only the scenarios
tsv participates in (it has no JSX/TSX parser). A **missing** sibling checkout is
the one tolerated case — generation is skipped and the committed JSON stands, so
`gro gen --check` passes on CI, which never checks out the harness. A report
that **is** present but doesn't validate fails the task loudly, naming its path.
A drift that still validates but renames a scenario is caught on the site side:
every key in `benchmarks_cli.ts`'s `SCENARIO_COPY` must resolve to generated
data, and a test asserts it.

The page states the machine and tool versions once, in the Benchmarking details
section, from tsv's report. `benchmarks_cli.shape.test.ts` holds the harness's
own `machine` and `versions` to it (CPU, OS/arch, Node, and every tool both
time), so refresh the two on the same setup — a one-sided refresh fails there.

### The CLI comparison

The harness is a fork of Oxc's `bench-formatter` that adds tsv, benching it
against Prettier, Biome, Oxfmt, and (on Svelte) rsvelte-fmt, all timed through
their npm bins. tsv gets two rows wherever it faces another tool: `tsv-npm`, the
`@fuzdev/tsv` Node dispatcher — the like-for-like row, never a competitor — and
the bare `tsv` binary. The page's headline CLI claims lead with the dispatcher
ratios and have no fallback for a report without that row; the prose test
requires them to resolve. A tsv-only delivery scenario (binary vs dispatcher vs
`@fuzdev/tsv-wasm`) is flagged `tsv_only` so "every other tool" claims skip it.
A scenario renders only once it has a `SCENARIO_COPY` entry, and prose about the
Svelte head-to-head is conditional on its data, since the harness publishes that
scenario aborted when rsvelte-fmt's preflight crashes. Field-level detail lives
in the schema TSDoc in `formatter_benchmark_data.ts`.

### Modules

- `benchmark_data.ts` — per-runtime report types, plus the format/parse, stability, and corpus derivations; imports none of the others
- `BenchmarksCorpus.svelte` — the per-source corpus table both pages' corpus sections render (`Corpus` on the benchmarks page, `Test corpus` on the conformance page), from `benchmark_data.ts`'s `derive_corpus_source_table`; a source no repo names needs a hand label (`CORPUS_SOURCE_LABELS`), and the conformance page hand-labels every source (`CONFORMANCE_SOURCE_LABELS`, which its matrix also reads); the shape test holds both
- `benchmark_display.ts` — value formatters, row labels, per-category colors; imports only `benchmark_data.ts`'s types
- `benchmark_sizes.ts`, `benchmark_cross_runtime.ts` — one domain each, built on `benchmark_data.ts` (the cross-runtime one on `benchmark_display.ts` too); the conformance page's `conformance_data.ts` does the same from its own directory — a matrix per language (corpus sources × engines, the aggregate as the leading row), with hand-stated maps the report has no field for: the engine names, the row notes, the source labels, `CONFORMANCE_ENGINE_VERSIONS` (the version keys each engine column lists, so the page's meta panel skips the report's formatters), and `CONFORMANCE_SELECTORS`, the engine that selected a source and so reads 100% on it by construction; the shape test holds each to the report
- `benchmark_baseline.ts` + `BenchmarksBaselineGroup.svelte` — hover-to-rebaseline: hovering a row re-anchors that group's ratios, restoring the default anchor on leave; pointer-only by design, and a disabled row never anchors. `BenchmarksCli.svelte`'s tables behave the same way
- `formatter_benchmark_data.ts` — the harness report's Zod schemas and `parse_formatter_benchmarks`
- `benchmarks_cli.ts` — shapes the CLI report for `BenchmarksCli.svelte` and owns the per-scenario prose and the `cli_*` claim helpers
- `benchmarks_prose.ts` — `IN_PROCESS_PAIRS`, the in-process pairings the copy names; the page reads it by key and the prose test iterates it, so a pairing added to the copy is gated by construction
- `benchmarks.ts`, `benchmarks_cross_runtime.ts`, `benchmarks_formatters.ts` (and the conformance page's `conformance.ts`) — re-export the JSON with types
- `BenchmarksCliSection.svelte` — the CLI section's prose and its claims; the other `Benchmarks*.svelte` are visualizations
- `benchmarks.css` — classes the components share, imported by the benchmarks and conformance `+page.svelte`s rather than the root stylesheet so they ship with those routes only

The page quotes no hand-written ratios or counts from the reports: its prose computes them from
the same reports the charts render, through tested helpers in the TS modules, so
the components' scripts hold no untested reductions.

## Architecture

- Static SvelteKit app (`adapter-static`), deploys to GitHub Pages
- Uses fuz_ui tome system for docs navigation
- `docs/tomes.ts` defines the doc sections: introduction, playground, benchmarks, conformance
- Benchmark data, modules, and the refresh workflow: see [Benchmarks](#benchmarks)
- Tests import route modules through the `$routes` alias (`svelte.config.js`), not a `#routes/*` subpath import — this repo has no `package.json` `imports` map; routes import each other relatively
- The `/docs` index renders every tome's component through `DocsContent`, so the playground, benchmarks, and conformance tomes check `at_root` (`page.url.pathname === DOCS_PATH`) and render only a one-line link there, keeping the WASM, the charts, and their section ids off the index
- `library.ts` builds component metadata at runtime from the `virtual:svelte-docinfo` module (provided by the `svelte-docinfo` Vite plugin); the docs index passes it to `DocsContent`
- The playground (`/docs/playground`) loads `@fuzdev/tsv-wasm` via a browser-only dynamic `import()` inside `Playground.svelte`, so the WASM code-splits into its own chunk fetched only on that route, keeping `/docs` and the prerendered pages WASM-free. `@fuzdev/tsv-wasm` is in `vite.config.ts` `optimizeDeps.exclude` (like `@fuzdev/blake3-wasm`)
- The playground's formatted pane recomputes on every keystroke (formatting is ~1 ms even on a 9 KB component) while the AST pane trails a ~150 ms idle: the AST is parsed, serialized, and syntax-highlighted — around half a megabyte of it for that same component — and rebuilding that DOM per keystroke is what a large paste feels. The top-level error is the live pane's; the AST pane renders its own, since its debounced source can still be the broken text the editor has moved past
- The playground's editor is fuz_code's `CodeTextarea` (live syntax highlighting via the experimental CSS Custom Highlight API). It needs `@fuzdev/fuz_code/theme_highlight.css`, imported inside `Playground.svelte` rather than the root layout so it stays on this route only; `supports_css_highlight_api()` drives a graceful-degradation note where the API is unavailable (the editor still works, unstyled)

## Deployment

Deploys to `https://tsv.fuz.dev/` via `gro deploy` (builds and pushes to deploy branch).

## Project standards

- TypeScript strict mode
- Svelte 5 with runes API
- tsv with tabs, 100 char width
- Node >= 24.14
- Not published to npm

## Related projects

- [`tsv`](../tsv/CLAUDE.md) - the tsv parser/formatter (source of truth)
- [`fuz_css`](../fuz_css/CLAUDE.md) - CSS framework
- [`fuz_ui`](../fuz_ui/CLAUDE.md) - UI components and docs system
- [`fuz_util`](../fuz_util/CLAUDE.md) - utility functions

## Committing

`git add` and `git commit` are denied by `.claude/settings.local.json` in
this repo — make the edits and stop, the user commits.

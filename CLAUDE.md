# tsv.fuz.dev

> website for tsv, a formatter, parser, and future linter + more for Svelte, TypeScript, and CSS

tsv.fuz.dev is the public website for the tsv tool — landing page, benchmarks, docs, and (eventually) playground. Built with SvelteKit + fuz stack, statically deployed.

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
- fuz_css (`@fuzdev/fuz_css`) - CSS framework and design system
- fuz_ui (`@fuzdev/fuz_ui`) - UI components, theming, docs system
- fuz_util (`@fuzdev/fuz_util`) - utility functions
- fuz_code (`@fuzdev/fuz_code`) - syntax highlighting
- Gro (`@fuzdev/gro`) - build system and task runner
- prettier + prettier-plugin-svelte - code formatting
- zimmerframe - AST traversal
- `@webref/css` - CSS spec data (used for benchmarks/docs)
- `@fuzdev/tsv_wasm` - tsv's formatter + parser as WASM; powers the playground, loaded lazily in the browser

Note: `@fuzdev/tsv_wasm` is loaded only on `/docs/playground` via a browser-only dynamic `import()`, so the ~900KB WASM never weighs down `/docs` or the prerendered pages.

## Scope

tsv.fuz.dev is the public face of the tsv tool:

- Landing page (home) with links to benchmarks and docs
- Benchmarks page with bar charts and summary tables
- Docs section (introduction, playground, benchmarks)
- Interactive playground (`/docs/playground`) — edit a Svelte example in a syntax-highlighted editor (fuz_code's `CodeTextarea`), format on blur, view the parsed AST; runs `@fuzdev/tsv_wasm` as lazily-loaded WASM
- About page with ecosystem links and theme controls
- Shows install instructions for `@fuzdev/tsv_wasm` (full tool + `tsv` CLI; format/parse subsets mentioned in the intro)

### What tsv.fuz.dev does NOT include (yet)

- Authentication or backend
- Native-binary downloads (tsv ships WASM-only at v0.1)

## Routes

```
src/routes/
├── +page.svelte          # Home: hero, links to benchmarks and docs
├── +layout.svelte        # Root layout with fuz_css imports
├── +layout.ts            # prerender: true, ssr: true
├── style.css             # global styles
├── library.ts            # builds library metadata at runtime from virtual:svelte-docinfo
├── sample.ts             # sample TypeScript code for demos
├── example.test.ts       # test example
├── about/
│   └── +page.svelte      # About: description, repo links, theme controls
└── docs/
    ├── +layout.svelte    # Docs layout (Docs component wrapper)
    ├── +page.svelte      # Docs index
    ├── tomes.ts          # Docs structure (introduction, playground, benchmarks)
    ├── introduction/     # Introduction page
    ├── playground/       # Interactive playground (Playground.svelte + playground_example.ts; lazy @fuzdev/tsv_wasm)
    └── benchmarks/       # Benchmark visualizations (BenchmarksBar, BenchmarksGroup, etc.)
```

## Benchmarks

Benchmark data comes from `tsv`. Full workflow to update:

```bash
# 1. In ~/dev/tsv — run benchmarks (builds ffi + wasm automatically)
deno task bench

# 2. In ~/dev/tsv.fuz.dev — copy the latest result
npm run update-benchmarks
```

Step 1 writes `benches/deno/results/report.json` (committed to tsv).
Step 2 copies it to `src/routes/docs/benchmarks/benchmarks.json`.
The JSON format matches `BenchmarkBaseline` in `benchmark_data.ts`.

Key files in `src/routes/docs/benchmarks/`:

- `benchmarks.json` — raw benchmark data (copied from tsv)
- `benchmark_data.ts` — TypeScript types matching the JSON format
- `benchmarks.ts` — re-exports the JSON with types
- `BenchmarksBar.svelte`, `BenchmarksGroup.svelte`, etc. — visualization components

## Architecture

- Static SvelteKit app (`adapter-static`), deploys to GitHub Pages
- Uses fuz_ui tome system for docs navigation
- `docs/tomes.ts` defines the doc sections: introduction, playground, benchmarks
- Benchmark data lives in `src/routes/docs/benchmarks/benchmarks.json` (see [Benchmarks](#benchmarks))
- `library.ts` builds component metadata at runtime from the `virtual:svelte-docinfo` module (provided by the `svelte-docinfo` Vite plugin); the docs index passes it to `DocsContent`
- The playground (`/docs/playground`) loads `@fuzdev/tsv_wasm` via a browser-only dynamic `import()` inside `Playground.svelte`, so the WASM code-splits into its own chunk fetched only on that route — the same lazy discipline `library.ts` uses for the heavy svelte-docinfo data, keeping `/docs` and the prerendered pages WASM-free. `@fuzdev/tsv_wasm` is in `vite.config.ts` `optimizeDeps.exclude` (like `blake3_wasm`)
- The playground's editor is fuz_code's `CodeTextarea` (live syntax highlighting via the experimental CSS Custom Highlight API). It needs `@fuzdev/fuz_code/theme_highlight.css`, imported inside `Playground.svelte` rather than the root layout so it stays on this route only; `supports_css_highlight_api()` drives a graceful-degradation note where the API is unavailable (the editor still works, unstyled)

## Deployment

Deploys to `https://tsv.fuz.dev/` via `gro deploy` (builds and pushes to deploy branch).

## Project standards

- TypeScript strict mode
- Svelte 5 with runes API
- Prettier with tabs, 100 char width
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

// The introduction's code samples. Kept in a `.ts` module so the `</script>` in the
// Svelte strings reads literally — inside a `.svelte` file's script block it would
// close the block, and the `<\/script>` escape it needs there would show on the page.

export const usage_example = `import { format_svelte, parse_svelte, type Root } from '@fuzdev/tsv';

const formatted = format_svelte('<script>\\nconst   x=1\\n</script>');
const ast: Root = parse_svelte('<script>const x = 1;</script>');`;

export const format_example = `import { format_svelte } from '@fuzdev/tsv-format-wasm';

const formatted = format_svelte('<script>\\nconst   x=1\\n</script>');`;

export const parse_example = `import { parse_svelte, type Root } from '@fuzdev/tsv-parse-wasm';

const ast: Root = parse_svelte('<script>const x = 1;</script>');`;

export const no_locations_example = `import { parse_typescript, reconstruct_locations } from '@fuzdev/tsv-parse-wasm';

// span-only AST: start/end offsets, no per-node loc
const ast = parse_typescript('const x = 1;', { locations: false });

// derive line/column back when you need it, no re-parse
reconstruct_locations(ast, 'const x = 1;');`;

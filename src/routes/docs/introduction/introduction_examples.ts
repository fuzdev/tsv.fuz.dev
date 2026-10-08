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

export const locations_example = `import { parse_typescript, create_locator } from '@fuzdev/tsv-parse-wasm';

const source = 'const x = 1;';

// the default AST is span-only: start/end offsets, no per-node loc
const ast = parse_typescript(source);

// loc on every node, the tree acorn's \`locations: true\` returns
const located = parse_typescript(source, { locations: true });

// or look up only the positions you need, over one line table
const locator = create_locator(source, { language: 'typescript' });
locator.position_at(ast.body[0].start); // {line: 1, column: 0}
locator.loc_of(ast.body[0]); // {start: {line, column}, end: {line, column}}`;

// Bundles the MCP edge function and the diagram code it shares with the app into one file,
// for deploying without the Supabase CLI's bundler: `npm run mcp:bundle`, then upload dist-mcp/index.js.
import { build } from 'esbuild';

await build({
  entryPoints: ['supabase/functions/mcp/index.ts'],
  outfile: 'dist-mcp/index.js',
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  mainFields: ['module', 'main'],
  target: 'es2022',
  external: ['npm:*'],
  legalComments: 'none',
});
console.log('Wrote dist-mcp/index.js');

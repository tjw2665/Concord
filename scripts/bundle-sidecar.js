// Bundle the P2P sidecar into a single self-contained file for production.
// Uses esbuild with a require shim so CJS deps (like ws) work in ESM output.
import { build } from 'esbuild';

await build({
  entryPoints: ['scripts/p2p-sidecar.js'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: 'src-tauri/p2p-sidecar-bundle.js',
  target: 'node18',
  // Provide a require() function for CJS packages that call require() on
  // Node.js built-in modules (e.g. ws → require('events')).
  banner: {
    js: [
      "import { createRequire as __cr } from 'module';",
      "const require = __cr(import.meta.url);",
    ].join('\n'),
  },
});

console.log('Sidecar bundled → src-tauri/p2p-sidecar-bundle.js');

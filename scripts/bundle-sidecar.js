// Bundle the P2P sidecar into a single self-contained file for production.
// Uses esbuild with a require shim so CJS deps (like ws) work in ESM output.
//
// node-datachannel is a native C++ addon (used by @libp2p/webrtc) and cannot
// be bundled. It's marked external and shipped alongside the bundle.
import { build } from 'esbuild';
import { cpSync, mkdirSync } from 'fs';
import { join } from 'path';

await build({
  entryPoints: ['scripts/p2p-sidecar.js'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: 'src-tauri/p2p-sidecar-bundle.js',
  target: 'node18',
  // node-datachannel contains a native .node addon — must stay external
  external: ['node-datachannel'],
  // Provide a require() function for CJS packages that call require() on
  // Node.js built-in modules (e.g. ws → require('events')).
  banner: {
    js: [
      "import { createRequire as __cr } from 'module';",
      "const require = __cr(import.meta.url);",
    ].join('\n'),
  },
});

// Copy the native addon module alongside the bundle so Node.js can resolve it
const destModules = join('src-tauri', 'node_modules', 'node-datachannel');
mkdirSync(destModules, { recursive: true });
cpSync('node_modules/node-datachannel', destModules, { recursive: true });

console.log('Sidecar bundled → src-tauri/p2p-sidecar-bundle.js');
console.log('Native addon copied → src-tauri/node_modules/node-datachannel');

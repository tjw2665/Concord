// Copy the current Node.js binary into src-tauri/ so it gets bundled
// with the installer. This makes the app fully self-contained.
import { copyFileSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dest = join(__dirname, '..', 'src-tauri', 'node.exe');

// process.execPath is the path to the currently running node.exe
const src = process.execPath;

const sizeMB = (statSync(src).size / 1024 / 1024).toFixed(1);
console.log(`Bundling Node.js runtime: ${src} (${sizeMB} MB) → src-tauri/node.exe`);

copyFileSync(src, dest);

console.log('Node.js runtime bundled successfully.');

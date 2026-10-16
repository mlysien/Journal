// Bundles the Electron main and preload scripts into dist-electron/.
import { build } from 'esbuild';

export function buildElectron() {
  return Promise.all(['main', 'preload'].map(name => build({
    entryPoints: [`electron/${name}.ts`],
    outfile: `dist-electron/${name}.cjs`,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node20',
    external: ['electron'],
    logLevel: 'warning',
  })));
}

if (import.meta.url === `file://${process.argv[1]}`) await buildElectron();

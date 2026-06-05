import esbuild from 'esbuild';
import { builtinModules } from 'node:module';
import process from 'node:process';

const production = process.argv.includes('--production');

await esbuild.build({
  entryPoints: ['src/obsidian/main.ts'],
  bundle: true,
  external: ['obsidian', 'electron', ...builtinModules, ...builtinModules.map((name) => `node:${name}`)],
  format: 'cjs',
  target: 'es2020',
  platform: 'browser',
  outfile: 'main.js',
  sourcemap: production ? false : 'inline',
  minify: production
});

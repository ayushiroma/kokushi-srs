import esbuild from 'esbuild'
import builtins from 'builtin-modules'

await esbuild.build({
  entryPoints: ['src/main.ts'],
  bundle: true,
  external: ['obsidian', 'electron', ...builtins],
  format: 'cjs',
  target: 'es2022',
  platform: 'browser',
  logLevel: 'info',
  sourcemap: false,
  outfile: 'main.js',
})

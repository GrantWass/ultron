import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  minify: true,
  target: 'es2017',
  treeshake: true,
  sourcemap: false,
  // Code-split on dynamic imports (ESM only) so rrweb is a separate chunk
  // that is never fetched unless sessionReplay: true is set.
  splitting: true,
})

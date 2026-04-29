import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  minify: false,
  splitting: false,
  // The country matrix lives in ../data/stripe-connect-countries.json
  // and is imported via TS resolveJsonModule. tsup inlines it into the
  // bundle, so the published artifact is self-contained.
  loader: { '.json': 'json' },
})

import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  minify: false,
  splitting: false,
  // Intentionally no `external` entries — @settlegrid/client is standalone
  // and isomorphic by design. Any dependency that is not explicitly
  // whitelisted here would end up bundled and, if it pulled in a
  // Node-only module, break the browser surface. Pinning `external: []`
  // (rather than omitting the option) is a deliberate hostile guard:
  // a future diff that adds a Node-only dep must also add it here, at
  // which point the review will catch the browser-compat regression.
  external: [],
  // Fail the build on TypeScript errors — catches accidental use of
  // Node-only globals (`Buffer`, `process`, `require`) at build time.
  // A browser bundle that slips through tsc still risks bundler
  // downstream failures; failing here is the earliest checkpoint.
  onSuccess: undefined,
})

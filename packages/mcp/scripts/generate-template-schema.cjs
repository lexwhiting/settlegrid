#!/usr/bin/env node
/**
 * Post-build hook — reads the built Zod schema, converts it to a
 * JSON Schema draft-07 document via `zod-to-json-schema`, and writes
 * the result to `packages/mcp/schemas/template.schema.json`.
 *
 * Invoked by the `postbuild` npm script so a fresh `npm run build`
 * always yields a matching JSON Schema next to the TS output. The
 * schemas/ directory is also listed in package.json `files` so
 * `npm publish` ships the JSON alongside the dist bundle.
 *
 * Kept as plain CommonJS so there's no tsx / ts-node dependency at
 * build time — we simply `require` the CJS output of tsup.
 */
const fs = require('node:fs')
const path = require('node:path')

const distEntry = path.join(__dirname, '..', 'dist', 'index.js')
if (!fs.existsSync(distEntry)) {
  process.stderr.write(
    `generate-template-schema: dist/index.js not found at ${distEntry}.\n` +
      `This script runs as a postbuild hook and requires tsup output.\n` +
      `Run \`npm --workspace @settlegrid/mcp run build\` (not this script\n` +
      `directly) so the build runs first.\n`,
  )
  process.exit(1)
}

let mcpModule
try {
  mcpModule = require(distEntry)
} catch (err) {
  process.stderr.write(
    `generate-template-schema: failed to require dist/index.js: ${
      err instanceof Error ? err.message : String(err)
    }\n`,
  )
  process.exit(1)
}

const { templateManifestSchema } = mcpModule
if (!templateManifestSchema) {
  process.stderr.write(
    `generate-template-schema: dist/index.js did not export \`templateManifestSchema\`.\n` +
      `Did the re-export in packages/mcp/src/index.ts get removed?\n`,
  )
  process.exit(1)
}

const { zodToJsonSchema } = require('zod-to-json-schema')

const jsonSchema = zodToJsonSchema(templateManifestSchema, {
  name: 'TemplateManifest',
  $refStrategy: 'none',
  target: 'jsonSchema7',
})

const schemasDir = path.join(__dirname, '..', 'schemas')
fs.mkdirSync(schemasDir, { recursive: true })

const outPath = path.join(schemasDir, 'template.schema.json')
fs.writeFileSync(
  outPath,
  JSON.stringify(jsonSchema, null, 2) + '\n',
  'utf-8',
)

process.stdout.write(
  `generate-template-schema: wrote ${path.relative(process.cwd(), outPath)}\n`,
)

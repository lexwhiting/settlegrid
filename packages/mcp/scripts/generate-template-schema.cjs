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

const { templateManifestSchema } = require('../dist/index.js')
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

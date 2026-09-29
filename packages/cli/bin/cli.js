#!/usr/bin/env node
// `sleekstack check [--project <tsconfig>] [--entry <file>...] [--json]`: runs src/check.ts (TypeScript, via jiti).
const { createJiti } = require('jiti')

createJiti(__filename)
  .import('../src/check.ts')
  .then(({ main }) => { process.exitCode = main(process.argv.slice(2)) })
  .catch((err) => { console.error(err); process.exitCode = 2 })

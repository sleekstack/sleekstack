#!/usr/bin/env node
// `sleekstack check [--project <tsconfig>] [--entry <file>...] [--json]` runs src/check.ts (TypeScript, via jiti).
const pkg = require('../package.json')
const args = process.argv.slice(2)

if (args[0] === 'check') {
  require('jiti')
    .createJiti(__filename)
    .import('../src/check.ts')
    .then(({ main }) => { process.exitCode = main(args) })
    .catch((err) => { console.error(err); process.exitCode = 2 })
} else if (args[0] === '--version' || args[0] === '-v') {
  console.log(pkg.version)
} else {
  console.log(`${pkg.name} v${pkg.version}\n\nUsage: sleekstack <command>\n\nCommands:\n  check       Validate the static dependency graph (--project <tsconfig>, --entry <file>..., --json)\n  --version   Show version\n  help        Show this help`)
  if (args.length && args[0] !== 'help' && args[0] !== '--help') process.exitCode = 2
}

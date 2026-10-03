#!/usr/bin/env node
// `sleekstack check ...` and `sleekstack explain <CODE>` run src/check.ts (TypeScript, via jiti); exit codes are documented there.
const pkg = require('../package.json')
const args = process.argv.slice(2)

if (args[0] === 'check' || args[0] === 'explain' || args[0] === 'init-agents') {
  require('jiti')
    .createJiti(__filename)
    .import('../src/check.ts')
    .then(({ main }) => { process.exitCode = main(args) })
    .catch((err) => { console.error(err); process.exitCode = 2 })
} else if (args[0] === '--version' || args[0] === '-v') {
  console.log(pkg.version)
} else {
  console.log(`${pkg.name} v${pkg.version}\n\nUsage: sleekstack <command>\n\nCommands:\n  check       Validate the static dependency graph (--project <tsconfig>, --entry <file>..., --json)\n  explain     Print an error code's rule, fixes and docs path (explain <CODE>)\n  init-agents Add a block to AGENTS.md pointing at @sleekstack/kit/llms.md (--file <path>)\n  --version   Show version\n  help        Show this help`)
  if (args.length && args[0] !== 'help' && args[0] !== '--help') process.exitCode = 2
}

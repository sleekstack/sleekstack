#!/usr/bin/env node

// Minimal CLI entry for the `sleekstack` package.
// Keep this file small so publishing the package is straightforward.

const pkg = { name: 'sleekstack', version: '0.0.1' };

function help() {
  console.log(`${pkg.name} v${pkg.version}`);
  console.log('');
  console.log('Usage: sleekstack <command>');
  console.log('');
  console.log('Commands:');
  console.log('  --version   Show version');
  console.log('  help        Show this help');
}

async function main(argv) {
  const args = argv.slice(2);
  if (args.length === 0 || args.includes('help') || args.includes('--help')) {
    help();
    return;
  }
  if (args.includes('--version') || args.includes('-v')) {
    console.log(pkg.version);
    return;
  }

  // Placeholder: dispatch to actual workspace CLI or show message
  const cmd = args[0];
  console.log(`Command '${cmd}' is not implemented in this placeholder CLI.`);
  console.log('Consider installing @sleekstack/cli from the org for the full experience.');
}

main(process.argv).catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});


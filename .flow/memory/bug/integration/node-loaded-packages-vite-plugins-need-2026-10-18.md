---
title: Node-loaded packages (Vite plugins) need NodeNext and .js imports
date: "2026-10-18"
track: bug
category: integration
module: packages/ui-vite/src/index.ts
tags: [vite, esm, nodenext, jsx-pragma]
problem_type: integration
symptoms: dist/index.js import fails with ERR_MODULE_NOT_FOUND in vite.config
root_cause: Bundler-style extensionless imports copied into a package Node loads directly
resolution_type: fix
---

## Problem
`@sleekstack/ui-vite` copied the repo's library layout (tsc, `moduleResolution: Bundler`, extensionless relative imports). Library packages are consumed by bundlers, but a Vite plugin is loaded by Node from `vite.config.ts`, and `dist/index.js` importing `./jsx` threw `ERR_MODULE_NOT_FOUND`. The fixture test imported source, so it never saw this. Review also caught `code.includes('@jsxImportSource')` treating plain text as a pragma.

## What Didn't Work
Extensionless imports (repo convention) and a whole-file substring check for the pragma.

## Solution
packages/ui-vite/tsconfig.json sets `module`/`moduleResolution: NodeNext`, so tsc rejects extensionless relative imports (TS2835); sources import `./jsx.js`. Pragma detection reads only the leading comments, matching oxc (a pragma after the first statement is ignored). The pragma is prepended through magic-string with a generated map.

## Prevention
Any package Node loads directly (Vite plugins, CLIs) uses NodeNext resolution; check with `node --input-type=module -e "await import('./dist/index.js')"` after build.

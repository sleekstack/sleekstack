---
title: sleekstack() option must reach every bundled plugin that reads it
date: "2026-10-22"
track: bug
category: integration
module: packages/ui-vite/src/index.ts
tags: [ui-vite, vite-plugin, options, serverDir]
problem_type: integration
symptoms: "custom serverDir: false ServerFileInClientGraph from the bundled analyze plugin"
root_cause: new option threaded to serverServices() only; analyze() kept the analyzer default
resolution_type: fix
related_to: [bug/integration/analyzer-reads-every-file-route-through-2026-10-20, bug/integration/node-loaded-packages-vite-plugins-need-2026-10-18]
---

## Problem
fn-68.2 added a `serverDir` option to `ServerServicesOptions`. `sleekstack()` passed its options to `serverServices()` but called `analyze()` with no arguments, and that plugin's analyzer called `analyzeServerServices({ project })` with the default `server`. With `sleekstack({ serverDir: 'lib' })`, a client import of `server/_defaults.ts` failed the build with a false `ServerFileInClientGraph`. The new tests covered only the standalone `serverServices()` plugin, so they missed it. The codex review caught it in round 1.

## What Didn't Work
The new option was tested only on the plugin that declared it. The composite plugin had no test with the option set.

## Solution
`analyze(run, serverDir?)` in packages/ui-vite/src/analyze.ts passes the directory to `analyzeServerServices({ project, serverDir })`. `sleekstack()` in packages/ui-vite/src/index.ts calls `analyze(undefined, options.serverDir)`. A test builds `sleekstack({ serverDir: 'lib' })` and checks that `server/_defaults.ts` is allowed and `lib/_defaults.ts` is rejected with the analyzer's code.

## Prevention
When you add an option to one plugin in `sleekstack()`, grep that function for every other plugin that reads the same concept (the analyzer runs the same Server Service pass). Add one test through `sleekstack({ option })` and not only through the standalone plugin.

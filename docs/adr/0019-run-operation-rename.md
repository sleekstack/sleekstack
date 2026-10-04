# 0019. `kit/next`'s inline runner is `runOperation`; `effect` means the side-effect Layer only

## Status

Accepted

## Context

`effect` named two unrelated things: `effect(fn, deps?)` from `@sleekstack/kit` (a side-effect Layer, graph node `effect:<name>`) and `effect(gen, opts?)` from `@sleekstack/kit/next` (runs a Kit Operation inline). Agents and readers resolving a call by name alone picked the wrong one.

## Decision

The `kit/next` inline runner is renamed `runOperation`. `effect` stays exported from `@sleekstack/kit/next` as a `@deprecated` alias for one release; the analyzer reads both as the same action call. A kit test fails if two entry points export one name with different declarations (deprecated aliases are listed explicitly).

## Consequences

- One public name, one meaning. `sleekstack check` output for existing apps is unchanged.
- The alias is removed in the next release; callers switch the import name only.

## Rejected

Renaming kit's side-effect `effect()` instead. It is the main-entry API and appears as `effect:<name>` in the analyzer graph, so renaming it would change graph ids users already see.

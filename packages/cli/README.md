# sleekstack (CLI)

The `sleekstack` executable. `sleekstack check` validates the dependency graph at build time through
[`@sleekstack/analyze`](../analyze), without importing or running app code (ADR 0010).

```bash
sleekstack check [--project <tsconfig>] [--entry <file>...] [--json] [--lenient]
sleekstack explain <CODE>
```

- Roots: each `--entry` file, else `sleekstack.entry` in the nearest package.json, else every `configureRuntime` call
  outside test files. Each root is validated as its own graph. `--entry` is an allowlist: other `configureRuntime`
  calls are not checked.
- A project whose nearest package.json lists `@sleekstack/ui` also gets the component pass: each `mount` tree is
  checked and counts as a root, its errors print as `file:line code: message`, and `--json` adds `components`.
  Other projects see no change.
- Each error prints as `file:line CODE: message`, followed by indented `fix:` lines (most likely first) and a
  `docs:` line. `--json` carries the same `fix` and `docs` fields on every error.
- `sleekstack explain <CODE>` prints the code's rule, fixes and docs path; an unknown code exits 2.
- Exit codes are defined in one place: the header of `src/check.ts`.
- `--json` writes only JSON to stdout (each root's graph and errors).
- Declarations the analyzer cannot read (`any`, widened arrays, non-literal keys) fail the check; there is no opt-out.

Run it as a `prebuild` script and in CI before the tests. `typescript` is a peer dependency.

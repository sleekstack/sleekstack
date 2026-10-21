---
satisfies: [R3, R5]
---
# fn-66-server-services-di-style-server.4 analyze: method types to a Schema description, `ServerServiceTypeNotSerializable`

## Description
Converts each method's parameter, success and error types into a small closed, JSON-serializable description the generator prints as Schema code. Anything outside the supported subset is a diagnostic naming the offending member, never a guess.

**Size:** M
**Files:** packages/analyze/src/typeSchema.ts (new), packages/analyze/src/serverServices.ts, packages/analyze/src/errorCodes.ts, packages/analyze/src/index.ts, packages/analyze/src/__tests__/typeSchema.test.ts (new), apps/docs/content/docs/errors.mdx
**Touches:** [packages/analyze/src/**, apps/docs/content/docs/errors.mdx]

### Approach
- A closed union description: string, number, boolean, null, undefined, void, literal (string, number, boolean), union, array (readonly or mutable), object with named properties (each optional or not), and `taggedError` (class name, the contract file it is imported from, fields). Export the type from `@sleekstack/analyze` for the generator.
- Work from the checker's resolved types so aliases, interfaces and intersections of object types resolve. A `Data.TaggedError` subclass is recognized by its base class symbol; only error positions may use it.
- `ServerServiceTypeNotSerializable` names the type text and the property path to the offender: `Date`, `Map`, `Set`, class instances, functions, `bigint`, `symbol`, `unknown`, `any`, intersections with non-objects, and recursive types. Detect recursion with a visited set so it reports instead of overflowing.
- Success is `A` of the method's `Effect.Effect<A, E, never>`; the error is the union of tagged error classes in `E`, and a non-tagged member is not serializable.
- Add the third code's table row and `errors.mdx` entry.

### Investigation targets
**Required** (read before coding):
- `packages/analyze/src/serverServices.ts` (task 3) — where the raw types arrive
- `packages/analyze/src/extract.ts` — existing checker type walking to reuse, not repeat
- `packages/start/src/service.ts` (task 1) — what `taggedError` expects, so the description carries enough

### Key context
A TS type cannot say `NonEmptyString` or a length, so the generated Schema is exactly as strict as the type; ADR 0051 records this, and constrained inputs stay `serverFn`.

## Acceptance
- [ ] Table-driven test: one fixture type per supported kind yields the expected description (primitives, literals, unions, readonly arrays, optional properties, nested objects, void input, tagged error with fields).
- [ ] Table-driven test: one fixture per unsupported kind (`Date`, `Map`, `Set`, class instance, function, `bigint`, `symbol`, `unknown`, `any`, recursive type, non-tagged error) yields `ServerServiceTypeNotSerializable` with file:line and the member path.
- [ ] A recursive type reports and does not hang or overflow.
- [ ] `errors.mdx` and the table have the new code; `errorCodes.test.ts` passes.
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/analyze --filter=sleekstack --filter=@sleekstack/ui-vite` passes.

## Done summary
Added `methodSchema` in packages/analyze/src/typeSchema.ts. It turns a method's input, success and error types into a closed, JSON-serializable `MethodSchema`. The supported kinds are string, number, boolean, null, undefined, void, literal, union, array (with a readonly flag) and object (each property carries an optional flag). Errors become a `TaggedErrorSchema[]` holding the class name, the declaring file relative to the tsconfig directory, and the fields read from the `Data.TaggedError('X')<Fields>` type argument. `Redirect` and `NotFound` in E are dropped, because the wire's control path carries them. `analyzeServerServices` now attaches `schema` to each method. A method outside the subset reports `ServerServiceTypeNotSerializable` at the method line, naming the member path (for example `input.children[]`) and the type text, and it is left out of `methods`. The reported cases are Date, Map, Set and other lib objects, class instances, a tagged error outside the error position, functions, bigint, symbol, unknown, any, tuples, index signatures, intersections with a non-object, recursive types (caught by a path stack) and non-tagged errors. The `TypeSchema`, `PropertySchema`, `TaggedErrorSchema` and `MethodSchema` types are exported from `@sleekstack/analyze`.

The code has an ERROR_CODES row and an errors.mdx row. packages/cli/llms.md was regenerated with `UPDATE_LLMS=1` (now 7134 bytes). Tests are in packages/analyze/src/__tests__/typeSchema.test.ts, with the fixtures server-service-types and server-service-not-serializable. There is one table row per supported kind, and one per unsupported kind with file:line and member path. Union members are listed in the checker's order. `taggedErrorBase` is shared with serverServices.ts's file-shape check.

Tier: session (jev-unavailable(no_key)); project routing block pins implementer opus at medium (actual_model: claude-opus-5-5)

baseline: green

stage: impl-review - skipped(config: REVIEW_MODE=none)
## Evidence
- Commits: c79e82d21f620565d2545c5bcbf39ed98fff2690
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/analyze --filter=sleekstack --filter=@sleekstack/ui-vite
- PRs:
---
satisfies: [R3, R4, R5, R11, R12]
---
# fn-43-typed-dom-for-sleekstackui.2 Typed events and refs

## Description
Typed events and refs. Contract and rationale are in the parent spec (R-IDs above).

**Size:** M
**Files:** packages/ui/src/jsx-types.ts, packages/ui/src/node.ts (Ref), type tests
**Touches:** [packages/ui/src/jsx-types.ts, packages/ui/src/__tests__/*.test-d.ts]

### Approach
- Event props named `on${Capitalize<event>}` over the platform event map; the runtime lowercases the part after `on`, so multi-word events (onPointerDown) must map back to their map key.
- Handler type = function | generator | Effect | `defineHandler` value, leaving E and R open (analyzer owns them, ADR 0026); event parameter has `currentTarget` narrowed to the tag's element.
- `ref` is `Ref<ElementOfTag>` and rejects a box of another element type; string values on `on*` are a type error.

## Acceptance
- [ ] Handler receives the real event with a narrowed currentTarget; wrong member access fails (R3)
- [ ] Function, generator, Effect and defineHandler values all accepted (R4, R11)
- [ ] ref accepts the matching useRef box only (R5)
- [ ] A string on an on* prop fails type-check (R12)


## Done summary
Host JSX `on*` props are typed over the element's event map: `currentTarget` is narrowed, multi-word names are camel-cased, values may be a function, generator, Effect, or `defineHandler` (only on bubbling events), and strings are rejected. `ref` takes only the matching element's `Ref`, which is now invariant. Tests are in packages/ui/src/__tests__/jsx-types.test-d.tsx.

Follow-up: the analyzer does not read generator event closures. The integration draw flagged this, but it predates this task.

stage: impl-review - ran (codex fan-out NEEDS_WORK -> re-review SHIP)
## Evidence
- Commits: 00cf61608a8e6a3628b123d51e5b6642bd49f546, 557db09f80b4468c8a166d3fa11823df15e8ddf0
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/ui..., pnpm typecheck
- PRs:
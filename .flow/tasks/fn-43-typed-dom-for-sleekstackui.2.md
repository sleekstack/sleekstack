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
TBD

## Evidence
- Commits:
- Tests:
- PRs:

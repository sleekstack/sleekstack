# Native atoms, modeled on effect-atom, instead of depending on it

SleekStack ships its own atoms (`Atom`, `Result`, `AtomStore` in `@sleekstack/core`, hooks in `@sleekstack/react`, a dependency-array facade in `@sleekstack/kit`) instead of depending on `@effect-atom/atom` and `atom-react`. The design follows effect-atom 0.6.0: lazy keyed nodes, push invalidation with pull recompute, `Result` with a `waiting` flag, `family`, `keepAlive` and idle-TTL disposal. The difference is where services come from: effect-atom runs atoms on a separate `Atom.runtime(layer)`, while SleekStack gives each `LayerProvider` an `AtomStore` bound to its scope, so atoms resolve Tags through the same graph as `useService`, with the same shadowing and privacy, and are disposed with that scope.

## Considered options

- **Depend on effect-atom**: rejected. It keeps a second service runtime beside the SleekStack graph, with its own lifecycle, and effect-atom 0.7 requires effect ^3.22.1 while the repo is on 3.21.2.
- **Depend on effect-atom and bridge its runtime to our scopes**: rejected. The bridge would own both lifecycles and still force the effect bump.
- **Native atoms modeled on effect-atom** *(chosen)*: one service graph and one lifecycle, no forced bump, and effect-atom users find the same concepts. The cost is maintaining the store algorithm ourselves.

## Consequences

- In v1 atoms were client only (`AtomsClientOnly`), with no SSR hydration, persistence or devtools. ADR 0016 adds server rendering and hydration and removes `AtomsClientOnly`.
- The kit hooks suspend and throw `SleekStackError` instead of exposing `Result`, to match kit `useService`.

# Atoms render on the server and hydrate from opt-in serializable snapshots

Atoms render during a server render and hydrate on the client (amends ADR 0008, which left atoms client only). An atom crosses the wire only when it opts in with `Atom.serializable(atom, { key, schema })` (value kind) or `Atom.serializable.result(atom, { key, schema })` (result kind, the schema describes the `Success` value). The kind is explicit, so seeding knows before `read` runs whether to seed `A` or `Result.success(A)`. `dehydrate(store)` sends value atoms always and result atoms only on `Success`; `hydrate(store, snapshot)` records seeds that a node takes on first read. Keys are unique per store (`DuplicateAtomKey`).

On the server, `renderWithAtoms` in `@sleekstack/react` owns the request: each `LayerProvider` opens its scopes in a request registry keyed by `useId`, with the same scope construction as the client, and the wrapper closes them all LIFO when the render ends (completion, shell error, error or abort). Next owns its render, so there a server `LayerProvider` without a wrapper serves atoms from an inert store, and `prefetchAtoms` in `@sleekstack/next` loads values in the server component inside one `runEffect` call and hands the snapshot to the client provider's `hydrate` prop. The snapshot travels in an `<AtomsSnapshot />` JSON script tag keyed by the provider's `snapshotId`.

## Considered options

- **Serialize every atom**: rejected. It leaks server-only values and makes the payload unbounded; effect-atom makes the same opt-in trade-off.
- **Send `Initial` or `Failure`**: rejected. It freezes a transient state on the client.
- **Infer result kind from `Atom.make`**: rejected. Derived functions returning Effects and plain values share one branch.
- **A global key registry checked at `Atom.serializable`**: rejected. It breaks HMR and module re-evaluation; uniqueness is per store.
- **Provider-owned server scope**: rejected. Render completion and abort are not observable from a component, since no effects or cleanup run on the server.
- **Reuse the parent store for a nested server provider**: rejected. It drops the provider's `provide` entries and shadowing.
- **Identify server providers by props or shape, or reuse parked-scope adoption**: rejected. Retries re-render with new props, and the module-global shape matching can hand one request's scope to another. `useId` is position-stable within a request.
- **A per-request store in the Next client-component SSR pass**: rejected. Next exposes no completion hook to that pass; `after()` and `cache()` live in the server-component graph, which shares only serialized props with it.
- **One unkeyed transport tag per page**: rejected. Sibling roots would seed from each other's snapshot.
- **Wrapper-owned request registry, inert store plus `prefetchAtoms` for Next, opt-in serializable atoms with an explicit kind** *(chosen)*.

## Consequences

- `AtomsClientOnly` is removed. Reading an atom outside a `LayerProvider` still throws the existing error.
- `renderToString` cannot wait: a subtree still suspended renders its Suspense fallback and unsettled atoms render `Initial`. Stream mode waits.
- A snapshot holds what was built when `AtomsSnapshot` rendered (tree order); late-arriving streamed atoms are not transferred.
- Query hydration (ADR 0014) stays separate: `HydrateQueries` keeps its own `Dehydrated` format and `updatedAt` merge rule, and atom snapshots use their own tag. Under the wrapper, `HydrateQueries` seeds the provider's registry-acquired store on the server.
- The kit has no serializable atoms yet, so kit atom values render on the server but are not transferred.

Note (fn-25): `@sleekstack/ui` host trees use the same core `dehydrate` / seed path: `renderToString` writes it to a `<script data-sleek-hydrate>` and `hydrateMount` seeds the store before the first run (ADR 0015, Amendment: hydration).

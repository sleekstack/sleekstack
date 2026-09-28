# @sleekstack/react

The React adapter: a Suspense-native, StrictMode-safe `LayerProvider` and `useService`.

## Atoms

Atoms (`Atom.make` from `@sleekstack/core`) are reactive client state modeled on effect-atom. Each `LayerProvider` owns an `AtomStore`, so atom state is per provider and is disposed when the provider unmounts, and Effect atoms resolve their services from that provider's scope. The hooks are `useAtomValue`, `useAtomSet`, `useAtom`, `useAtomRefresh` and `useAtomSuspense`; they are client only and throw `AtomsClientOnly` during a server render. See the Atoms guide.

Guides and the generated API reference live in the docs site ([`apps/docs`](../../apps/docs/README.md)): run `pnpm --filter docs dev` and open http://localhost:3000/docs.

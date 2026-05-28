# SleekStack

A full-stack Effect-native runtime architecture for React and Next.js.

---

## Vision

SleekStack aims to provide:

- structured concurrency
- functional dependency graphs
- request-scoped environments
- deterministic resource ownership
- Suspense-native services
- unified frontend/backend runtime architecture

without:

- decorators
- runtime reflection
- mutable DI containers
- singleton-heavy architecture
- hidden globals

---

## Philosophy

Traditional dependency injection frameworks treat services as:

```txt
Objects created by containers.
```

SleekStack treats services as:

```txt
Managed runtime environments.
```

This enables:

* explicit resource ownership
* request isolation
* deterministic cleanup
* cancellable async systems
* composable service graphs
* runtime introspection

---

## Built On

* React
* Next.js App Router
* Effect TS

---

## Planned Packages

```txt
@sleekstack/core
@sleekstack/react
@sleekstack/next
@sleekstack/rpc
@sleekstack/query
@sleekstack/devtools
@sleekstack/testing
```

---

## Example Direction

```ts
const auth = useService(Auth)
```

```tsx
<LayerProvider layer={AuthLayer}>
  <App />
</LayerProvider>
```

---

## Current Status

SleekStack is currently in early experimental development.

The primary goal right now is validating:

* React runtime integration
* Suspense semantics
* request-scoped environments
* Effect interoperability
* deterministic cleanup

---

## Long-Term Goal

SleekStack aims to become:

> A unified runtime architecture for full-stack TypeScript applications.

---

## License

MIT


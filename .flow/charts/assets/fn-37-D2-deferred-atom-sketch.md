# Sketch: useDeferredAtom (throwaway)

```tsx
const query = useAtom(searchAtom)
const deferred = useDeferredAtom(searchAtom)
// list reads `deferred`; input reads `query`
```
Shown to the user as an option preview; selected over skipping it. Evidence only, not implementation.

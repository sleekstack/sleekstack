# Sketch: loader is an Effect under Pending (throwaway)

```tsx
const project = route('/projects/:id', {
  loader: ({ id }) => ProjectRepo.get(id),
  action: saveProject,   // same shape as <form action>
})
function Page() {
  const p = yield* useLoader(project)
  ...
}
```
Shown to the user as an option preview; selected over loaders as atoms. Evidence only, not implementation.

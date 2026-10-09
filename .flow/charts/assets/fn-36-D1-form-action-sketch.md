# Sketch: form action as a handler on the form (throwaway)

```tsx
const save = function* (data: FormData) {
  yield* Api.save(Schema.decode(Form)(data))
}

function Edit() {
  const status = useFormStatus()   // derived atom
  return <form action={save}>
    <input name="title" />
    <button disabled={status.pending}>Save</button>
  </form>
}
```
Shown to the user as an option preview; selected over an explicit `useAction` atom. Evidence only, not implementation.

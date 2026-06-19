# Overrides are done by shadowing in `provide` — no dedicated overrides API

To replace a transitive dependency (e.g. substituting `MockAuthModule` for `AuthModule` in tests), users put the replacement directly in the `provide` array. SleekStack resolves conflicts by giving precedence to the entry that satisfies a given Tag most locally. There is no separate `overrides` prop.

## Considered options

- **Explicit `overrides` prop** (`overrides={new Map([[AuthModule, MockAuthModule]])}` or similar): rejected because it adds a second mental model for what is logically the same operation as providing a layer, and `new Map(...)` syntax is unfamiliar in JSX.
- **Tuple array** (`overrides={[[AuthModule, MockAuthModule]]}`): same problem as above — a parallel API for something the `provide` array already handles.
- **Shadowing via `provide`** *(chosen)*: a replacement in the `provide` array shadows the transitive pull-in from a Module's `imports`. One mechanism, one mental model. Testing, Storybook, and subtree customization all use the same pattern.

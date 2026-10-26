# 0057. Served records: `export default records(Record)` serves a Record Type, and the browser adapter Layer is generated

## Status

Proposed (draft). Amends ADR 0053: its rejection of a `method(...)` helper stands, and the `records(...)` call form is the one exception. Amends ADR 0056's "a file is one form or the other" for a `records(...)` default export. Extends ADR 0041 (records layer) with read-only fields, `record.change` and two package-defined errors. Planned in spec fn-70.

## Context

A Record Type (ADR 0041) is the client half of a fullstack data model: the Identity Map, Drafts, `commit`, and a Record Adapter that the app writes by hand per type. The server half is missing, and nothing ties the two wire shapes together: a browser adapter and the REST route it calls agree only by convention.

Django REST framework solves this with a model behind the database, a serializer that is the wire shape, a viewset that serves the operations and a router that derives the URLs. The parts exist here: the record's fields are the wire shape, the adapter Tag is the seam to the database, a file-routed Controller (ADR 0053) serves a path, Layer Files (ADR 0054) are server-only, and the build already generates browser Layers for Server Services. What is missing is the one line that serves a record and the generated browser adapter.

## Decision

- **One adapter Tag, a different Layer per side,** exactly as a Server Service (ADR 0051). The record module and its adapter Tag are client-safe and import nothing server-side. On the server the Tag is provided by an app Layer File (a `*.layer.ts`, server-only by ADR 0054), in-process for the Controller, SSR and loaders. In the browser it is provided by a generated HTTP Layer, part of the browser Layer `virtual:sleek/server` already exports. The two Layers never meet in one composition, so there is no `LayerFileConflict`.
- **No persistence on the record.** `defineRecord` gains no `table:` option and no server-only key: the database is reachable only from a Layer File, so `ServerFileInClientGraph` guards the boundary and nothing rests on tree-shaking.
- **`records(record)` from `@sleekstack/start` is the default export of a Controller file** whose path ends in exactly `[id]` (ids are strings and every record has an `id` field). It serves two methods of the file's route:
  - `GET`: the adapter's `find(id)`, answered as the record's wire form (its fields' Encoded type) as JSON, 200.
  - `PATCH`: the body decoded with `record.change`, then the adapter's `save(id, change)`, answered as the wire form, 200.
  - `HEAD` and `OPTIONS` follow the Controller defaults (ADR 0053); any other method is `MethodNotAllowed`.
- **The served methods call the adapter Tag directly** and answer the wire form. They never call `record.find` or `record.commit`, which write the Identity Map, a client Store service.
- **Errors are package-defined.** `RecordNotFound { type, id }` and `RecordRejected { type, id, message }` (`@sleekstack/model`) are tagged errors and the whole failure type of a derived adapter. A `RecordNotFound` answers 404 with `{ "_tag": "RecordNotFound", "type", "id" }`; a `RecordRejected` answers 422 with `{ "_tag": "RecordRejected", "type", "id", "message" }`. Any other failure reaches `wrap` as for every Controller. The success body is bare, as in DRF. A different envelope or error shape means a hand-written adapter.
- **`readOnly(schema)` marks a record field** the client reads and never writes (`createdAt`, a server counter); `id` is read-only without a marker. Such a field stays in the record and the wire form, and is absent from the Draft's change body, from `RecordChange` and from `record.change`.
- **`record.change` is the Schema of a PATCH body:** every field but `id` and the read-only ones, in wire form, exactly the `RecordChange` that `commit` sends. Every editable field is required; there is no partial PATCH and no PUT.
- **The browser adapter is generated from the route.** For every served record the build generates a Layer providing the record's adapter Tag that calls `GET <route>` and `PATCH <route>` with the id filled in, a JSON body and `Content-Type: application/json`. 404 is `RecordNotFound`; 400 and 422 are `RecordRejected` (`message` from the body's `message` field, else the status text). Any other status, a network failure, or a body that is not a JSON object is a defect. Renaming the Controller file changes the generated path and nothing else.
- **The Analyzer reads the call.** It recognizes `export default records(X)` in a Controller file, resolves `X` statically to its `defineRecord` call and the adapter Tag in it, and reports the Tag as a requirement of the served methods, so a Tag nobody provides is the existing `MissingDependency`. `sleekstack check` and the Vite plugin share that read. `ControllerDecl.kind` gains `'records'`.
- **A third Controller form.** The default export is a call, not a class, so named Controller Method exports beside it stay ordinary Controller Methods (this amends ADR 0056's one-form rule), except `GET` and `PATCH`, which collide with the served methods.
- **Authorization lives in the Layer File's implementation,** which runs with the request services (ADR 0052) and fails with a tagged error that `wrap` maps. There is no `authorize` hook.

## Consequences

- An app gets `record.find`, `commit` and `useDraft` against its own database by writing the record, one Layer File and a one-line Controller, with no REST route, adapter or client by hand. The two wire shapes come from one Schema and cannot drift.
- New public names: `readOnly` and `RecordNotFound`, `RecordRejected` (`@sleekstack/model`), `records` (`@sleekstack/start`), and `record.change` on every `RecordDefinition`, whose type is the Schema of `RecordChange`.
- New `AnalyzeCode` values, each with its table row: `RecordsRouteShape` (the path does not end in exactly `[id]`; the default export is not a `records` call from `@sleekstack/start` whose argument resolves statically to a `defineRecord` call; the record has no `adapter`; its fields need a Service) and `RecordsMethodCollision` (the file also exports a named `GET` or `PATCH`).
- A record whose Schemas need a Service (`Schema.Struct.Context<F>` not `never`) cannot be served: the served methods decode and encode with no Service in scope.
- The server stays thin. A `save` that answers another `id` is not checked: `commit` already fails with `SaveResponseError` (ADR 0041). An answer that does not encode is a defect (empty 500), as for any Controller. A PATCH body's unknown keys and read-only fields are dropped by decode; a missing editable field is a `ParseError` (400 `DecodeError` unless `wrap` maps it).
- The hand-written adapter and named Controller Methods stay the escape hatch for any other wire.
- Showcase serves its `User` record and keeps `Post`'s hand-written adapter beside it. Realworld is untouched: it has no records, and its wire (slug id, `{ article }` envelope) is not derivable.
- Not in v1: `list`, `create`, `remove`, pagination or filtering; `writeOnly` or server-only fields; partial PATCH; inverse relationships; optimistic shared writes and live records (ADR 0041's deferral stands).

## Rejected

- **A `table:` option on the record, or a server-only thunk key.** Either puts server code one tree-shake away from the browser bundle.
- **A second, server-only `RecordStore` Tag.** One Tag with a Layer per side is the Server Service pattern; a second Tag is a second seam to keep in step.
- **Written-out methods per record** (about four lines per route). Kept as the escape hatch, since named exports still work, not as the way to serve a record.
- **A manifest that generates Controllers** (`server/records.ts`). It needs its own ADR and a generator; a possible follow-up if the one-line file feels repetitive.
- **ADR 0053's reason against a `method(...)` helper applied here.** That rejection rested on the Schemas sitting in a server-only file the browser client must import. Here they come from the record, a client-safe module, so the reason does not apply.
- **An app-supplied error Schema.** A second shape to keep in step with the adapter; a custom shape means a hand-written adapter.
- **`records` in `@sleekstack/model`.** `@sleekstack/start` owns Controllers; `model` stays free of request-serving code.
- **A partial PATCH as in DRF's partial update.** The Draft's `toDto` sends every editable field and the adapter's change type is `RecordChange`; deferred.

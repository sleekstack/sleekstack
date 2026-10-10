# 0033. Form actions: a submit handler that gets the form's data

## Status

Accepted. Extends ADR 0026 (handler forms) to a form's `action` prop. Chart fn-36, D1 and D3.

## Context

Host forms had only `onSubmit`: each one called `preventDefault`, read its inputs by hand and could run twice when submitted twice. React 19 made `<form action={fn}>` the standard way to handle a submit.

## Decision

A form's `action` prop takes a function, a generator, an Effect or a `defineHandler` value (a string is still a URL). On submit:

- `onSubmit` runs first, then the action; the browser's default submit is always prevented.
- The action gets an `ActionEvent`: `{ type: 'submit', formData }`, where `formData` is `new FormData(form, submitter)` built at dispatch on the client. A closure and a resumed handler get the same value; the server never emits form data. File inputs are out of scope.
- A second submit interrupts the running action (latest wins). On the resumed path this holds for every delegated submit handler.
- A Promise result is a `TypeError` reported to `onError`: return an Effect or use a generator.
- The form is not reset after the action.
- A resumed action is `defineHandler('id', (e: ActionEvent) => ...)`: annotating the parameter types `formData` as present, and such a handler fits only `action`. A resumed submit runs one handler, so a `defineHandler` on `onSubmit` or `action` must be the form's only submit handler (a `TypeError` at render otherwise); a string `action` is still a URL beside it.

Submitting with no JavaScript needs a server endpoint and is out of scope.

## Consequences

- One submit path for closures and resumed handlers; the action's `E` / `R` are read like any handler's.
- Pending, result and optimistic state build on this (fn-46 task 2), as atoms.

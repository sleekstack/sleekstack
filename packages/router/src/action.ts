import type { FormAction } from '@sleekstack/ui'

/**
 * Declares a route's action: a function (returning an Effect, a generator or nothing), a generator function, an
 * Effect, or a `defineHandler` value, as a form `action` takes (R5). Pass it as the route form's `action` prop.
 */
export const action = <A extends FormAction>(run: A): A => run

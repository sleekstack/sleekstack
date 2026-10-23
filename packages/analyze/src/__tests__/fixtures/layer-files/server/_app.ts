import type { Cause } from 'effect'

export const onError = (cause: Cause.Cause<unknown>) => console.error(cause)
export const stray = 1 // @error ServerFileShape
export type Erased = string

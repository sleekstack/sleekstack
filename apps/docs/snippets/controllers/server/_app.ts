import { Cause } from 'effect'

/** The Server Root: its one export is the app's error sink. `start({ onError })` wins over it. */
export const onError = (cause: Cause.Cause<unknown>) => console.error(Cause.pretty(cause))

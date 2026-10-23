import type { Cause } from 'effect'

/** The causes the error sink received, for the test to read. */
export const onError = (cause: Cause.Cause<unknown>): void => {
  ;((globalThis as { layerFileCauses?: unknown[] }).layerFileCauses ??= []).push(cause)
}

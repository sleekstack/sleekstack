/**
 * packages/query/src/key.ts
 *
 * Canonical query keys: stable JSON with sorted object keys, so two fresh equal tuples map to one atom.
 */

import { Data } from 'effect'

/** Error code `InvalidQueryKey`: a query key holds a value with no stable JSON form (function, BigInt, symbol, cycle). */
export class InvalidQueryKey extends Data.TaggedError('InvalidQueryKey')<{
  readonly key: unknown
  readonly message: string
}> {}

/**
 * Serializes `key` to its canonical string: JSON with object keys sorted, `toJSON` honoured and array holes as `null`.
 *
 * @param key - A JSON-serializable value (usually a tuple).
 * @returns The canonical string.
 * @throws InvalidQueryKey when `key` contains a function, BigInt, symbol or cycle.
 *
 * @example
 * ```ts
 * canonicalKey(['todo', { b: 1, a: 2 }]) // '["todo",{"a":2,"b":1}]'
 * ```
 */
export const canonicalKey = (key: unknown): string => {
  const seen = new Set<object>()
  const fail = (what: string): never => {
    throw new InvalidQueryKey({ key, message: `Query key is not serializable: ${what}` })
  }
  const walk = (value: unknown): string => {
    if (value === null) return 'null'
    switch (typeof value) {
      case 'string':
      case 'boolean':
        return JSON.stringify(value)
      case 'number':
        return Number.isFinite(value) ? JSON.stringify(value) : 'null'
      case 'undefined':
        return 'null'
      case 'function':
      case 'bigint':
      case 'symbol':
        return fail(typeof value)
    }
    if (typeof (value as { toJSON?: unknown }).toJSON === 'function') return walk((value as { toJSON: () => unknown }).toJSON())
    const obj = value as object
    if (seen.has(obj)) return fail('cycle')
    seen.add(obj)
    const out = Array.isArray(obj)
      ? `[${Array.from(obj, walk).join(',')}]`
      : `{${Object.keys(obj)
          .filter((k) => (obj as Record<string, unknown>)[k] !== undefined)
          .sort()
          .map((k) => `${JSON.stringify(k)}:${walk((obj as Record<string, unknown>)[k])}`)
          .join(',')}}`
    seen.delete(obj)
    return out
  }
  return walk(key)
}

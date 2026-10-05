import { readFileSync } from 'node:fs'

export interface CaseResult {
  /** `<suite>/<case>`, e.g. `atoms/write`. */
  case: string
  library: string
  hz: number
  mean: number
  p99: number
  rme: number
  samples: number
  /** DOM nodes added/removed per update, for update cases. */
  swaps?: number
}
export interface Results {
  machine: { node: string; cpu: string; os: string }
  versions: Record<string, string>
  cases: Array<CaseResult>
}

export const key = (c: Pick<CaseResult, 'case' | 'library'>) => `${c.case} [${c.library}]`

/** Reads and validates a results file; throws an `InputError` naming the file. */
export class InputError extends Error {}
export const parseResults = (text: string, file: string): Results => {
  let j: any
  try {
    j = JSON.parse(text)
  } catch {
    throw new InputError(`${file}: malformed JSON`)
  }
  const ok =
    j &&
    typeof j.machine?.node === 'string' &&
    Array.isArray(j.cases) &&
    j.cases.every(
      (c: any) =>
        typeof c?.case === 'string' &&
        typeof c.library === 'string' &&
        typeof c.mean === 'number' &&
        typeof c.rme === 'number',
    )
  if (!ok) throw new InputError(`${file}: does not match the results schema`)
  return j
}
export const readResults = (file: string): Results => {
  let text: string
  try {
    text = readFileSync(file, 'utf8')
  } catch {
    throw new InputError(`${file}: missing`)
  }
  return parseResults(text, file)
}

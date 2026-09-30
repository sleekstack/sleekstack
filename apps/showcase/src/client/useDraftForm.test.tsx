import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import type { DraftSpec } from '../models/contracts'
import { useDraftForm } from './useDraftForm'

const schema = z.object({ name: z.string() })
const spec = {
  schema: () => schema,
  create: (src: string) => ({ name: src }),
  toDto: (d) => d,
} satisfies DraftSpec<{ name: string }, { name: string }, string>

describe('useDraftForm re-seed', () => {
  it('re-seeds on a source change while pristine', () => {
    const { result, rerender } = renderHook(({ src }) => useDraftForm(spec, src), { initialProps: { src: 'a' } })
    expect(result.current.getValues('name')).toBe('a')
    rerender({ src: 'b' })
    expect(result.current.getValues('name')).toBe('b')
  })

  it('keeps edits while dirty, then applies the new source once pristine again', () => {
    const { result, rerender } = renderHook(({ src }) => useDraftForm(spec, src), { initialProps: { src: 'a' } })
    act(() => result.current.setValue('name', 'edited', { shouldDirty: true }))
    rerender({ src: 'b' })
    expect(result.current.getValues('name')).toBe('edited')
    act(() => result.current.reset({ name: 'a' }))
    expect(result.current.getValues('name')).toBe('b')
  })
})

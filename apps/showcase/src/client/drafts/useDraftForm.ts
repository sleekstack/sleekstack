'use client'
/**
 * apps/showcase/src/client/drafts/useDraftForm.ts
 *
 * Binds a Draft to react-hook-form: `defaultValues = spec.create(src)`, resolver from `spec.schema(src)`.
 * Re-seeds when `src` changes, but only while the form is pristine, so a refetch never wipes edits.
 * Pass a stable `src` (a query result or a memoised ctx), not a fresh object literal per render.
 */
import { effectTsResolver } from '@hookform/resolvers/effect-ts'
import { useEffect, useMemo, useRef } from 'react'
import { useForm, type DefaultValues, type FieldValues, type Resolver, type UseFormProps, type UseFormReturn } from 'react-hook-form'
import type { DraftSpec } from '../../lib/contracts'

export function useDraftForm<D extends FieldValues, Dto, Src, P>(
  spec: DraftSpec<D, Dto, Src, P>,
  src: Src,
  options: Omit<UseFormProps<D>, 'defaultValues' | 'resolver'> = {},
): UseFormReturn<D> {
  const schema = useMemo(() => spec.schema(src), [spec, src])
  const form = useForm<D>({
    mode: 'onTouched',
    reValidateMode: 'onChange',
    ...options,
    defaultValues: spec.create(src) as DefaultValues<D>,
    resolver: effectTsResolver(schema as never) as unknown as Resolver<D>,
  })
  // `seeded` only advances on a reset, so a source that changed while dirty is applied once the form is pristine again.
  const seeded = useRef(src)
  const { isDirty } = form.formState
  useEffect(() => {
    if (Object.is(seeded.current, src) || isDirty) return
    seeded.current = src
    form.reset(spec.create(src) as DefaultValues<D>)
  }, [spec, src, isDirty, form])
  return form
}

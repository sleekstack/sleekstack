// R1: Model and Draft live only in @sleekstack/model; the old locations export none of them (ADR 0019).
// @ts-expect-error moved to @sleekstack/model
import type { ModelSpec } from '@sleekstack/core'
// @ts-expect-error moved to @sleekstack/model
import type { DraftSpec } from '@sleekstack/core'
// @ts-expect-error moved to @sleekstack/model
import type { Draft } from '@sleekstack/ui'
// @ts-expect-error moved to @sleekstack/model
import { useDraft } from '@sleekstack/ui'

export type Old = [ModelSpec<never, never>, DraftSpec<never, never>, Draft<never, never>, typeof useDraft]

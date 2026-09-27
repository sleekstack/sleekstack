'use client'
/**
 * apps/showcase/app/error.tsx
 *
 * Next 15 error boundary: catches an unexpected defect (a thrown error, not
 * the `{ ok: false, error }` result the Server Actions return for expected
 * failures) and offers `reset()` to retry the segment.
 */
export default function Error({ error, reset }: { readonly error: Error & { digest?: string }; readonly reset: () => void }) {
  return (
    <main>
      <h1>Something went wrong</h1>
      <p>{error.message}</p>
      <button type="button" onClick={() => reset()}>
        Try again
      </button>
    </main>
  )
}

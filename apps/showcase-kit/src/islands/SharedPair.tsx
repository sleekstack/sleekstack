'use client'
import { Island } from './islands.client'
import { LocalTallyLayer } from './services'

/** Two Islands of the same name: one shared app scope, separate component scopes. `provide` is a client-side prop (layers cannot cross the RSC boundary). */
export function SharedPair() {
  return (
    <>
      <section aria-label="shared a">
        <Island name="shared" props={{ id: 'shared-a' }} hydrate="idle" provide={[LocalTallyLayer]} />
      </section>
      <section aria-label="shared b">
        <Island name="shared" props={{ id: 'shared-b' }} hydrate="idle" provide={[LocalTallyLayer]} />
      </section>
    </>
  )
}

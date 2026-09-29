import { Island } from '../../src/islands/islands.client'
import { RerenderHost } from '../../src/islands/RerenderHost'
import { SharedPair } from '../../src/islands/SharedPair'

export default function IslandsPage() {
  return (
    <main>
      <h1>Islands</h1>
      <section aria-label="load island">
        <Island name="counter" props={{ start: 10 }} hydrate="load" />
      </section>
      {['button', 'checkbox', 'link', 'keyboard'].map((id) => (
        <section key={id} aria-label={`interaction ${id}`}>
          <Island name="controls" props={{ id }} hydrate="interaction" />
        </section>
      ))}
      <SharedPair />
      <section aria-label="action island">
        <Island name="ping" props={{}} hydrate="interaction" />
      </section>
      <div style={{ height: '200vh' }} />
      <RerenderHost />
    </main>
  )
}

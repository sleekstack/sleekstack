import { Island } from '../../src/islands/islands.client'
import { RerenderHost } from '../../src/islands/RerenderHost'

export default function IslandsPage() {
  return (
    <main>
      <h1>Islands</h1>
      <section aria-label="load island">
        <Island name="counter" props={{ start: 10 }} hydrate="load" />
      </section>
      <div style={{ height: '200vh' }} />
      <RerenderHost />
    </main>
  )
}

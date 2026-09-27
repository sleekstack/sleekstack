/**
 * apps/showcase/app/page.tsx
 *
 * Nav placeholder (task .1). The board itself — nested LayerProviders,
 * request scopes, the activity log — is wired up in tasks .2 and .3.
 */
export default function HomePage() {
  return (
    <main>
      <h1>Team Task Board</h1>
      <p>
        The board UI lands in a later task. For now, see <a href="/graph">/graph</a> for the service graph and{' '}
        <a href="/errors">/errors</a> for the broken-graph gallery.
      </p>
    </main>
  )
}

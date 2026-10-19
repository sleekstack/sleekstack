import { Head } from '@sleekstack/ui'
import { Route } from '@sleekstack/router'

export default function* User() {
  const route = yield* Route
  return (
    <>
      <Head>
        <title>{`User ${route.params.id}`}</title>
      </Head>
      <h1>{`User ${route.params.id}`}</h1>
    </>
  )
}

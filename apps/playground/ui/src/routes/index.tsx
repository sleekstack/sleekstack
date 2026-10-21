import { Head } from '@sleekstack/ui'
import { Counter } from './_counter'

export default function Home() {
  return (
    <main>
      <Head>
        <title>SleekStack ui example</title>
      </Head>
      <h1>Home</h1>
      <Counter />
    </main>
  )
}

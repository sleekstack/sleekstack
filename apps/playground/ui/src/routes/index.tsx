import { useLocal } from '@sleekstack/ui'

function* Counter() {
  const [n, set] = yield* useLocal(0)
  return <button onClick={() => set(n + 1)}>{`count ${n}`}</button>
}

export default function Home() {
  return (
    <main>
      <h1>Home</h1>
      <Counter />
      <a href="/users/42">User 42</a>
    </main>
  )
}

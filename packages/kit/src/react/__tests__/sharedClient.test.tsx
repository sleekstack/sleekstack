// @vitest-environment jsdom
import { expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Suspense, useEffect } from 'react'
import { cachedQuery, layer, tag } from '../../index'
import { LayerProvider, useQuery, useQueryClient } from '../index'

const T = tag<number>('T')
const q = cachedQuery({ key: () => ['shared'], fetch: function* () { return new Promise<string>(() => {}) } })
function Reader() { return <p>{useQuery(q(undefined)).data ?? 'none'}</p> }
function Writer() {
  const client = useQueryClient()
  useEffect(() => client.setData(q(undefined), 'from nested'), [client])
  return null
}
const root: never[] = []
const nested = [layer(T, 1)]

it('a nested LayerProvider shares the root query client', async () => {
  render(
    <LayerProvider provide={root}>
      <Suspense fallback={null}>
        <Reader />
        <LayerProvider provide={nested}>
          <Suspense fallback={null}><Writer /></Suspense>
        </LayerProvider>
      </Suspense>
    </LayerProvider>,
  )
  expect(await screen.findByText('from nested')).toBeTruthy()
})

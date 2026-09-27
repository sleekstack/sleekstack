import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderStrict } from './renderStrict'

describe('renderStrict', () => {
  it('renders inside StrictMode (double-invokes render)', () => {
    let renders = 0
    function Probe() {
      renders++
      return <p>ok</p>
    }
    renderStrict(<Probe />)
    expect(screen.getByText('ok')).toBeTruthy()
    expect(renders).toBe(2)
  })
})

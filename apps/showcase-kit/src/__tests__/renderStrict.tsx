import { render, type RenderOptions, type RenderResult } from '@testing-library/react'
import type { ReactNode } from 'react'

/** RTL `render` under StrictMode (persists across `rerender`); all new React tests use this. */
export const renderStrict = (ui: ReactNode, options?: RenderOptions): RenderResult =>
  render(ui, { ...options, reactStrictMode: true })

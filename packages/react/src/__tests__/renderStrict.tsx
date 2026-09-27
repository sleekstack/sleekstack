import { render, type RenderOptions, type RenderResult } from '@testing-library/react'
import { StrictMode, type ReactNode } from 'react'

/** RTL `render` wrapped in `<StrictMode>`; all new React tests use this. */
export const renderStrict = (ui: ReactNode, options?: RenderOptions): RenderResult =>
  render(<StrictMode>{ui}</StrictMode>, options)

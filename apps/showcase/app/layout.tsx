import type { ReactNode } from 'react'

export const metadata = {
  title: 'SleekStack Showcase',
  description: 'Team Task Board — every SleekStack feature exercised in real code.',
}

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0, padding: '1.5rem' }}>
        <nav style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
          <a href="/">Board</a>
          <a href="/log">Log</a>
          <a href="/graph">Graph</a>
          <a href="/errors">Errors</a>
        </nav>
        {children}
      </body>
    </html>
  )
}

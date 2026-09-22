import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import '../index.css'

export const metadata: Metadata = {
  title: 'Trellis — Connected Learning',
  description: 'A persistent learning workspace for connected, evidence-backed learning.',
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

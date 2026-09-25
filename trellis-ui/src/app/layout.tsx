import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import '@fontsource-variable/inter'
import '@fontsource-variable/fraunces'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
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

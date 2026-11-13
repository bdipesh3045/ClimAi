import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Fraunces, Instrument_Sans, Martian_Mono } from 'next/font/google'
import { AppShell } from '@/components/layout/app-shell'
import 'leaflet/dist/leaflet.css'
import './globals.css'

// A light editorial serif for headlines and figures, a compact grotesk for everything a farmer reads or taps.

// Interface and reading text: crisp and compact, so dense tables and labels still breathe.
const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-instrument-sans',
  display: 'swap',
})

// Display: Fraunces with its soft and "wonky" axes off reads as a sharp, light editorial serif, like Canela.
const fraunces = Fraunces({
  subsets: ['latin'],
  axes: ['opsz', 'SOFT', 'WONK'],
  variable: '--font-fraunces',
  display: 'swap',
})

// Coordinates and codes, narrowed a step so they sit beside the grotesk.
const martianMono = Martian_Mono({
  subsets: ['latin'],
  axes: ['wdth'],
  variable: '--font-martian-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'ClimateCrop AI | Climate records turned into planting decisions',
    template: '%s | ClimateCrop AI',
  },
  description:
    'Compare seasons, find planting windows and check crop requirements for any location using NASA POWER, Open-Meteo seasonal forecasts and the FAO ECOCROP database.',
  applicationName: 'ClimateCrop AI',
  icons: {
    icon: [
      { url: '/icon-light-32x32.png', media: '(prefers-color-scheme: light)' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  colorScheme: 'light',
  themeColor: '#1e4a30',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${instrumentSans.variable} ${fraunces.variable} ${martianMono.variable}`}>
      <body className="antialiased">
        <AppShell>{children}</AppShell>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}

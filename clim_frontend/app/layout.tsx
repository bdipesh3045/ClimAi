import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { AppShell } from '@/components/layout/app-shell'
import 'leaflet/dist/leaflet.css'
import './globals.css'

// One typeface for the whole site: General Sans (Indian Type Foundry, ITF Free Font License).
// It is served by Fontshare, as the license allows, so no font files live in this repository.
const FONT_CSS = 'https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600,700&display=swap'

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
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link rel="preconnect" href="https://cdn.fontshare.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- one site-wide font in the root layout */}
        <link rel="stylesheet" href={FONT_CSS} />
      </head>
      <body className="antialiased">
        <AppShell>{children}</AppShell>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}

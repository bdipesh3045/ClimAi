// Flask backend. Port 5001, not 5000: macOS AirPlay Receiver already listens on 5000.
const backendUrl = process.env.BACKEND_URL ?? 'http://127.0.0.1:5001'

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  // The browser calls /backend/* on this site and Next.js forwards it to Flask, so the
  // sign-in cookie is first-party and the account routes need no CORS.
  async rewrites() {
    return [{ source: '/backend/:path*', destination: `${backendUrl}/api/:path*` }]
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

export default nextConfig

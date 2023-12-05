// import './env.mjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    mode: process.env.NODE_ENV,
  },
}

export default nextConfig

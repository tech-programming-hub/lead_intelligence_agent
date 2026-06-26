/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';
const BASE_PATH = isProd ? '/lead_intelligence_agent' : '';

const nextConfig = {
  output: 'export',
  basePath: BASE_PATH,
  assetPrefix: BASE_PATH,
  trailingSlash: true,
  reactStrictMode: true,
  images: { unoptimized: true },
};

module.exports = nextConfig;

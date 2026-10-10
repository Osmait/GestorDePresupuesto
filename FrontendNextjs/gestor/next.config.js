const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin('./i18n.ts');

/**
 * Bundle analyzer: OFF unless ANALYZE=true (see perf/frontend/README.md).
 * The package is a devDependency and is only required when enabled, so a
 * production install without dev deps keeps working.
 */
const withBundleAnalyzer =
  process.env.ANALYZE === 'true'
    ? require('@next/bundle-analyzer')({ enabled: true, openAnalyzer: false })
    : (config) => config;

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
}

module.exports = withBundleAnalyzer(withNextIntl(nextConfig))

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
  experimental: {
    // Client router cache for dynamic pages (seconds): going back to the
    // server-rendered dashboard within this window reuses its RSC payload
    // instead of re-rendering it. Successful mutations call router.refresh(),
    // which purges the cache (components/common/react-query-provider.tsx).
    staleTimes: {
      dynamic: 30,
    },
  },
}

module.exports = withBundleAnalyzer(withNextIntl(nextConfig))

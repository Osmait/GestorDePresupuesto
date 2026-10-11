const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin('./i18n.ts');

/**
 * Bundle analyzer: OFF unless ANALYZE=true (see perf/frontend/README.md).
 * The package is a devDependency and is only required when enabled, so a
 * production install without dev deps keeps working. It is a webpack plugin,
 * so the analyze build must opt out of Turbopack: `npm run analyze`
 * (`ANALYZE=true next build --webpack`).
 */
const withBundleAnalyzer =
  process.env.ANALYZE === 'true'
    ? require('@next/bundle-analyzer')({ enabled: true, openAnalyzer: false })
    : (config) => config;

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The repo root has its own lockfile (commit tooling); pin the app root so
  // Turbopack and output file tracing don't infer the monorepo root.
  turbopack: {
    root: __dirname,
  },
  outputFileTracingRoot: __dirname,
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

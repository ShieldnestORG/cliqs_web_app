const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
});

// Security headers applied to every route (pages + API).
// No Content-Security-Policy yet: the app loads Google Fonts and connects to
// user-supplied RPC/DB endpoints, so an untested CSP risks breaking production.
// CSP is tracked as a follow-up in docs/security/SOC2-GAP-ASSESSMENT.md.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  // escape-string-regexp v5 is ESM-only. next/jest builds jest's
  // transformIgnorePatterns exceptions from this list, so without it every
  // suite that reaches the real mongodb helpers (@/lib/audit, @/lib/db) dies
  // parsing the untransformed ESM. Add future ESM-only deps here too.
  transpilePackages: ["escape-string-regexp"],
  // Old URLs from before the 2026-10 flow cleanup. permanent: false (307) until a
  // preview check confirms them: a cached 308 cannot be taken back.
  // /:chainName itself is NOT redirected here: a config redirect runs before
  // public/ and would catch /robots.txt, /llms.txt and /favicon.ico. That one is
  // a getServerSideProps stub in pages/[chainName]/index.tsx.
  async redirects() {
    return [
      // First: a more specific rule must precede the catch-all for the same source.
      {
        source: "/:chainName/operations",
        has: [{ type: "query", key: "tab", value: "validators" }],
        destination: "/:chainName/validator",
        permanent: false,
      },
      {
        source: "/:chainName/operations",
        destination: "/:chainName/dashboard",
        permanent: false,
      },
      {
        source: "/:chainName/account",
        destination: "/:chainName/settings",
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  webpack: (config, { isServer: _isServer }) => {
    // Handle missing 'starknet' dependency in @keplr-wallet/crypto
    // This is a transitive dependency that isn't needed for Cosmos functionality
    config.resolve.fallback = {
      ...config.resolve.fallback,
      starknet: false,
    };

    return config;
  },
};

module.exports = withBundleAnalyzer(nextConfig);

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

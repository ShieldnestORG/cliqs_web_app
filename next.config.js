const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  webpack: (config, { isServer }) => {
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

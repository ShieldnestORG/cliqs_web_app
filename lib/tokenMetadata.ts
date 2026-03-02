/**
 * Token Metadata Service
 *
 * Provides proper symbols, logos, and decimals for tokens,
 * especially bridged assets on Coreum (TX) chain.
 */

export interface TokenMetadata {
  symbol: string;
  name: string;
  logo?: string;
  exponent: number;
  description?: string;
  coingeckoId?: string;
}

// Known bridged tokens on Coreum (TX)
// These are XRPL assets bridged via Sologenic/XRPL bridge
// Format: drop-core1<issuerAddress>
const COREUM_BRIDGED_TOKENS: Record<string, TokenMetadata> = {
  // XRP bridged to Coreum - main bridge contract
  "drop-core1zhs909jp9yktml6qqx9f0ptcq2xnhhj99cja03j3lfcsp2pgm86studdrz": {
    symbol: "XRP",
    name: "XRP (Bridged)",
    logo: "https://assets.coingecko.com/coins/images/44/standard/xrp-symbol-white-128.png",
    exponent: 6,
    description: "XRP bridged from XRPL",
    coingeckoId: "ripple",
  },
  // Alternative XRP bridge addresses
  "drop-core1wgjngl8qfxhmd4fqjp9lyjhgdp4hespu0zqxevah7xxzg6gpj8kqr9cuzg": {
    symbol: "XRP",
    name: "XRP (Bridged)",
    logo: "https://assets.coingecko.com/coins/images/44/standard/xrp-symbol-white-128.png",
    exponent: 6,
    coingeckoId: "ripple",
  },
  // SOLO token (Sologenic)
  "drop-core1n3d32fsc5lnfvmhf6wmnrnpkdtmq7sd5glghwam5xk74v0qyfzfqjujk7q": {
    symbol: "SOLO",
    name: "Sologenic (Bridged)",
    logo: "https://assets.coingecko.com/coins/images/12772/standard/solo.png",
    exponent: 6,
    coingeckoId: "sologenic",
  },
  // USDT bridged (Tether)
  "drop-core1ezu79hs4v9grxsfvlqtdmnjtxdz66q0u56rdmh90u5k39hd2wphs6y6n3a": {
    symbol: "USDT",
    name: "Tether (Bridged)",
    logo: "https://assets.coingecko.com/coins/images/325/standard/Tether.png",
    exponent: 6,
    coingeckoId: "tether",
  },
  // USDC bridged
  "drop-core19drf7gzgqmgxhlz0hdhc62pzrwlp9e4fms7xv8qkftdkpghczlrs9gq3hm": {
    symbol: "USDC",
    name: "USD Coin (Bridged)",
    logo: "https://assets.coingecko.com/coins/images/6319/standard/usdc.png",
    exponent: 6,
    coingeckoId: "usd-coin",
  },
};

// Well-known IBC tokens
const IBC_TOKENS: Record<string, TokenMetadata> = {
  // ATOM via IBC
  "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2": {
    symbol: "ATOM",
    name: "Cosmos Hub",
    logo: "https://assets.coingecko.com/coins/images/1481/standard/cosmos_hub.png",
    exponent: 6,
    coingeckoId: "cosmos",
  },
  // OSMO via IBC
  "ibc/47BD209179859CDE4A2806763D7189B6E6FE13A17880FE2B42DE1E6C1E329E23": {
    symbol: "OSMO",
    name: "Osmosis",
    logo: "https://assets.coingecko.com/coins/images/16724/standard/osmo.png",
    exponent: 6,
    coingeckoId: "osmosis",
  },
};

// Smart token patterns for Coreum
const COREUM_SMART_TOKEN_PATTERNS: Array<{
  pattern: RegExp;
  getMetadata: (denom: string) => TokenMetadata | null;
}> = [
  // XRPL bridged tokens (drop-core1...)
  {
    pattern: /^drop-core1[a-z0-9]+$/,
    getMetadata: (denom) => {
      // Check known mappings first
      if (COREUM_BRIDGED_TOKENS[denom]) {
        return COREUM_BRIDGED_TOKENS[denom];
      }
      // Generic bridged asset - could be XRP or another XRPL asset
      // Extract a short identifier from the issuer address
      const issuerShort = denom.slice(-4).toUpperCase();
      return {
        symbol: `BR${issuerShort}`,
        name: "XRPL Bridged Asset",
        exponent: 6,
        description: "Token bridged from XRP Ledger",
      };
    },
  },
  // Coreum smart tokens (subunits like ucore-...)
  {
    pattern: /^[a-z]+-core1[a-z0-9]+$/,
    getMetadata: (denom) => {
      // Check if it's a known bridged token
      if (COREUM_BRIDGED_TOKENS[denom]) {
        return COREUM_BRIDGED_TOKENS[denom];
      }
      const prefix = denom.split("-")[0].toUpperCase();
      return {
        symbol: prefix.slice(0, 4),
        name: `${prefix} Token`,
        exponent: 6,
      };
    },
  },
  // Factory tokens (factory/core1.../subdenom)
  {
    pattern: /^factory\/core1[a-z0-9]+\/[a-zA-Z0-9_-]+$/i,
    getMetadata: (denom) => {
      const parts = denom.split("/");
      const subdenom = parts[2] || "TOKEN";
      // Clean up the subdenom
      const cleanName = subdenom.replace(/[-_]/g, " ").trim();
      return {
        symbol: subdenom.replace(/[-_]/g, "").toUpperCase().slice(0, 6),
        name: `${cleanName}`,
        exponent: 6,
      };
    },
  },
  // IBC tokens without known mapping
  {
    pattern: /^ibc\/[A-F0-9]+$/i,
    getMetadata: (denom) => {
      // Check known IBC tokens first
      if (IBC_TOKENS[denom]) {
        return IBC_TOKENS[denom];
      }
      // Generic IBC token
      const hash = denom.slice(4, 12).toUpperCase();
      return {
        symbol: `IBC`,
        name: `IBC Token (${hash}...)`,
        exponent: 6,
        description: "Inter-Blockchain Communication token",
      };
    },
  },
];

/**
 * Get token metadata from static mappings
 */
export function getStaticTokenMetadata(denom: string): TokenMetadata | null {
  // Check direct mappings
  if (COREUM_BRIDGED_TOKENS[denom]) {
    return COREUM_BRIDGED_TOKENS[denom];
  }

  if (IBC_TOKENS[denom]) {
    return IBC_TOKENS[denom];
  }

  // Check patterns
  for (const { pattern, getMetadata } of COREUM_SMART_TOKEN_PATTERNS) {
    if (pattern.test(denom)) {
      return getMetadata(denom);
    }
  }

  return null;
}

/**
 * Query Coreum chain for FT (Fungible Token) metadata
 */
export async function queryTokenMetadata(
  restEndpoint: string,
  denom: string,
): Promise<TokenMetadata | null> {
  try {
    // Try Coreum asset FT query first (for smart tokens)
    if (denom.includes("core1") || denom.includes("coreum")) {
      try {
        const response = await fetch(
          `${restEndpoint}/coreum/asset/ft/v1/token?denom=${encodeURIComponent(denom)}`,
          { signal: AbortSignal.timeout(5000) },
        );

        if (response.ok) {
          const data = await response.json();
          if (data.token) {
            return {
              symbol: data.token.symbol || "TOKEN",
              name: data.token.description || data.token.symbol || "Unknown Token",
              exponent: data.token.precision || 6,
              description: data.token.description,
            };
          }
        }
      } catch {
        // Coreum FT query failed, try other methods
      }
    }

    // Try bank denom metadata query (standard Cosmos SDK)
    try {
      const metadataResponse = await fetch(
        `${restEndpoint}/cosmos/bank/v1beta1/denoms_metadata/${encodeURIComponent(denom)}`,
        { signal: AbortSignal.timeout(5000) },
      );

      if (metadataResponse.ok) {
        const data = await metadataResponse.json();
        if (data.metadata) {
          const displayUnit = data.metadata.denom_units?.find(
            (u: { denom: string; exponent: number }) => u.denom === data.metadata.display,
          );
          return {
            symbol: data.metadata.symbol || data.metadata.display || "TOKEN",
            name: data.metadata.name || data.metadata.description || "Unknown Token",
            exponent: displayUnit?.exponent || 0,
            description: data.metadata.description,
          };
        }
      }
    } catch {
      // Bank metadata query failed
    }

    // Try bank supply query to at least confirm token exists
    try {
      const supplyResponse = await fetch(
        `${restEndpoint}/cosmos/bank/v1beta1/supply/by_denom?denom=${encodeURIComponent(denom)}`,
        { signal: AbortSignal.timeout(5000) },
      );

      if (supplyResponse.ok) {
        const data = await supplyResponse.json();
        if (data.amount && data.amount.amount !== "0") {
          // Token exists on chain, return basic metadata
          return {
            symbol: getShortDenom(denom),
            name: "On-chain Token",
            exponent: 6, // Default assumption
          };
        }
      }
    } catch {
      // Supply query failed
    }
  } catch (error) {
    console.debug("Failed to query token metadata:", error);
  }

  return null;
}

/**
 * Query Mintscan API for token metadata (if available)
 * Mintscan provides enriched token data for many Cosmos chains
 */
export async function queryMintscanMetadata(
  chainName: string,
  denom: string,
): Promise<TokenMetadata | null> {
  try {
    // Mintscan API endpoint pattern
    const mintscanApi = `https://api.mintscan.io/v1/${chainName}/assets`;

    const response = await fetch(mintscanApi, {
      signal: AbortSignal.timeout(5000),
      headers: {
        Accept: "application/json",
      },
    });

    if (response.ok) {
      const data = await response.json();
      const assets = data.assets || data;

      if (Array.isArray(assets)) {
        const asset = assets.find(
          (a: { denom?: string; base_denom?: string }) =>
            a.denom === denom || a.base_denom === denom,
        );

        if (asset) {
          return {
            symbol: asset.symbol || asset.ticker || "TOKEN",
            name: asset.name || asset.description || "Unknown Token",
            exponent: asset.decimal || asset.exponent || 6,
            logo: asset.image || asset.logo,
            description: asset.description,
            coingeckoId: asset.coingecko_id,
          };
        }
      }
    }
  } catch (error) {
    console.debug("Mintscan query failed:", error);
  }

  return null;
}

/**
 * Check if a denom is a liquidity pool / LP token that should be hidden
 */
export function isLPToken(denom: string): boolean {
  const lowerDenom = denom.toLowerCase();

  // Quick checks for common patterns
  if (lowerDenom.startsWith("ulp-")) return true;
  if (lowerDenom.startsWith("gamm/pool")) return true;
  if (lowerDenom.includes("/pool")) return true;
  if (lowerDenom.endsWith("-lp")) return true;
  if (lowerDenom.startsWith("lp-") || lowerDenom.startsWith("lp_")) return true;

  // Pattern-based checks
  const lpPatterns = [
    /^ulp[_-]/i, // LP shares (ulp-core1..., ulp_xxx)
    /^gamm\/pool/i, // Osmosis GAMM pools
    /pool[0-9]+/i, // Pool with numbers (pool1, pool123)
    /^factory\/.*\/(.*lp|lp.*)$/i, // Factory LP tokens
    /share$/i, // Share tokens
    /liquidity/i, // Liquidity tokens
    /-share$/i, // Share suffix
    /^cl\/pool/i, // Concentrated liquidity pools
  ];

  return lpPatterns.some((pattern) => pattern.test(denom));
}

/**
 * Generate a deterministic color for a token based on its symbol
 */
export function getTokenColor(symbol: string): string {
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) {
    hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
  }

  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 50%)`;
}

/**
 * Format a token amount for display with appropriate precision
 */
export function formatTokenAmount(
  amount: string | number,
  options?: {
    maxDecimals?: number;
    compactLarge?: boolean;
  },
): string {
  const { maxDecimals = 6, compactLarge = true } = options || {};
  const num = typeof amount === "string" ? parseFloat(amount) : amount;

  if (isNaN(num)) return "0";

  if (compactLarge) {
    if (num >= 1_000_000_000) {
      return `${(num / 1_000_000_000).toFixed(2)}B`;
    }
    if (num >= 1_000_000) {
      return `${(num / 1_000_000).toFixed(2)}M`;
    }
    if (num >= 1_000) {
      return `${(num / 1_000).toFixed(2)}K`;
    }
  }

  // For small numbers, show more precision
  if (num < 0.0001 && num > 0) {
    return num.toExponential(2);
  }

  // Regular formatting
  const formatted = num.toFixed(maxDecimals);
  // Remove trailing zeros
  return formatted.replace(/\.?0+$/, "") || "0";
}

/**
 * Get a display-friendly short version of a denom
 */
export function getShortDenom(denom: string): string {
  if (denom.startsWith("ibc/")) {
    return `IBC...${denom.slice(-4)}`;
  }
  if (denom.startsWith("factory/")) {
    const parts = denom.split("/");
    return parts[2] || "TOKEN";
  }
  if (denom.startsWith("drop-")) {
    return "BRIDGE";
  }
  if (denom.length > 12) {
    return `${denom.slice(0, 6)}...${denom.slice(-4)}`;
  }
  return denom;
}

// Known token logos (CDN URLs)
export const TOKEN_LOGOS: Record<string, string> = {
  // Major tokens
  XRP: "https://assets.coingecko.com/coins/images/44/standard/xrp-symbol-white-128.png",
  ATOM: "https://assets.coingecko.com/coins/images/1481/standard/cosmos_hub.png",
  OSMO: "https://assets.coingecko.com/coins/images/16724/standard/osmo.png",
  USDC: "https://assets.coingecko.com/coins/images/6319/standard/usdc.png",
  USDT: "https://assets.coingecko.com/coins/images/325/standard/Tether.png",
  ETH: "https://assets.coingecko.com/coins/images/279/standard/ethereum.png",
  BTC: "https://assets.coingecko.com/coins/images/1/standard/bitcoin.png",
  SOLO: "https://assets.coingecko.com/coins/images/12772/standard/solo.png",
  CORE: "https://assets.coingecko.com/coins/images/28938/standard/coreum.png",
  COREUM: "https://assets.coingecko.com/coins/images/28938/standard/coreum.png",
  TX: "/tx.png",
  // Stablecoins
  DAI: "https://assets.coingecko.com/coins/images/9956/standard/Badge_Dai.png",
  BUSD: "https://assets.coingecko.com/coins/images/9576/standard/BUSD.png",
  // DeFi tokens
  UNI: "https://assets.coingecko.com/coins/images/12504/standard/uni.jpg",
  LINK: "https://assets.coingecko.com/coins/images/877/standard/chainlink-new-logo.png",
  // Cosmos ecosystem
  JUNO: "https://assets.coingecko.com/coins/images/19249/standard/Juno_Logo_%28Salmon%29_%281%29.png",
  SCRT: "https://assets.coingecko.com/coins/images/11871/standard/secret_logo.png",
  AKT: "https://assets.coingecko.com/coins/images/12785/standard/akash-logo.png",
  STARS: "https://assets.coingecko.com/coins/images/22363/standard/Stargaze_icon.png",
};

/**
 * Get logo URL for a token symbol
 */
export function getTokenLogo(symbol: string): string | undefined {
  return TOKEN_LOGOS[symbol.toUpperCase()];
}

/**
 * Hook for fetching and caching token metadata
 */

import { useState, useEffect, useCallback } from "react";
import { useChains } from "@/context/ChainsContext";
import {
  TokenMetadata,
  getStaticTokenMetadata,
  queryTokenMetadata,
  getTokenLogo,
} from "@/lib/tokenMetadata";

// In-memory cache for token metadata
const metadataCache = new Map<string, TokenMetadata>();

interface UseTokenMetadataResult {
  metadata: TokenMetadata | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Hook to fetch token metadata for a single denom
 */
export function useTokenMetadata(denom: string): UseTokenMetadataResult {
  const { chain } = useChains();
  const [metadata, setMetadata] = useState<TokenMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!denom) {
      setMetadata(null);
      return;
    }

    // Check cache first
    if (metadataCache.has(denom)) {
      setMetadata(metadataCache.get(denom)!);
      return;
    }

    // Check static metadata
    const staticMeta = getStaticTokenMetadata(denom);
    if (staticMeta) {
      metadataCache.set(denom, staticMeta);
      setMetadata(staticMeta);
      return;
    }

    // Check chain registry assets
    const asset = chain.assets.find(
      (a) =>
        a.base === denom ||
        a.denom_units.some((u) => u.denom === denom)
    );

    if (asset) {
      const displayUnit =
        asset.denom_units.find(
          (u) =>
            u.denom === asset.display ||
            u.denom === asset.symbol.toLowerCase()
        ) ||
        asset.denom_units.find((u) => u.exponent > 0) ||
        asset.denom_units[0];

      const meta: TokenMetadata = {
        symbol: asset.symbol,
        name: asset.display || asset.symbol,
        exponent: displayUnit?.exponent || 0,
        logo: asset.logo_URIs?.svg || asset.logo_URIs?.png || getTokenLogo(asset.symbol),
      };

      metadataCache.set(denom, meta);
      setMetadata(meta);
      return;
    }

    // Query chain for metadata
    const fetchMetadata = async () => {
      setLoading(true);
      setError(null);

      try {
        // Get REST endpoint from node address
        const restEndpoint = chain.nodeAddress.replace(":26657", ":1317");
        const chainMeta = await queryTokenMetadata(restEndpoint, denom);

        if (chainMeta) {
          metadataCache.set(denom, chainMeta);
          setMetadata(chainMeta);
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Failed to fetch metadata"));
      } finally {
        setLoading(false);
      }
    };

    fetchMetadata();
  }, [denom, chain.assets, chain.nodeAddress]);

  return { metadata, loading, error };
}

/**
 * Hook to fetch metadata for multiple tokens at once
 */
export function useTokensMetadata(denoms: string[]): {
  metadataMap: Map<string, TokenMetadata>;
  loading: boolean;
} {
  const { chain } = useChains();
  const [metadataMap, setMetadataMap] = useState<Map<string, TokenMetadata>>(new Map());
  const [loading, setLoading] = useState(false);

  const fetchAllMetadata = useCallback(async () => {
    if (denoms.length === 0) return;

    setLoading(true);
    const newMap = new Map<string, TokenMetadata>();

    for (const denom of denoms) {
      // Check cache
      if (metadataCache.has(denom)) {
        newMap.set(denom, metadataCache.get(denom)!);
        continue;
      }

      // Check static metadata
      const staticMeta = getStaticTokenMetadata(denom);
      if (staticMeta) {
        metadataCache.set(denom, staticMeta);
        newMap.set(denom, staticMeta);
        continue;
      }

      // Check chain registry
      const asset = chain.assets.find(
        (a) =>
          a.base === denom ||
          a.denom_units.some((u) => u.denom === denom)
      );

      if (asset) {
        const displayUnit =
          asset.denom_units.find(
            (u) =>
              u.denom === asset.display ||
              u.denom === asset.symbol.toLowerCase()
          ) ||
          asset.denom_units.find((u) => u.exponent > 0) ||
          asset.denom_units[0];

        const meta: TokenMetadata = {
          symbol: asset.symbol,
          name: asset.display || asset.symbol,
          exponent: displayUnit?.exponent || 0,
          logo: asset.logo_URIs?.svg || asset.logo_URIs?.png || getTokenLogo(asset.symbol),
        };

        metadataCache.set(denom, meta);
        newMap.set(denom, meta);
      }
    }

    setMetadataMap(newMap);
    setLoading(false);

    // Async fetch for unknown tokens (don't block UI)
    const unknownDenoms = denoms.filter(
      (d) => !newMap.has(d) && !metadataCache.has(d)
    );

    if (unknownDenoms.length > 0) {
      const restEndpoint = chain.nodeAddress.replace(":26657", ":1317");

      for (const denom of unknownDenoms) {
        try {
          const chainMeta = await queryTokenMetadata(restEndpoint, denom);
          if (chainMeta) {
            metadataCache.set(denom, chainMeta);
            setMetadataMap((prev) => {
              const updated = new Map(prev);
              updated.set(denom, chainMeta);
              return updated;
            });
          }
        } catch {
          // Silently fail for individual tokens
        }
      }
    }
  }, [denoms, chain.assets, chain.nodeAddress]);

  useEffect(() => {
    fetchAllMetadata();
  }, [fetchAllMetadata]);

  return { metadataMap, loading };
}

/**
 * Clear the metadata cache (useful for testing or forcing refresh)
 */
export function clearMetadataCache(): void {
  metadataCache.clear();
}

/**
 * Pre-populate cache with known metadata
 */
export function preloadMetadata(entries: Array<{ denom: string; metadata: TokenMetadata }>): void {
  for (const { denom, metadata } of entries) {
    metadataCache.set(denom, metadata);
  }
}

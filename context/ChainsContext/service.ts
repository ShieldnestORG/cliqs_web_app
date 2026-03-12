import { getChainsFromRegistry, getShaFromRegistry } from "@/lib/chainRegistry";
import { toastError, ensureProtocol } from "@/lib/utils";
import { StargateClient } from "@cosmjs/stargate";
import { useEffect, useState } from "react";
import {
  emptyChain,
  isChainInfoFilled,
  isCoreumChain,
  isCoreumRouteAlias,
  rebrandChain,
  rebrandChains,
} from "./helpers";
import {
  getChainFromEnvfile,
  getChainFromStorage,
  getChainFromUrl,
  getChainsFromStorage,
  getRecentChainFromStorage,
  getShaFromStorage,
  setChainsInStorage,
  setShaInStorage,
} from "./storage";
import { ChainInfo, ChainItems } from "./types";

export const useChainsFromRegistry = () => {
  const [chainItems, setChainItems] = useState<ChainItems>({
    mainnets: new Map(),
    testnets: new Map(),
    localnets: new Map(),
  });
  const [chainItemsError, setChainItemsError] = useState<string | null>(null);

  useEffect(() => {
    (async function () {
      // Both mainnets and testnets must be present. Testnets are always fetched so
      // that the validator dashboard network toggle works regardless of the
      // NEXT_PUBLIC_TESTNETS_ENABLED setting.
      const chainsPopulated = chainItems.mainnets.size && chainItems.testnets.size;

      if (chainsPopulated) {
        return;
      }

      const storedChains = getChainsFromStorage();

      try {
        const storedSha = getShaFromStorage();
        const registrySha = await getShaFromRegistry();

        // Require testnets in cached data. Old caches that only contain mainnets
        // will not satisfy this check and will trigger a fresh registry fetch,
        // which always includes both mainnets and testnets.
        const storedChainsPopulated = storedChains.mainnets.size && storedChains.testnets.size;

        if (storedSha === registrySha && storedChainsPopulated) {
          setChainItems(rebrandChains(storedChains));
          return;
        }

        const registryChains = await getChainsFromRegistry();
        const chains: ChainItems = rebrandChains({ ...storedChains, ...registryChains });

        setChainItems(chains);

        const newChainsPopulated = chains.mainnets.size && chains.testnets.size;

        if (newChainsPopulated) {
          setChainsInStorage(chains);
          setShaInStorage(registrySha);
        } else {
          setShaInStorage("");
        }
      } catch (e) {
        if (storedChains.mainnets.size && storedChains.testnets.size) {
          setChainItems(rebrandChains(storedChains));
          return;
        }

        console.error("Failed to get chains from registry:", e);
        setChainItemsError(e instanceof Error ? e.message : "Failed to get chains from registry");
        toastError({
          description: "Failed to get chains from registry",
          fullError: e instanceof Error ? e : undefined,
        });
      }
    })();
  }, [chainItems.mainnets.size, chainItems.testnets.size]);

  return { chainItems, chainItemsError };
};

const RPC_PROBE_TIMEOUT_MS = 6000; // 6 seconds per node

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("RPC probe timeout")), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
};

export const getNodeFromArray = async (nodeArray: readonly string[]) => {
  // only return https connections
  const secureNodes = nodeArray
    .filter((address) => address.startsWith("https://"))
    .map((address) => address);

  if (!secureNodes.length) {
    throw new Error("No SSL enabled RPC nodes available for this chain");
  }

  // Probe all nodes in parallel; return first successful
  const results = await Promise.allSettled(
    secureNodes.map((node) =>
      withTimeout(
        (async () => {
          const client = await StargateClient.connect(ensureProtocol(node));
          await client.getHeight();
          return node;
        })(),
        RPC_PROBE_TIMEOUT_MS,
      ),
    ),
  );

  for (const result of results) {
    if (result.status === "fulfilled") {
      return result.value;
    }
  }

  throw new Error("No RPC nodes available for this chain");
};

export const getChain = (chains: ChainItems) => {
  if (typeof window === "undefined") return emptyChain;

  const rootRoute = location.pathname.split("/")[1];
  // Avoid app from thinking the /api route is a registryName
  let chainNameFromUrl = rootRoute === "api" ? "" : rootRoute;
  const requestedCoreumAlias = isCoreumRouteAlias(chainNameFromUrl);

  // Handle coreum -> tx mapping for URL lookup
  if (requestedCoreumAlias) {
    chainNameFromUrl = "tx";
  }

  const recentChain = getRecentChainFromStorage(chains);
  if (!chainNameFromUrl && isChainInfoFilled(recentChain)) {
    return rebrandChain(recentChain as ChainInfo);
  }

  // The TX route is intentionally branded, but both Coreum mainnet and testnet
  // share the same visible alias. Restore the exact last-used variant so refreshes
  // and intra-app navigation don't silently flip networks.
  if (requestedCoreumAlias && isChainInfoFilled(recentChain) && isCoreumChain(recentChain)) {
    return rebrandChain(recentChain as ChainInfo);
  }

  const urlChain = getChainFromUrl(chainNameFromUrl);
  const envfileChain = getChainFromEnvfile(chainNameFromUrl);
  const storedChain = getChainFromStorage(
    chainNameFromUrl || envfileChain.registryName || "cosmoshub",
    chains,
  );

  const chain = rebrandChain({ ...storedChain, ...envfileChain, ...urlChain } as ChainInfo);

  return isChainInfoFilled(chain) ? chain : emptyChain;
};

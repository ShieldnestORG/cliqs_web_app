import { getChainsFromRegistry, getShaFromRegistry, isTestnetsEnabled } from "@/lib/chainRegistry";
import { toastError, ensureProtocol } from "@/lib/utils";
import { StargateClient } from "@cosmjs/stargate";
import { useEffect, useState } from "react";
import { emptyChain, isChainInfoFilled, rebrandChain, rebrandChains } from "./helpers";
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
import { ChainItems } from "./types";

export const useChainsFromRegistry = () => {
  const [chainItems, setChainItems] = useState<ChainItems>({
    mainnets: new Map(),
    testnets: new Map(),
    localnets: new Map(),
  });
  const [chainItemsError, setChainItemsError] = useState<string | null>(null);

  useEffect(() => {
    (async function () {
      const testnetsEnabled = isTestnetsEnabled();
      // When testnets are disabled, we only need mainnets to be populated
      const chainsPopulated = testnetsEnabled
        ? chainItems.mainnets.size && chainItems.testnets.size
        : chainItems.mainnets.size;

      if (chainsPopulated) {
        return;
      }

      const storedChains = getChainsFromStorage();

      try {
        const storedSha = getShaFromStorage();
        const registrySha = await getShaFromRegistry();

        const storedChainsPopulated = testnetsEnabled
          ? storedChains.mainnets.size && storedChains.testnets.size
          : storedChains.mainnets.size;

        if (storedSha === registrySha && storedChainsPopulated) {
          setChainItems(rebrandChains(storedChains));
          return;
        }

        const registryChains = await getChainsFromRegistry();
        const chains: ChainItems = rebrandChains({ ...storedChains, ...registryChains });

        setChainItems(chains);

        const newChainsPopulated = testnetsEnabled
          ? chains.mainnets.size && chains.testnets.size
          : chains.mainnets.size;

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

export const getNodeFromArray = async (nodeArray: readonly string[]) => {
  // only return https connections
  const secureNodes = nodeArray
    .filter((address) => address.startsWith("https://"))
    .map((address) => address);

  if (!secureNodes.length) {
    throw new Error("No SSL enabled RPC nodes available for this chain");
  }

  for (const node of secureNodes) {
    try {
      // test client connection
      const client = await StargateClient.connect(ensureProtocol(node));
      await client.getHeight();
      return node;
    } catch {}
  }

  throw new Error("No RPC nodes available for this chain");
};

export const getChain = (chains: ChainItems) => {
  if (typeof window === "undefined") return emptyChain;

  const rootRoute = location.pathname.split("/")[1];
  // Avoid app from thinking the /api route is a registryName
  let chainNameFromUrl = rootRoute === "api" ? "" : rootRoute;

  // Handle coreum -> tx mapping for URL lookup
  if (chainNameFromUrl.toLowerCase().includes("coreum")) {
    chainNameFromUrl = "tx";
  }

  const recentChain = getRecentChainFromStorage(chains);
  if (!chainNameFromUrl && isChainInfoFilled(recentChain)) {
    return rebrandChain(recentChain as any);
  }

  const urlChain = getChainFromUrl(chainNameFromUrl);
  const envfileChain = getChainFromEnvfile(chainNameFromUrl);
  const storedChain = getChainFromStorage(
    chainNameFromUrl || envfileChain.registryName || "cosmoshub",
    chains,
  );

  const chain = rebrandChain({ ...storedChain, ...envfileChain, ...urlChain } as any);

  return isChainInfoFilled(chain) ? chain : emptyChain;
};

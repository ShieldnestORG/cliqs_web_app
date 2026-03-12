import { ChainInfo, ChainItems, Dispatch, NewConnection } from "./types";

export const emptyChain: ChainInfo = {
  registryName: "",
  logo: "",
  chainId: "",
  chainDisplayName: "",
  nodeAddress: "",
  nodeAddresses: [],
  denom: "",
  displayDenom: "",
  displayDenomExponent: 0,
  assets: [],
  gasPrice: "",
  addressPrefix: "",
  explorerLinks: { tx: "", account: "" },
};

/**
 * Ensures any Coreum-based chain is rebranded to TX/tx
 */
export const isCoreumChain = (
  chain: Pick<Partial<ChainInfo>, "registryName" | "chainDisplayName" | "chainId">,
) => {
  const registryName = chain.registryName?.toLowerCase() ?? "";
  const chainDisplayName = chain.chainDisplayName?.toLowerCase() ?? "";
  const chainId = chain.chainId?.toLowerCase() ?? "";

  return (
    registryName.includes("coreum") || chainDisplayName.includes("coreum") || chainId.includes("coreum")
  );
};

export const isCoreumRouteAlias = (chainName: string) => {
  const normalized = chainName.toLowerCase();
  return normalized === "tx" || normalized.includes("coreum");
};

export const rebrandChain = (chain: ChainInfo): ChainInfo => {
  if (!isCoreumChain(chain)) {
    return chain;
  }

  // Reorder nodeAddresses: prefer Polkachu (handles large payloads; Foundation returns 500 on contract uploads)
  const polkachuMainnet = "https://coreum-rpc.polkachu.com";
  const polkachuTestnet = "https://coreum-testnet-rpc.polkachu.com";
  const preferred = chain.chainId?.toLowerCase().includes("testnet")
    ? polkachuTestnet
    : polkachuMainnet;
  const nodeAddresses = chain.nodeAddresses?.length
    ? [preferred, ...chain.nodeAddresses.filter((a) => a !== preferred)]
    : chain.nodeAddresses;

  return {
    ...chain,
    registryName: "tx",
    logo: "/tx.png",
    chainDisplayName: "TX",
    displayDenom: "TX",
    nodeAddresses,
    assets: chain.assets.map((asset) => {
      const isCoreAsset =
        asset.symbol.toUpperCase().includes("CORE") ||
        asset.display.toLowerCase().includes("core") ||
        asset.base.toLowerCase().includes("core");
      return {
        ...asset,
        symbol: isCoreAsset ? "TX" : asset.symbol,
        display: isCoreAsset ? "TX" : asset.display,
        logo_URIs: isCoreAsset ? { png: "/tx.png", svg: "/tx.png" } : asset.logo_URIs,
        denom_units: isCoreAsset
          ? asset.denom_units.map((unit) => ({
              ...unit,
              denom:
                unit.denom.toLowerCase().includes("core") && unit.exponent > 0 ? "TX" : unit.denom,
            }))
          : asset.denom_units,
      };
    }),
  };
};

/**
 * Ensures all chains in the registry are rebranded
 */
export const rebrandChains = (chains: ChainItems): ChainItems => {
  const rebrandedMainnets = new Map<string, ChainInfo>();
  chains.mainnets.forEach((chain, _key) => {
    const rebranded = rebrandChain(chain);
    rebrandedMainnets.set(rebranded.registryName, rebranded);
  });

  const rebrandedTestnets = new Map<string, ChainInfo>();
  chains.testnets.forEach((chain, _key) => {
    const rebranded = rebrandChain(chain);
    rebrandedTestnets.set(rebranded.registryName, rebranded);
  });

  const rebrandedLocalnets = new Map<string, ChainInfo>();
  chains.localnets.forEach((chain, _key) => {
    const rebranded = rebrandChain(chain);
    rebrandedLocalnets.set(rebranded.registryName, rebranded);
  });

  return {
    mainnets: rebrandedMainnets,
    testnets: rebrandedTestnets,
    localnets: rebrandedLocalnets,
  };
};

export const isChainInfoFilled = (chain: Partial<ChainInfo>): chain is ChainInfo =>
  Boolean(
    chain.registryName &&
      typeof chain.logo === "string" &&
      chain.chainId &&
      chain.chainDisplayName &&
      typeof chain.nodeAddress === "string" &&
      chain.nodeAddresses?.length &&
      chain.denom &&
      chain.displayDenom &&
      Number.isSafeInteger(chain.displayDenomExponent) &&
      typeof chain.displayDenomExponent === "number" &&
      chain.displayDenomExponent >= 0 &&
      chain.assets?.length &&
      chain.gasPrice &&
      chain.addressPrefix,
  );

export const setChains = (dispatch: Dispatch, chains: ChainItems) => {
  dispatch({ type: "setChains", payload: rebrandChains(chains) });
};

export const setChain = (dispatch: Dispatch, chain: ChainInfo) => {
  dispatch({ type: "setChain", payload: rebrandChain(chain) });
};

export const loadValidators = (dispatch: Dispatch) => {
  dispatch({ type: "loadValidators" });
};

export const setNewConnection = (dispatch: Dispatch, newConnection: NewConnection) => {
  dispatch({ type: "setNewConnection", payload: newConnection });
};

export const setChainsError = (dispatch: Dispatch, chainsError: string | null) => {
  dispatch({ type: "setChainsError", payload: chainsError });
};

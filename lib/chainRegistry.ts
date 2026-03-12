import { isChainInfoFilled } from "@/context/ChainsContext/helpers";
import { ChainInfo, ChainItems, ExplorerLinks } from "@/context/ChainsContext/types";
import { GithubChainRegistryItem, RegistryAsset, RegistryChain } from "@/types/chainRegistry";
import { preventUnhandledRejections } from "./promises";
import { requestGhJson } from "./request";

const chainRegistryRepo = "cosmos/chain-registry";
const repoBranch = "master";
const shaUrl = `https://api.github.com/repos/${chainRegistryRepo}/commits/${repoBranch}`;
const mainnetsUrl = `https://api.github.com/repos/${chainRegistryRepo}/contents`;
const testnetsUrl = `https://api.github.com/repos/${chainRegistryRepo}/contents/testnets`;
const registryCdnUrl = `https://cdn.jsdelivr.net/gh/${chainRegistryRepo}@${repoBranch}`;

// Check if testnets are enabled via environment variable (default: false)
export const isTestnetsEnabled = () => process.env.NEXT_PUBLIC_TESTNETS_ENABLED === "true";

const getShaFromRegistry = async () => {
  const { sha }: { sha: string } = await requestGhJson(shaUrl);
  return sha;
};

interface RegistryPromises {
  readonly chainInfo: Promise<RegistryChain>;
  readonly assetList: Promise<{ readonly assets: readonly RegistryAsset[] }>;
}

const getChainsFromRegistry = async () => {
  const chains: ChainItems = { mainnets: new Map(), testnets: new Map(), localnets: new Map() };

  // Always fetch both mainnets and testnets - testnets are needed for network switching
  // in validator dashboard and dev tools, even if not shown in chain selector
  const [mainnetGhItems, testnetGhItems]: [
    readonly GithubChainRegistryItem[],
    readonly GithubChainRegistryItem[],
  ] = await Promise.all([requestGhJson(mainnetsUrl), requestGhJson(testnetsUrl)]);

  const mainnetPromisesMap = new Map<string, RegistryPromises>();

  for (const { type, path } of mainnetGhItems) {
    if (type !== "dir" || path.startsWith(".") || path.startsWith("_") || path === "testnets") {
      continue;
    }

    mainnetPromisesMap.set(path, {
      chainInfo: requestGhJson(`${registryCdnUrl}/${path}/chain.json`),
      assetList: requestGhJson(`${registryCdnUrl}/${path}/assetlist.json`),
    });
  }

  const mainnetPromisesArray = [
    ...Array.from(mainnetPromisesMap.values()).map(({ chainInfo }) => chainInfo),
    ...Array.from(mainnetPromisesMap.values()).map(({ assetList }) => assetList),
  ];

  preventUnhandledRejections(...mainnetPromisesArray);
  await Promise.allSettled(mainnetPromisesArray);

  for (const { chainInfo, assetList } of mainnetPromisesMap.values()) {
    try {
      const registryChain = await chainInfo;
      const { assets }: { assets: readonly RegistryAsset[] } = await assetList;
      const chain = getChainInfoFromJsons(registryChain, assets);

      if (isChainInfoFilled(chain)) {
        chains.mainnets.set(chain.registryName, chain);
      }
    } catch {}
  }

  const testnetPromisesMap = new Map<string, RegistryPromises>();

  for (const { type, path } of testnetGhItems) {
    if (type !== "dir" || path.startsWith("testnets/.") || path.startsWith("testnets/_")) {
      continue;
    }

    testnetPromisesMap.set(path, {
      chainInfo: requestGhJson(`${registryCdnUrl}/${path}/chain.json`),
      assetList: requestGhJson(`${registryCdnUrl}/${path}/assetlist.json`),
    });
  }

  const testnetPromisesArray = [
    ...Array.from(testnetPromisesMap.values()).map(({ chainInfo }) => chainInfo),
    ...Array.from(testnetPromisesMap.values()).map(({ assetList }) => assetList),
  ];

  preventUnhandledRejections(...testnetPromisesArray);
  await Promise.allSettled(testnetPromisesArray);

  for (const { chainInfo, assetList } of testnetPromisesMap.values()) {
    try {
      const registryChain = await chainInfo;
      const { assets }: { assets: readonly RegistryAsset[] } = await assetList;
      const chain = getChainInfoFromJsons(registryChain, assets);

      if (isChainInfoFilled(chain)) {
        chains.testnets.set(chain.registryName, chain);
      }
    } catch {}
  }

  return chains;
};

const getParsedCdnLogoUri = (registryUri: string | undefined) => {
  if (!registryUri?.includes("github") || !registryUri.includes(chainRegistryRepo)) {
    return registryUri;
  }

  const [, path] = registryUri.split(`${chainRegistryRepo}/${repoBranch}`);
  return `${registryCdnUrl}${path}`;
};

const getLogoUri = (
  { logo_URIs: chainUris }: RegistryChain,
  { logo_URIs: firstAssetUris }: RegistryAsset,
) =>
  getParsedCdnLogoUri(chainUris?.svg) ||
  getParsedCdnLogoUri(chainUris?.png) ||
  firstAssetUris?.svg ||
  firstAssetUris?.png ||
  "";

const getChainInfoFromJsons = (
  registryChain: RegistryChain,
  registryAssets: readonly RegistryAsset[],
): ChainInfo => {
  const cdnRegistryAssets: readonly RegistryAsset[] = registryAssets.map(
    ({ logo_URIs, ...restProps }) => ({
      logo_URIs: logo_URIs
        ? {
            png: getParsedCdnLogoUri(logo_URIs.png) || "",
            svg: getParsedCdnLogoUri(logo_URIs.svg) || "",
          }
        : undefined,
      ...restProps,
    }),
  );

  const firstAsset = cdnRegistryAssets[0];
  const logo = getLogoUri(registryChain, firstAsset);
  let nodeAddresses = registryChain.apis?.rpc.map(({ address }) => address) ?? [];

  // Coreum: Prefer Polkachu RPC first – Foundation RPC returns 500 for large payloads (contract uploads).
  // See: https://github.com/cosmos/chain-registry – full-node.mainnet-1.coreum.dev fails on ~400KB requests.
  const isCoreum = registryChain.chain_name.toLowerCase().includes("coreum");
  if (isCoreum) {
    const polkachuMainnet = "https://coreum-rpc.polkachu.com";
    const polkachuTestnet = "https://full-node.testnet-1.coreum.dev:26657";
    const preferred = registryChain.chain_id?.toLowerCase().includes("testnet")
      ? polkachuTestnet
      : polkachuMainnet;
    nodeAddresses = [preferred, ...nodeAddresses.filter((a) => a !== preferred)];
  }

  let explorerLinks: ExplorerLinks = { tx: "", account: "" };

  // Prefer same explorer for both tx and account links
  for (const explorer of registryChain.explorers ?? []) {
    if (explorer.tx_page && explorer.account_page) {
      explorerLinks = { tx: explorer.tx_page, account: explorer.account_page };
      break;
    }

    if (!explorerLinks.tx && explorer.tx_page) {
      explorerLinks = { ...explorerLinks, tx: explorer.tx_page };
    }

    if (!explorerLinks.account && explorer.account_page) {
      explorerLinks = { ...explorerLinks, account: explorer.account_page };
    }
  }

  const firstAssetDenom = firstAsset.base;
  const displayUnit = firstAsset.denom_units.find((u) => u.denom == firstAsset.display);
  const displayDenom = displayUnit ? firstAsset.symbol : firstAsset.base;
  const displayDenomExponent = displayUnit
    ? displayUnit.exponent
    : firstAsset.denom_units[0].exponent;

  const feeToken = registryChain.fees?.fee_tokens.find(
    (token) => token.denom == firstAssetDenom,
  ) ?? { denom: firstAssetDenom };

  const gasPrice =
    feeToken.average_gas_price ??
    feeToken.low_gas_price ??
    feeToken.high_gas_price ??
    feeToken.fixed_min_gas_price ??
    0.03;

  const formattedGasPrice = firstAsset ? `${gasPrice}${firstAssetDenom}` : "";

  const coinType = registryChain.slip44;
  const restEndpoint = registryChain.apis?.rest?.[0]?.address;

  const chain: ChainInfo = {
    registryName: isCoreum ? "tx" : registryChain.chain_name,
    logo: isCoreum ? "/tx.png" : logo,
    addressPrefix: registryChain.bech32_prefix,
    chainId: registryChain.chain_id,
    chainDisplayName: isCoreum ? "TX" : registryChain.pretty_name,
    nodeAddresses,
    nodeAddress: "",
    explorerLinks: explorerLinks,
    denom: firstAssetDenom,
    displayDenom: isCoreum ? "TX" : displayDenom,
    displayDenomExponent,
    gasPrice: formattedGasPrice,
    ...(coinType !== undefined && { coinType }),
    ...(restEndpoint && { restEndpoint }),
    assets: isCoreum
      ? cdnRegistryAssets.map((asset) => {
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
                    unit.denom.toLowerCase().includes("core") && unit.exponent > 0
                      ? "TX"
                      : unit.denom,
                }))
              : asset.denom_units,
          };
        })
      : cdnRegistryAssets,
  };

  return chain;
};

export { getChainsFromRegistry, getShaFromRegistry };

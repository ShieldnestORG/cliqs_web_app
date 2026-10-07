/**
 * REST/LCD Endpoint Derivation
 *
 * File: lib/restEndpoints.ts
 *
 * Single source of truth for turning an RPC endpoint (plus the chain
 * registry's configured restEndpoint, when present) into an ordered list of
 * REST/LCD candidates. Shared by the validator governance queries
 * (lib/validatorHelpers.ts) and the contract code-registry live constraint
 * queries (lib/contract/codeRegistry.ts).
 */

/**
 * Derive REST/LCD endpoint candidates, best first.
 *
 * The chain's registry restEndpoint (ChainInfo.restEndpoint) is the
 * authoritative answer when present. The hostname swaps cover hosted providers
 * that pair rpc/api hostnames (e.g. coreum-rpc.polkachu.com ->
 * coreum-api.polkachu.com, verified live); the port swap covers self-hosted
 * nodes on the standard 26657/1317 pair. The raw RPC URL goes LAST, not first:
 * a Tendermint RPC host 404s REST paths, and the previous version returned
 * ONLY that URL for port-less hosted RPCs, which is why the gov v1 fallback
 * never worked on TX/Coreum.
 */
export function deriveRestEndpoints(rpcEndpoint: string, restEndpoint?: string): string[] {
  const endpoints: string[] = [];
  const push = (e: string) => {
    const trimmed = e.replace(/\/$/, "");
    if (trimmed && !endpoints.includes(trimmed)) {
      endpoints.push(trimmed);
    }
  };

  if (restEndpoint) {
    push(restEndpoint);
  }

  try {
    const url = new URL(rpcEndpoint);

    for (const [pattern, replacement] of [
      ["-rpc.", "-api."],
      ["-rpc.", "-rest."],
      ["rpc.", "api."],
      ["rpc.", "rest."],
    ] as const) {
      if (url.hostname.includes(pattern.replace(/\.$/, "."))) {
        const swapped = new URL(rpcEndpoint);
        swapped.hostname = url.hostname.replace(pattern, replacement);
        if (swapped.hostname !== url.hostname) {
          push(swapped.toString());
        }
      }
    }

    if (url.port === "26657") {
      const restPort = new URL(rpcEndpoint);
      restPort.port = "1317";
      push(restPort.toString());
    }
    if (url.port) {
      const noPort = new URL(rpcEndpoint);
      noPort.port = "";
      push(noPort.toString());
    }
  } catch {
    // Invalid URL, fall through to the raw endpoint
  }

  push(rpcEndpoint);
  return endpoints;
}

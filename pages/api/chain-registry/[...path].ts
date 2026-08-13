/**
 * Chain Registry Proxy
 *
 * File: pages/api/chain-registry/[...path].ts
 *
 * The browser cannot call api.github.com directly for the chain registry:
 * the unauthenticated limit is 60 requests/hour per visitor IP, and once it
 * trips GitHub answers without CORS headers, so the fetch fails outright and
 * ChainsContext is left with an empty chain list (no chains => nothing in the
 * app can query anything).
 *
 * Proxying server-side lets GITHUB_TOKEN apply (5,000 requests/hour) and puts
 * the response behind the CDN, so repeat visitors cost GitHub nothing.
 *
 * Scoped to cosmos/chain-registry on purpose – this must not become an open
 * GitHub proxy carrying our token.
 */

import type { NextApiRequest, NextApiResponse } from "next";

const registryRepo = "cosmos/chain-registry";

// Only the two shapes lib/chainRegistry.ts asks for.
const allowedPath = /^(commits\/[\w.-]+|contents(\/[\w.-]+)?)$/;

export default async function chainRegistryProxy(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.status(405).end();
    return;
  }

  const path = Array.isArray(req.query.path) ? req.query.path.join("/") : (req.query.path ?? "");

  if (!allowedPath.test(path)) {
    res.status(400).json({ error: `Unsupported chain registry path: ${path}` });
    return;
  }

  const token = process.env.GITHUB_TOKEN || process.env.MULTISIG_INDEXER_GITHUB_TOKEN || "";
  const url = `https://api.github.com/repos/${registryRepo}/${path}`;

  const callGithub = (withToken: boolean) =>
    fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "cliqs-web-app",
        ...(withToken && token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

  try {
    let ghRes = await callGithub(true);

    // An expired or revoked token would otherwise take the whole chain list down
    // with it. Anonymous access still gets 60/hour, and the CDN cache above means
    // that is plenty to keep the app alive until the token is rotated.
    if (token && (ghRes.status === 401 || ghRes.status === 403)) {
      console.warn(
        `[chain-registry] GITHUB_TOKEN rejected (${ghRes.status}); retrying anonymously`,
      );
      ghRes = await callGithub(false);
    }

    if (!ghRes.ok) {
      const detail = await ghRes.text();
      console.error(`[chain-registry] GitHub ${ghRes.status} for ${path}: ${detail.slice(0, 200)}`);
      res.status(ghRes.status).json({
        error: `GitHub returned ${ghRes.status} for ${path}`,
        rateLimitRemaining: ghRes.headers.get("x-ratelimit-remaining"),
      });
      return;
    }

    // The registry moves rarely; an hour of CDN cache keeps GitHub calls near zero.
    res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    res.status(200).json(await ghRes.json());
  } catch (err: unknown) {
    console.error("[chain-registry] Proxy request failed:", err);
    res.status(502).json({
      error: err instanceof Error ? err.message : "Failed to reach the chain registry",
    });
  }
}

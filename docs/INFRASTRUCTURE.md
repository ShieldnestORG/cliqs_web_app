# Infrastructure & Outage Notes

> **Cluster:** deployment · **Tags:** vercel, mongodb-atlas, chain-registry, outage, coreum, byodb · **Related:** [PRD.md](PRD.md), [SETUP.md](../SETUP.md), [multisig-indexer.md](multisig-indexer.md)

Operational reference for the deployed app. Written 2026-08-12 after a full-site outage; everything below was verified against the live deployment rather than inferred.

## Where this app actually lives

| Thing | Value |
|---|---|
| Production URL | `https://app.cliqs.io` |
| Vercel project | `cliqs-web-app` (team `shieldnestorg`) |
| Repo | `ShieldnestORG/cliqs_web_app` |
| Deploy method | **Vercel CLI (`vercel --prod`)** — the project has no git connection, so pushing to `main` ships nothing |

There is a second Vercel project named `cosmos-multisig-ui` with zero environment variables. It is a dead duplicate — ignore it.

## Outage post-mortem, 2026-08-12

Two independent failures. Either one alone breaks the site.

### 1. Chain registry fetch (fixed)

`lib/chainRegistry.ts` called `api.github.com` **from the browser**. Unauthenticated that is 60 requests/hour per visitor IP, and GitHub's rate-limited response carries no CORS headers, so the fetch failed hard instead of degrading:

```
Access to fetch at 'https://api.github.com/repos/cosmos/chain-registry/contents'
from origin 'https://app.cliqs.io' blocked by CORS policy
→ Failed to get chains from registry: TypeError: Failed to fetch
```

`context/ChainsContext/service.ts:73` only falls back to a cached chain list, so with a cold `localStorage` the failure was terminal — zero chains, and nothing downstream had a chain to query against. `GITHUB_TOKEN` was set on the project but unreadable, because the fetch runs client-side.

Fixed by routing those three calls through `pages/api/chain-registry/[...path].ts`, which applies the token server-side (5,000/hour), caches at the CDN for an hour, restricts paths to `cosmos/chain-registry`, and falls back to anonymous access if the token is ever rejected.

### 2. MongoDB Atlas cluster deleted (open)

The `cliqs` Atlas integration is **Suspended** and `cliqs.pya1snh.mongodb.net` returns **NXDOMAIN** — the cluster was deleted, not merely paused. Atlas M0 auto-pauses after 30 days of inactivity and can be reclaimed after prolonged inactivity.

Because `MONGODB_URI` is set, `lib/db.ts` deliberately refuses to fall back to `data/local-db.json`, so every DB route 500s rather than degrading.

**What survives this:** multisigs themselves. `lib/multisigRegistry.ts` → `ensureMultisigRegistered()` reads the threshold pubkey off-chain and recreates the record, provided the multisig has broadcast at least one transaction.
**What does not:** CLIQ names and descriptions, and any pending unbroadcast transactions.

Note that M0 has **no backups**. If CLIQ data becomes load-bearing, schedule a `mongodump`.

## Restoring the database

`lib/defaultMongoConfig.ts` reads only `MONGODB_URI` or `cliqs_MONGODB_URI`. Attaching a new Atlas integration through the Vercel dashboard injects a differently-prefixed variable that **nothing reads** — `MONGODB_URI` must be set explicitly.

A healthy free M0 already exists on the team (`atlas-fuchsia-zebra-payaable`, used by `accounts-payable`, 1.1 MB of 512 MB). Reusing it is legitimate: the M0 limit is one cluster per Atlas *project*, and this adds a database inside an existing cluster. Keep `MONGODB_DB_NAME=cliqs` so the two stay isolated.

Environment changes require a redeploy to take effect.

## Chain gotchas

- **The URL segment for Coreum is `tx`, not `coreum`.** `lib/chainRegistry.ts` rewrites Coreum's `registryName` to `tx` and its logo to `/tx.png`. Validator URLs are `app.cliqs.io/tx/validator?address=corevaloper1…`.
- Production defaults to `NEXT_PUBLIC_REGISTRY_NAME=cosmoshub`, so the app opens on Cosmos Hub rather than TX.
- The `tx.org` RPC endpoints listed in `cosmos/chain-registry` fail TLS handshake on two independent TLS stacks. `chainRegistry.ts` already prepends `https://coreum-rpc.polkachu.com` for Coreum, which is healthy.
- The validator dashboard read path (`lib/validatorHelpers.ts`) is **pure chain RPC with no database dependency** — viewing a validator works during a DB outage. Creating or signing a CLIQ transaction does not.

## BYODB

BYODB never replaces the default database silently. It activates only when the browser sends an `x-byodb-uri` header (`lib/byodb/middleware.ts`), stored client-side in Settings. A missing CLIQ is therefore not explained by BYODB unless that header is actually being sent.

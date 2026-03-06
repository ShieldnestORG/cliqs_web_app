# Multisig Indexer Service

In-repo Railway service for chain-aware multisig membership discovery.

## Scope

This service is designed to answer:

- which known multisigs a wallet address belongs to on a given chain
- which known multisigs a pubkey fingerprint belongs to on a given chain
- the canonical definition of a known multisig

It is chain-aware by `chainId`, works across Cosmos SDK chains, and is especially
intended to support Coreum/TX first.

## Current Capabilities

- Postgres-backed read API
- import API for app-created or manually imported multisigs
- chain refresh API that rehydrates membership from native multisig account pubkeys
- backfill API for known multisigs already in the index
- optional SSE stream for realtime UI hooks
- dynamic chain resolution from `cosmos/chain-registry`

## Endpoints

- `GET /health`
- `GET /v1/multisigs/by-address/:address?chain=<chainId>`
- `GET /v1/multisigs/by-pubkey/:pubkeyFingerprint?chain=<chainId>`
- `GET /v1/multisigs/:multisigAddress?chain=<chainId>`
- `GET /v1/multisigs/:multisigAddress/members?chain=<chainId>`
- `POST /v1/multisigs/import`
- `POST /v1/multisigs/refresh`
- `POST /v1/multisigs/backfill`
- `GET /v1/events`

## Required Environment

```env
PORT=8787
MULTISIG_INDEXER_DATABASE_URL=postgres://...
MULTISIG_INDEXER_API_KEY=
MULTISIG_INDEXER_REFRESH_INTERVAL_MS=0
MULTISIG_INDEXER_REFRESH_BATCH_SIZE=25
MULTISIG_INDEXER_CHAIN_CACHE_TTL_MS=900000
MULTISIG_INDEXER_CHAIN_REGISTRY_REPO=cosmos/chain-registry
MULTISIG_INDEXER_CHAIN_REGISTRY_BRANCH=master
MULTISIG_INDEXER_GITHUB_TOKEN=
MULTISIG_INDEXER_CHAIN_OVERRIDES_JSON={}
```

`MULTISIG_INDEXER_CHAIN_OVERRIDES_JSON` can pin or override RPC config when needed:

```json
{
  "coreum-mainnet-1": {
    "chainId": "coreum-mainnet-1",
    "addressPrefix": "core",
    "rpcEndpoints": ["https://coreum-rpc.polkachu.com"]
  }
}
```

## Local Run

From the repo root:

```bash
npm run indexer:start
```

## Railway

Create a new Railway service from this repo and use:

- Start command: `npm run indexer:start`
- Healthcheck path: `/health`

Attach a Postgres database and set `MULTISIG_INDEXER_DATABASE_URL` from the
database connection string.

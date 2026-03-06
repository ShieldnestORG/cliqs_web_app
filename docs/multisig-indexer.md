# Multisig Membership Indexer Contract

This app now treats external multisig discovery as a dedicated indexer domain:
`multisig membership discovery`.

An in-repo deployable service now lives at `services/multisig-indexer`.
For Railway, create a separate service from this repo and use
`npm run indexer:start` as the start command.

## Environment

Server-side variables consumed by the app:

```env
MULTISIG_INDEXER_URL=
MULTISIG_INDEXER_API_KEY=
MULTISIG_INDEXER_TIMEOUT_MS=8000
MULTISIG_INDEXER_BY_ADDRESS_PATH=/v1/multisigs/by-address/:address
MULTISIG_INDEXER_BY_PUBKEY_PATH=/v1/multisigs/by-pubkey/:pubkeyFingerprint
MULTISIG_INDEXER_IMPORT_PATH=/v1/multisigs/import
MULTISIG_INDEXER_MEMBERSHIP_PATH=
```

`MULTISIG_INDEXER_MEMBERSHIP_PATH` is an optional legacy fallback. Prefer the
split address/pubkey endpoints above for new Railway services.

## Read Endpoints

The app will call:

- `GET /v1/multisigs/by-address/:address?chain=<chainId>&chainId=<chainId>`
- `GET /v1/multisigs/by-pubkey/:pubkeyFingerprint?chain=<chainId>&chainId=<chainId>`

The app may also include these optional query params when available:

- `address`
- `pubkey`
- `pubkeyFingerprint`

Accepted response shapes:

```json
{
  "multisigs": [
    {
      "multisigAddress": "core1multisig...",
      "chainId": "coreum-mainnet-1",
      "label": "Treasury multisig",
      "description": "Optional description",
      "creator": "core1creator...",
      "threshold": 2,
      "pubkeyJSON": "{\"type\":\"tendermint/PubKeyMultisigThreshold\",\"value\":{\"threshold\":\"2\",\"pubkeys\":[...]}}"
    }
  ]
}
```

The app also accepts:

- a top-level array instead of `{ "multisigs": [...] }`
- `address` instead of `multisigAddress`
- `chain` instead of `chainId`
- `rawMultisigPubkey` instead of `pubkeyJSON`
- `members` with `pubkey` plus `threshold`, so the app can reconstruct `pubkeyJSON`

For native amino multisigs, returning `pubkeyJSON` is strongly recommended because
the app uses it to register unknown multisigs into its own DB immediately.

## Import Endpoint

The app publishes newly created or rehydrated multisigs to:

- `POST /v1/multisigs/import`

Request body:

```json
{
  "chainId": "coreum-mainnet-1",
  "multisigAddress": "core1multisig...",
  "type": "native_amino",
  "threshold": 2,
  "members": [
    {
      "address": "core1member1...",
      "pubkey": "<base64 compressed secp256k1>",
      "pubkeyFingerprint": "sha256:<hex>",
      "weight": 1,
      "position": 0
    }
  ],
  "label": "Treasury multisig",
  "description": "Optional description",
  "source": "app_import",
  "creator": "core1creator...",
  "rawMultisigPubkey": {
    "type": "tendermint/PubKeyMultisigThreshold",
    "value": {
      "threshold": "2",
      "pubkeys": []
    }
  }
}
```

Current source values sent by the app:

- `app_import`
- `account_pubkey`

## Current App Behavior

- Wallet connect queries the indexer first by address and pubkey fingerprint.
- Results are merged with the local DB and deduplicated by multisig address.
- Newly discovered multisigs are registered in the app DB.
- Multisigs created in the app are pushed to the indexer automatically.
- Multisigs rehydrated from on-chain account pubkeys are also pushed to the indexer.

## Scope Guarantee

This setup can discover:

- multisigs imported into the app
- multisigs already observed on-chain
- multisigs rehydrated from account pubkeys

It cannot discover:

- never-observed native multisigs that only exist off-chain

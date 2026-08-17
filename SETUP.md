# Cosmos Multisig UI - Local Setup

> **Cluster:** setup · **Tags:** setup, local-db, mongodb, byodb, data-retention, ci · **Related:** [Style Guide](docs/STYLE-GUIDE.md), [Infrastructure](docs/INFRASTRUCTURE.md)

This is a fork of the cosmos-multisig-ui project with a **local JSON-based database** instead of DGraph, making it easy to run locally without external dependencies.

## What Changed?

The original project used DGraph (a cloud-hosted GraphQL database) which is no longer maintained. This version replaces DGraph with a simple local JSON file-based database stored in the `data/` directory.

### Modified Files:

- **`lib/localDb.ts`** - New local JSON database implementation
- **`graphql/multisig.ts`** - Updated to use local database
- **`graphql/transaction.ts`** - Updated to use local database
- **`graphql/signature.ts`** - Updated to use local database
- **`graphql/nonce.ts`** - Updated to use local database
- **`graphql/index.ts`** - Removed GraphQL client dependency
- **`.gitignore`** - Added `/data` to ignore local database files
- **`.env.local`** - Created with local configuration

## Prerequisites

- Node.js v18+ (recommended)
- npm or yarn

## Installation & Setup

1. **Clone the repository** (if not already done):

```bash
git clone https://github.com/cosmos/cosmos-multisig-ui.git
cd cosmos-multisig-ui
```

2. **Install dependencies**:

```bash
npm install
```

3. **Environment Configuration**:
   The `.env.local` file is already configured with:

- `NEXT_PUBLIC_MULTICHAIN=true` - Enables multichain support
- `NEXT_PUBLIC_REGISTRY_NAME=cosmoshub` - Default chain registry
- `NEXT_PUBLIC_NODE_ADDRESS=https://rpc.cosmos.network:443` - Public RPC endpoint

You can modify these values as needed. To use a local node, change the `NEXT_PUBLIC_NODE_ADDRESS` to your local node URL (e.g., `http://localhost:26657`).

4. **Run the development server**:

```bash
npm run dev
```

The app will be available at `http://localhost:3003`.

## Database

The local database is stored as JSON in the `data/local-db.json` file. It will be automatically created when the app first runs. The database stores:

- **Multisigs**: Multisig account information
- **Transactions**: Transaction data
- **Signatures**: Signature information for transactions
- **Nonces**: Transaction nonces for accounts

### Database Schema:

```typescript
{
  "multisigs": [
    {
      "id": "unique-id",
      "chainId": "cosmoshub-4",
      "address": "cosmos1...",
      "creator": "cosmos1...",
      "pubkeyJSON": "{...}"
    }
  ],
  "transactions": [...],
  "signatures": [...],
  "nonces": [...]
}
```

### Resetting the Database:

To reset the database, simply delete the `data/` directory:

```bash
rm -rf data/
```

It will be recreated on the next run.

## Data retention & deletion (hosted MongoDB)

When `MONGODB_URI` (or `cliqs_MONGODB_URI`) is set, the app stores data in four
MongoDB collections:

| Collection     | Contents                                                                        |
| -------------- | ------------------------------------------------------------------------------- |
| `multisigs`    | chain id, address, creator, member pubkeys (`pubkeyJSON`), name, description    |
| `transactions` | transaction payloads (`dataJSON`: msgs, amounts, recipients, fee, memo), status |
| `signatures`   | per-member signatures linked to transactions                                    |
| `nonces`       | per-address login-replay counters                                               |

### Retention

- Completed (broadcast) transactions and their signatures are automatically
  deleted after `MONGODB_AUTO_CLEANUP_DAYS` days (default: 30). The cleanup runs
  on server startup.
- Everything else is kept until a member deletes it.

### Member deletion rights

All actions below require an ADR-36 wallet signature proving cliq membership and
are exposed in the app on the cliq dashboard's Transactions tab ("Data & Privacy"):

- **Export history** — download the full transaction history, including
  signatures, as JSON.
- **Wipe completed** — any verified member may delete all completed transactions
  and their signatures. On-chain records are unaffected.
- **Delete cliq** — removes pending transactions and the `multisigs` record
  itself (the cliq disappears for all members until re-imported; its name and
  description are unrecoverable). The API also exposes a `wipe all` mode that
  clears pending transactions without deleting the cliq record; it has no button
  in the app today. Both are refused with a `409` while pending transactions
  carry signatures from other members — cancel those transactions first.
- Nonces are never deleted: they are per-signer login-replay counters shared
  across cliqs.

Users with a custom database (BYODB, via the `x-byodb-uri` header) are exempt
from the membership gate — those operations run against their own database.

## Building for Production

```bash
npm run build
npm start
```

## Other Commands

- **Lint**: `npm run lint`
- **Format**: `npm run format` — rewrites files
- **Check formatting**: `npm run format:check` — read-only; **this one gates CI**
- **Test**: `npm test` (watch) / `npm run test:ci` (single run)

### CI

`.github/workflows/ci.yml` runs four jobs on every push and PR: `lint`, `format`,
`test`, `build`. All four must pass.

`format` runs `npm run format:check`, so an unformatted file fails the build even
though ESLint is clean — `eslint-config-prettier` disables formatting rules rather
than enforcing them, so lint cannot catch it. Run `npm run format` before pushing.

## Design system

UI work should follow [`docs/STYLE-GUIDE.md`](docs/STYLE-GUIDE.md), which carries the
current Coherence Daddy tokens and the naming traps worth knowing before touching
styles.

## Features

This app allows you to:

- Create multisig accounts on Cosmos chains
- Create transactions for multisig accounts
- Sign transactions with multiple signers
- Broadcast signed transactions to the network
- View transaction history and status

## Wallet Support

The app supports:

- **Keplr Wallet** - Browser extension wallet
- **Ledger** - Hardware wallet support

## Troubleshooting

### Port Already in Use

If you get a port error, the app will automatically try the next available port (3001, 3002, etc.). You can also specify a custom port:

```bash
PORT=3002 npm run dev
```

### RPC Connection Issues

If you're having trouble connecting to the RPC endpoint, try:

1. Using a different public RPC (see [Cosmos Chain Registry](https://github.com/cosmos/chain-registry))
2. Running a local node
3. Checking your firewall/network settings

### Database Issues

If you encounter database errors:

1. Delete the `data/` directory and restart
2. Check file permissions on the `data/` directory
3. Ensure you have write permissions in the project directory

## Contributing

This is a modified version for local development. For the original project, see:

- Original Repository: https://github.com/cosmos/cosmos-multisig-ui
- Documentation: https://github.com/cosmos/cosmos-multisig-ui/tree/main/docs

## License

Apache 2.0 - See LICENSE.md

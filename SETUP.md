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
   Copy `.env.sample` to `.env.local`. `.env.sample` is a curated starting point,
   **not** a complete inventory. The containment runs one way only: every variable
   in `.env.sample` is read somewhere in the code, but the code reads 66 distinct
   names in total, so most are absent from the sample. `.env.sample` has **16**
   active assignments (`grep -cE '^[A-Z0-9_]+=' .env.sample`), leaving **50**
   absent; counting the two commented-out migration entries at `.env.sample:17-18`
   — which `scripts/migrate-mongo-to-mongo.mjs:36-37` does read — gives 18 and 48.
   Missing names include
   `NEXT_PUBLIC_NODE_ADDRESSES` (which this file tells you to set, below),
   `NEXT_PUBLIC_CHAIN_ID`, `NEXT_PUBLIC_GAS_PRICE`, `NEXT_PUBLIC_EXPLORER_LINKS`,
   `NEXT_PUBLIC_ENABLE_DEVTOOLS`, `GITHUB_TOKEN`, the indexer service's own
   `MULTISIG_INDEXER_PG_*` / `MULTISIG_INDEXER_CHAIN_*` / `MULTISIG_INDEXER_REFRESH_*`
   settings, and platform ambients such as `NODE_ENV` and `VERCEL`. Regenerate the
   real list from tracked files (counts above were produced by this command):

```bash
git ls-files '*.ts' '*.tsx' '*.js' '*.mjs' \
  | xargs grep -hoE 'process\.env\.[A-Z0-9_]+' \
  | sed 's/process\.env\.//' | sort -u
```

   The variables that matter for a first run are:

- `NEXT_PUBLIC_MULTICHAIN=true` - Enables multichain support
- `NEXT_PUBLIC_REGISTRY_NAME=cosmoshub` - Default chain registry
- `NEXT_PUBLIC_TESTNETS_ENABLED=false` - Show testnets in the chain selector

Leave `MONGODB_URI` blank for local development; the app then uses
`data/local-db.json`. Setting it switches the app to MongoDB with **no** local
fallback (a connection failure throws rather than degrading).

To point the app at specific nodes, set `NEXT_PUBLIC_NODE_ADDRESSES` — note the
**plural**, and note it is parsed as a **JSON array**, not a bare URL:

```
NEXT_PUBLIC_NODE_ADDRESSES=["http://localhost:26657"]
```

`context/ChainsContext/storage.ts` (`getChainFromEnvfile`) reads it, and only for
the chain named by `NEXT_PUBLIC_REGISTRY_NAME`. A singular
`NEXT_PUBLIC_NODE_ADDRESS` is read by nothing and is silently ignored.

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
  once per server process, inside `initDb()` — in practice on the first API
  request after a cold start, not on a timer.
- Everything else is kept until a member deletes it.
- Do not confuse `MONGODB_AUTO_CLEANUP_DAYS` with `DATA_RETENTION_DAYS`
  (default: 90). The latter is display-only: `getRetentionDays()` renders a
  "N days" label in the two create-cliq forms and deletes nothing.
  `DATA_WARNING_DAYS_BEFORE` and `MAX_STORAGE_PER_USER_KB` **are** read
  (`lib/dataRetention.ts:23` and `:30`), but nothing surfaces them: the only
  reader of the first is `getWarningDaysBefore()`, called at `lib/dataRetention.ts:46`
  by `getRetentionInfo()`, which itself has no caller outside that file;
  `getMaxStorageKB()` has no caller anywhere. So both are dead *transitively* —
  reachable code with no live entry point — rather than simply unreferenced.
  `MONGODB_AUTO_CLEANUP_DAYS` is the only variable that actually removes records.

### Member deletion rights

All actions below require an ADR-36 wallet signature proving cliq membership and
are exposed in the app on the cliq dashboard's Transactions tab ("Data & Privacy"):

- **Export history** — download the full transaction history, including
  signatures, as JSON.
- **Wipe completed** — any verified member may delete the `broadcast`
  transactions and their signatures. Pending transactions and the cliq itself
  survive. On-chain records are unaffected.
- **Delete cliq** — cascades in order: every signature attached to the cliq's
  transactions, then **every** transaction (pending *and* broadcast), then the
  `multisigs` row itself. The cliq disappears for all members until someone
  re-imports it; address and member pubkeys are recoverable on-chain, its name
  and description are not.
- The API also exposes a third `wipe` mode, `all`, which deletes **every**
  transaction and signature but keeps the `multisigs` row. It has no button in
  the app — `TransactionPrivacy.tsx` only ever sends `completed` and `multisig`.
- Both `all` and `multisig` are refused with a `409` while any pending
  transaction carries a signature from an address other than the caller's —
  cancel those transactions first.
- Nonces are never deleted: they are per-signer login-replay counters shared
  across cliqs.

Users with a custom database (BYODB, via the `x-byodb-uri` header) are exempt
from the membership gate — those operations run against their own database. The
`409` other-member-signature guard is skipped on that path too, since there is no
verified caller address to compare against.

On the local JSON database none of the three deletions are implemented: the API
returns a `localDbNotice` telling you to edit or remove `data/local-db.json`
yourself.

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

In dev, if 3003 is taken Next increments from the configured port and retries — 3004, 3005, and so on (up to 10 attempts). To choose a port yourself, pass the flag through npm with `--`:

```bash
npm run dev -- -p 3005
```

`PORT=3005 npm run dev` does **not** work: `package.json` hard-codes `next dev -p 3003`, and an explicit `-p` flag beats the `PORT` env var. Omitting the `--` does not work either — npm consumes `-p` as its own `--parseable` flag and Next then reads the number as a directory argument.

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

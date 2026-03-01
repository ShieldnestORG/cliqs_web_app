# Cosmos Multisig UI - Local Setup

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

## Building for Production

```bash
npm run build
npm start
```

## Other Commands

- **Lint**: `npm run lint`
- **Format**: `npm run format`
- **Test**: `npm test`

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







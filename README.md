# Cosmos Multisig UI (CLIQs)

This app allows multisig users to create, sign, and broadcast transactions on any Stargate-enabled Cosmos chain. Built with CosmJS, Next.js, React, and MongoDB (or local JSON for development).

[User guide](https://github.com/samepant/cosmoshub-legacy-multisig/blob/master/docs/App%20User%20Guide.md)

## Quick Start

```bash
npm install
cp .env.sample .env.local    # Edit as needed
npm run dev                   # Runs on http://localhost:3003
```

See [SETUP.md](SETUP.md) for detailed local setup, including MongoDB Atlas, local JSON database, and BYODB (Bring Your Own Database).

## Architecture

- **Database**: MongoDB Atlas (production), or local JSON file (`data/local-db.json`) for development. Users can also bring their own MongoDB via Settings (BYODB).
- **Framework**: Next.js 15, React 19
- **Wallet**: Keplr, Ledger (WebUSB)

## Port

The dev and production servers run on **port 3003** (configurable via `npm run dev -p <port>`).

## Known Issues

### npm audit – elliptic / Keplr

`npm audit` may report vulnerabilities in the `elliptic` package (transitive dependency of `@keplr-wallet/cosmos`). Fixing this would require downgrading Keplr to an older version, which is a breaking change. We document this for awareness; track upstream Keplr updates for a resolution.

## License

Apache 2.0 – See [LICENSE.md](LICENSE.md).

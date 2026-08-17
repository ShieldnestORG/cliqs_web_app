# Cosmos Multisig UI (CLIQs)

> **Cluster:** overview · **Tags:** readme, root-index, cosmos, multisig, nextjs · **Related:** [SETUP.md](SETUP.md), [INFRASTRUCTURE.md](docs/INFRASTRUCTURE.md), [Security docs](docs/security/README.md), [STYLE-GUIDE.md](docs/STYLE-GUIDE.md)

This app allows multisig users to create, sign, and broadcast transactions on any Stargate-enabled Cosmos chain. Built with CosmJS, Next.js, React, and MongoDB (or local JSON for development).

[User guide](https://github.com/samepant/cosmoshub-legacy-multisig/blob/master/docs/App%20User%20Guide.md)

## Quick Start

```bash
npm install
cp .env.sample .env.local    # Edit as needed
npm run dev                   # Runs on http://localhost:3003
```

**New Docs**: [PRD.md](docs/PRD.md), [User Guide](docs/App%20User%20Guide.md), [Appendix](docs/Appendix/). See [SETUP.md](SETUP.md) for dev/prod., including MongoDB Atlas, local JSON database, BYODB (Bring Your Own Database), and off-chain data retention/deletion.

**Operations**: [INFRASTRUCTURE.md](docs/INFRASTRUCTURE.md) — where production lives, how it is deployed, the 2026-08-12 outage post-mortem, chain/database gotchas, security headers, and the BYODB SSRF guard.

**Security**: [docs/security/](docs/security/README.md) — folder index. [SOC2-GAP-ASSESSMENT.md](docs/security/SOC2-GAP-ASSESSMENT.md) is the technical-controls gap assessment against the Security TSC: full API route inventory, remediations shipped, and the prioritized follow-up list.

**Design**: [STYLE-GUIDE.md](docs/STYLE-GUIDE.md) is the canonical token reference (Coherence Daddy colours, Geist typography, radius/elevation/motion scales). Read it before touching styles — it documents two naming traps that silently produce no CSS. Component specs live in [docs/ui/](docs/ui/INDEX.md).

**Services & performance**: [multisig-indexer.md](docs/multisig-indexer.md) (optional external discovery indexer and its HTTP contract), [BUNDLE_OPTIMIZATION_PRD.md](docs/BUNDLE_OPTIMIZATION_PRD.md) (bundle-size work, complete).

**Debugging & history**: [DEBUG-WITHDRAW-COMMISSION.md](docs/DEBUG-WITHDRAW-COMMISSION.md), [MANUAL_TEST_TRANSACTION_CREATION_NAVIGATION.md](docs/MANUAL_TEST_TRANSACTION_CREATION_NAVIGATION.md), [docs/dev-notes/](docs/dev-notes/) (point-in-time fix write-ups), [docs/legacy/](docs/legacy/README.md) (retired DGraph schema, historical reference only).

## Architecture

- **Database**: MongoDB Atlas (production), or local JSON file (`data/local-db.json`) for development. Users can also bring their own MongoDB via Settings (BYODB).
- **Framework**: Next.js 15, React 19
- **Wallet**: Keplr, Ledger (WebUSB)

## Port

The dev and production servers run on **port 3003** — both `dev` and `start` hard-code `-p 3003` in `package.json`.

To override, pass the flag through npm with `--`: `npm run dev -- -p 3005`. Without the `--`, npm swallows `-p` as its own `--parseable` flag and Next treats the number as a directory argument. A bare `PORT=3005` is also ignored, because the explicit `-p` flag beats the `PORT` env var.

## Known Issues

### npm audit – elliptic / Keplr

`npm audit` and SCA scanners flag `elliptic`. The honest position is **present but unreachable**, not absent: no private key ever enters this process, so there is no secret for the nonce bug to leak.

**Two copies ship**, and only one of them is visible to npm:

1. `elliptic@6.6.1` via `@keplr-wallet/cosmos` → `@keplr-wallet/crypto` → `bip32@2.0.6` → `tiny-secp256k1@1.1.7`. This is the path `npm ls elliptic` prints and the one the advisory names.
2. An undeclared copy vendored inside `node_modules/next/dist/compiled/crypto-browserify/index.js`, reached through Next's default browser polyfill for Node's `crypto`. `npm ls` cannot see it and no `package.json` walk will find it.

An `npm overrides` pin reaches copy 1 **only** — copy 2 lives inside Next's precompiled output, outside npm resolution — so "just override it" is not an available remediation. Removing copy 1 would mean downgrading Keplr, a breaking change. Track upstream Keplr updates for a resolution.

Broader dependency remediation (protobufjs/sharp/postcss overrides) is in flight in **PR #29, which is open and not merged**. See [SOC2-GAP-ASSESSMENT.md](docs/security/SOC2-GAP-ASSESSMENT.md) domain 9 for the full analysis.

## License

Apache 2.0 – See [LICENSE.md](LICENSE.md).

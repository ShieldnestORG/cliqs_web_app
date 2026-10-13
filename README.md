# Cosmos Multisig UI (CLIQs)

> **Cluster:** overview · **Tags:** readme, root-index, cosmos, multisig, nextjs · **Related:** [SETUP.md](SETUP.md), [INFRASTRUCTURE.md](docs/INFRASTRUCTURE.md), [Security docs](docs/security/README.md), [STYLE-GUIDE.md](docs/STYLE-GUIDE.md), [CLAUDE.md](CLAUDE.md), [House style](#house-style)

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

## House style

> The colours, radii, shadows, easing and tracking of the app come from the house style, the one design system for every product (private repo `ShieldnestORG/house-style`, checkout `~/Downloads/Claude/house-style`). Unit 2 of its migration, 2026-10-12. Both themes ship: dark is the default, light follows the OS or `data-theme="light"` on `<html>`.

| File | What |
|---|---|
| `styles/house-style.tokens.css` | The canonical `tokens.css`, vendored at the commit in its first line (`VENDORED-FROM: ShieldnestORG/house-style 459c6b5`), unchanged but for that line: `:root` is dark, `:root[data-theme="light"]` and an OS-light media block hold light. 123 `--hs-*` tokens. **Never edit it.** |
| `styles/house-style.bridge.css` | The shadcn variables (`--background`, `--primary`, `--destructive`, `--border` ... 71 of them) as HSL triplets, **generated** from the house style's `tokens.json` and the `bridge` map of its `check/adapters/cliqs.json` at the same commit. **Never edit it.** |
| `styles/globals.css` | The app's own rules. No colour literal may appear in it: a colour is `hsl(var(--x))` or a `var(--hs-*)`. |
| `scripts/vendor-house-style.mjs` | `node scripts/vendor-house-style.mjs <sha>` re-vendors; `--check` exits 1 if the file is not what it produces. |
| `scripts/build-bridge.mjs` | `node scripts/build-bridge.mjs` regenerates the bridge; `--check` exits 1 if it is stale or hand-edited. |
| `scripts/check-house-style.mjs` | The gate (also the first step of `npm run test:ci`): vendor `--check`, bridge `--check`, the house style's own `check/drift.mjs` at the same commit (every bridged token equal in both themes), `scripts/raw-colour.sh` (prints nothing when clean), the import order in `pages/_app.tsx`. |

**To change a colour:** change it in the house style (`tokens.css`, then its `tokens.json`), commit there, then `node scripts/vendor-house-style.mjs <new sha> && node scripts/build-bridge.mjs && npm run check:house-style`. To bridge one more variable, add it to the `bridge` map of the adapter in the house-style repo first. The gate needs the house-style checkout (`HOUSE_STYLE=<dir>` if it is elsewhere).

**Themes:** there is no `.dark` class in this app (`tailwind.config.js` sets `darkMode: ["class"]` and nothing ever adds the class, `dark:` is unused), so the only theme switch is the house style's: the `data-theme` attribute on `<html>`, or no attribute to follow the OS. No theme button exists yet.

**Textures:** the app canvas (`html` in `styles/globals.css`) carries the pinstripe and the coral haze, both tokens that change with the theme. The one coral block with a header gradient, the donate dialog, carries the scanlines. Cards and panels paint their own fill over the canvas.

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

# SOC2 Gap Assessment — Security Trust Services Criteria (Technical Controls)

> **Cluster:** security · **Tags:** soc2, api-auth, headers, secrets, audit-log, rate-limiting, ssrf · **Related:** [INFRASTRUCTURE.md](../INFRASTRUCTURE.md), [SETUP.md](../../SETUP.md), [PR #29 deps](https://github.com/ShieldnestORG/cliqs_web_app/pull/29)

**Updated:** 2026-08-16
**Scope:** Technical controls only. Organizational policies (personnel, vendor mgmt, change mgmt) are out of scope for this code repo.
**Method:** Static review of the working tree; every finding cites file:line. Facts tagged VERIFIED / INFERRED / ASSUMED.

## Executive summary

The dominant gap is **authorization**: before this PR, 36 of 38 API routes read or mutated multisig data with no proof the caller is a member — including destructive operations (wipe history, cancel transactions, pause a multisig, mint role credentials). This PR remediates the highest-risk destructive routes (wipe, export), adds security headers, gates the debug endpoint out of production, strips sensitive payload logging, and closes the BYODB SSRF hole with DNS-resolving host validation. Still open: uniform authorization across the remaining routes (L1), a security audit log (L2 — there is currently no record of who did what), rate limiting (L3), SSRF validation for client-supplied RPC endpoints (L4), error-message minimization (L5), BYODB export authorization (L6), and a Content-Security-Policy. Secrets hygiene is good and is documented here as audit evidence. Dependency remediation is in flight separately as [PR #29](https://github.com/ShieldnestORG/cliqs_web_app/pull/29).

## Scope & methodology

Reviewed: every file under `pages/api/` (38 route handlers — all read in full or grep-swept for auth checks), the BYODB layer (`lib/byodb/*`), database adapters (`lib/db.ts`, `lib/mongodb.ts`, `lib/localDb.ts`), `next.config.js`, `_document.tsx`, environment handling, and `.gitignore`/git history for secrets.

Deployment context (VERIFIED against [INFRASTRUCTURE.md](../INFRASTRUCTURE.md)): production is `https://app.cliqs.io` on Vercel (project `cliqs-web-app`), deployed via Vercel CLI; the database is MongoDB Atlas, with a local JSON fallback for development and an optional user-supplied MongoDB ("BYODB") selected per-request via the `x-byodb-uri` header.

Tags used throughout: **VERIFIED** = the file was read or the command was run during this assessment; **INFERRED** = platform-default reasoning, not tested against the live deploy; **ASSUMED** = explicitly flagged assumption.

## Control domains

### 1. API authentication & authorization — CC6.1

The only real authentication model in the app is ADR-36 wallet-signature verification: decode the signature, check the pubkey is a member of the multisig (`pubkeyJSON`), enforce a server-side incrementing nonce (replay protection), then `verifyKeplrSignature`. Before this PR it existed on exactly one route (`transaction/list`); this PR extends it to the two most dangerous data routes (wipe, export).

| Finding | Evidence | Status |
|---|---|---|
| 36/38 routes had no authentication; most still don't | Appendix A | **Open — L1** |
| `transaction/wipe` (deletes all tx history for a multisig) was callable by anyone | `pages/api/transaction/wipe/index.ts` | **Remediated (this PR)** — ADR-36 sig + membership + nonce (VERIFIED in-tree) |
| `transaction/export` (full history dump) was callable by anyone | `pages/api/transaction/export/index.ts` | **Remediated (this PR)** — same pattern (VERIFIED in-tree) |
| Reference auth pattern to extract into middleware | `pages/api/transaction/list/index.ts:32-56` | Reusable for L1 |
| `multisig/list` accepts an unverified `{address, pubkey}` path and its signature path falls through on verification failure and proceeds anyway | `pages/api/chain/[chainId]/multisig/list/index.ts:76-88` | **Open — L1** |
| `credentials/issue` mints role credentials with field validation only — no issuer authorization; `actor` on emergency/credential routes is a self-asserted body field | `credentials/issue.ts`, `emergency/pause.ts:28-31` | **Open — L1** |
| Anyone can cancel any transaction or overwrite its `txHash` | `pages/api/transaction/[transactionID]/index.ts:30-41` | **Open — L1** |

### 2. Transport & security headers — CC6.7

| Finding | Evidence | Status |
|---|---|---|
| No security headers at all were sent (no `headers()` in `next.config.js`, no root `middleware.ts`) | pre-PR `next.config.js:1-21` | **Remediated (this PR)** — HSTS (2y, includeSubDomains), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera/mic/geolocation off) on every route |
| No Content-Security-Policy | `next.config.js` (comment documents the rationale) | **Open — follow-up.** Deliberately not shipped in this PR: the app loads Google Fonts (`_document.tsx`) and connects to arbitrary user-supplied RPC/DB endpoints, so an untested CSP risks breaking production. Needs a report-only rollout first |
| TLS is Vercel-terminated; Atlas connections use TLS via `mongodb+srv://` | INFRASTRUCTURE.md:11 | INFERRED (platform default) — acceptable; HSTS now asserts downgrade protection |

### 3. Secrets management — CC6.1 (good — documented as evidence)

All VERIFIED during the assessment sweep:

| Finding | Evidence | Status |
|---|---|---|
| No hardcoded credentials anywhere in tracked files (grep for token/key/URI-with-credentials patterns hit only doc placeholders) | `lib/userJourneys.ts:487`, `components/DatabaseSettings.tsx:795` (placeholder), `scripts/migrate-mongo-to-mongo.mjs:9-10` (comment) | Good |
| `.env.local` git-ignored and absent from all git history | `.gitignore:30`, `git log --all -- .env.local` empty | Good |
| Secrets read from env only | `lib/defaultMongoConfig.ts:1-4`, chain-registry proxy, `services/multisig-indexer/server.mjs:17` | Good |
| All 20 `NEXT_PUBLIC_*` vars are non-sensitive config (chain id, denom, node address, flags) — no secret crosses the client boundary | grep inventory | Good |
| BYODB connection strings are supplied per-request by the client and not stored server-side | `lib/byodb/middleware.ts:94-125` | Good (see domains 4 and 7 for the flip side) |

### 4. Input validation & injection — CC6.1 / CC8.1

| Finding | Evidence | Status |
|---|---|---|
| NoSQL injection: the one `$regex` query is escaped in both backends; other queries use equality filters | `lib/db.ts:220`, `lib/mongodb.ts:204` | Good |
| Import path is strongly validated: zod schema, array/string caps, 50MB body limit | `lib/byodb/importValidator.ts:21-80` | Good |
| BYODB/setup/test-connection URIs could point the server at internal hosts (SSRF) | pre-PR `db/setup.ts`, `db/test-connection.ts`, `dynamicMongo.ts` | **Remediated (this PR)** — `lib/byodb/hostValidation.ts` resolves every host via DNS and rejects private/reserved targets; applied in both routes and inside `getDynamicDb`/`testConnection`, so the `x-byodb-uri` header path is covered too. SRV URIs are validated by resolving `_mongodb._tcp.<host>` targets, so Atlas URIs still work (VERIFIED against a live Atlas cluster) |
| Client-supplied RPC endpoints (`body.chain`) still reach `StargateClient.connect` unvalidated | `multisig/list`, `multisig/[multisigAddress]/ensure.ts` | **Open — L4** (same helper is reusable) |
| Address/chainId params are checked for type/presence only — no bech32/format validation | all `chain/[chainId]/[address]/*` routes | **Open — follow-up** (was QW5 in the investigation; not done in this PR) |

### 5. Audit logging & accountability — CC7.2 / CC7.3

| Finding | Evidence | Status |
|---|---|---|
| No security audit trail exists: no record of who created, signed, broadcast, cancelled, or wiped anything | absence VERIFIED across `pages/api/` and `lib/` | **Open — L2** (core SOC2 gap) |
| Existing "event" records are feature state, not audit: emergency events, credential events, the Phase-4 event-stream design — none records an authenticated principal, none is tamper-evident | `lib/emergency/pause-controller.ts:93,183,245`, `lib/localDb.ts:255` | **Open — L2** |
| Verbose payload logging (~20 `console.log` DEBUG lines writing full tx bodies, amounts, and memos to Vercel logs) | pre-PR `pages/api/transaction/index.ts:41-107` | **Remediated (this PR)** — terse operational logs only, no payloads/amounts/memos |
| Debug endpoint live in production | `pages/api/debug/compare-signdoc.ts` | **Remediated (this PR)** — returns 404 when `NODE_ENV === "production"`; kept for dev (used via curl per `docs/DEBUG-WITHDRAW-COMMISSION.md`; no UI caller exists — grep-VERIFIED) |

### 6. Error handling & information disclosure — CC6.7

| Finding | Evidence | Status |
|---|---|---|
| DB routes sanitize connection strings out of error messages before returning them | `test-connection.ts`, `setup.ts`, `db/export.ts:93-96`, `db/import.ts:190-193` | Good |
| Other routes return raw `err.message` to the client — app-level messages, not stack traces (no `.stack` is serialized anywhere — VERIFIED), but they leak internal detail | e.g. `transaction/list/index.ts:64-66`, `emergency/pause.ts:64-68` | **Open — L5** (low-moderate) |

### 7. Rate limiting & abuse prevention — CC6.6

| Finding | Evidence | Status |
|---|---|---|
| No rate limiting anywhere in the Next.js app — no limiter, no middleware, no per-IP throttle (the only limiter lives in the separate indexer service) | grep VERIFIED | **Open — L3** |
| Unauthenticated mutating routes are therefore also unthrottled; BYODB routes let a caller use the server as an outbound connection engine at any rate (target scope now restricted by the SSRF guard, rate still unbounded) | domains 1, 4 | **Open — L3** |

### 8. Data protection (in transit / at rest) — CC6.7 / C1.1

| Finding | Evidence | Status |
|---|---|---|
| In transit: TLS via Vercel + `mongodb+srv://`; HSTS now asserted by the app | domain 2 | Good (INFERRED for platform TLS) |
| At rest: MongoDB Atlas provides at-rest encryption (INFERRED — platform-side, not repo-configurable). ASSUMED: production uses Atlas, not the JSON fallback | INFRASTRUCTURE.md, `lib/defaultMongoConfig.ts` | Acceptable |
| Local JSON fallback stores data plaintext on disk — dev-only, git-ignored | `data/local-db.json`, `.gitignore:33` | Acceptable (dev-only) |
| Data-retention cleanup exists (`DATA_RETENTION_DAYS`) — a minimization control worth citing to auditors | `lib/dataRetention.ts:16` | Good |

### 9. Dependency & vulnerability management — CC7.1

| Finding | Evidence | Status |
|---|---|---|
| [PR #29](https://github.com/ShieldnestORG/cliqs_web_app/pull/29) resolves 80/87 dependabot alerts (the critical and all 47 high) via overrides for protobufjs/sharp/postcss | `gh pr view 29` — **open, not merged** at time of writing | **In flight — do not redo** |
| `elliptic` (CVE-2025-14505) — **two copies ship in the client bundle**, so expect an SCA scan to flag it as *present*: (1) `elliptic@6.6.1` via `@keplr-wallet/cosmos` → `@keplr-wallet/crypto` → `bip32@2.0.6` → `tiny-secp256k1@1.1.7`, which is what `npm ls` and the advisory name; (2) an older undeclared copy vendored inside `node_modules/next/dist/compiled/crypto-browserify`, reached through Next's default browser polyfill for Node's `crypto` and shipped in the `_app` chunk — invisible to `npm ls` and to any `package.json` walk. The honest position is **present but unreachable**, not absent. Primary basis for unreachability: no private key ever enters this process, so there is no secret for the nonce bug to leak regardless of how many copies ship; a runtime probe showing `tiny-secp256k1` never calls `elliptic`'s sign corroborates copy (1) only and says nothing about copy (2). Note an `npm overrides` pin would reach copy (1) ONLY — copy (2) is vendored inside Next's compiled output and is unreachable by npm resolution, so "just override it" is not an available remediation | `README.md` Known Issues; dependency-path and adversarial-verification analysis performed in the PR #29 workstream (not independently re-verified here) | Documented exception — pending upstream Keplr |
| The 6 `svelte` alerts (via `vanilla-jsoneditor`) are **not exploitable in our usage**; upgrade planned as hygiene, not remediation. Five are SSR-only and the package ships a DOM-mode-only prebuilt bundle (no SSR marker in `.next/server` output); the sixth needs a spread-attribute `<form>`, which the package does not contain | Reachability analysis performed in the PR #29 workstream (not independently re-verified here) | Not exploitable — upgrade is hygiene |
| **Anti-pattern to refuse:** an npm `override` forcing `svelte` 5 under the old package drops `npm audit` 8→6 while changing zero bytes of shipped code. That is alert-laundering, not remediation | Same analysis | Policy note |
| `.npmrc` sets `legacy-peer-deps=true`; `package.json` uses caret ranges throughout — ongoing dependency-drift context | `.npmrc` | Note only |

## Prioritized remediation plan

Effort: **S** = <1hr, **M** = a few hrs, **L** = design + multi-file.

### Quick wins — this PR

| # | Control | Risk | Effort | Status |
|---|---|---|---|---|
| QW1 | Security headers via `headers()` in `next.config.js` | High | S | **Done (this PR)** — CSP excluded, see domain 2 |
| QW2 | Gate debug route out of production; put ADR-36 auth on the live-but-unwired wipe route | Med | S | **Done (this PR)** — debug 404s in prod; wipe/export now authenticated |
| QW3 | Strip verbose payload logging from transaction create | Med | S | **Done (this PR)** |
| QW4 | SSRF host validation for BYODB targets (`setup`, `test-connection`, `dynamicMongo`) + wrap both routes in `withByodbMiddleware` | High | M | **Done (this PR)** — DNS-resolving validation incl. SRV; Atlas verified working |
| QW5 | Input format validation (bech32 address, chainId shape) | Med | M | **Open — follow-up** (not in this PR) |
| QW6 | Document env & secrets handling as audit evidence | Low | S | **Done (this PR)** — domain 3 |

### Larger items — tracked follow-ups

| # | Control | Current state | Risk | Effort |
|---|---|---|---|---|
| L1 | **Uniform authn/authz on mutating routes** — extract the `transaction/list` ADR-36 pattern into middleware and apply everywhere | 4/38 routes authenticated after this PR; `multisig/list` still falls through on sig failure | **Critical** | L |
| L2 | **Security audit log** (actor, action, timestamp, tamper-evident) for tx create/sign/broadcast/cancel/wipe + emergency + credential ops | None | High | L |
| L3 | **Rate limiting / abuse controls** | None in the app | High | M |
| L4 | **SSRF validation for client-supplied RPC endpoints** (`multisig/list`, `ensure`) — reuse `lib/byodb/hostValidation.ts`; also close the two residuals on the Mongo path — DNS rebinding (the driver re-resolves after validation) and replica-set discovery (a validated public mongod can advertise private member addresses in its hello response, which the driver connects to unvalidated; `directConnection=true` for non-SRV URIs would close it) | Mongo URIs covered at connect time by this PR; RPC URLs still open | High | M |
| L5 | **Error-message minimization** on non-DB routes | Raw `err.message` returned | Low-Med | S-M |
| L6 | **BYODB export authorization** — `db/export.ts` dumps whatever DB the `x-byodb-uri` header names | Header trust model undefined | Med | M |
| — | **Content-Security-Policy** — report-only rollout first (Google Fonts + user-supplied endpoints make an untested CSP a production risk) | No CSP | Med | M |

## Appendix A — Full API route inventory

All 38 route handlers under `pages/api/`. Methods VERIFIED by sweeping every handler's `req.method` dispatch. Auth column reflects the tree **after** this PR.

| # | Route | Methods | Auth | Notes |
|---|---|---|---|---|
| 1 | `/api/chain-registry/[...path]` | GET | None (by design) | Well-scoped proxy: path allowlist, repo pinned to `cosmos/chain-registry`, server-side token with anonymous fallback |
| 2 | `/api/chain/[chainId]/[address]/emergency/pause` | POST | **None** | Anyone can pause/unpause any multisig; `actor` self-asserted |
| 3 | `/api/chain/[chainId]/[address]/emergency/safe-mode` | POST | **None** | Anyone can toggle safe mode |
| 4 | `/api/chain/[chainId]/[address]/emergency/status` | GET | **None** | Reads emergency state |
| 5 | `/api/chain/[chainId]/[address]/monitoring/alerts` | GET | **None** | Reads alerts |
| 6 | `/api/chain/[chainId]/[address]/monitoring/incidents` | GET, POST, PUT | **None** | Anyone can create/acknowledge incidents |
| 7 | `/api/chain/[chainId]/[address]/monitoring/metrics` | GET | **None** | Reads metrics |
| 8 | `/api/chain/[chainId]/[address]/policies/[policyId]` | GET, PUT, DELETE | **None** | Full CRUD on spend-limit/timelock policies for any address |
| 9 | `/api/chain/[chainId]/[address]/policies` | GET, POST | **None** | List/create policies |
| 10 | `/api/chain/[chainId]/contract-multisig/[address]` | GET, POST | **None** | Read/sync/verify-vote/verify-execute/reconcile actions |
| 11 | `/api/chain/[chainId]/contract-multisig/[address]/snapshots` | GET | **None** | Reads snapshots |
| 12 | `/api/chain/[chainId]/contract-multisig` | GET, POST | **None** | Create/list contract multisigs |
| 13 | `/api/chain/[chainId]/credentials/[address]` | GET | **None** | Reads credentials for any address |
| 14 | `/api/chain/[chainId]/credentials/class` | GET, POST | **None** | Create/read credential classes |
| 15 | `/api/chain/[chainId]/credentials/issue` | POST | **None** | Mints role credentials — field validation only, no issuer authorization |
| 16 | `/api/chain/[chainId]/credentials/revoke` | POST | **None** | `actor` self-asserted |
| 17 | `/api/chain/[chainId]/credentials/rotate` | POST | **None** | `actor` self-asserted |
| 18 | `/api/chain/[chainId]/credentials/verify` | GET | **None** | Verifies a credential |
| 19 | `/api/chain/[chainId]/group/[address]` | GET, POST | **None** | Read/update group |
| 20 | `/api/chain/[chainId]/group/[address]/members` | GET, PATCH | **None** | Read/patch group members |
| 21 | `/api/chain/[chainId]/multisig/[multisigAddress]/ensure` | POST | **None** | **SSRF (open, L4)**: connects to client-supplied `body.chain` RPC |
| 22 | `/api/chain/[chainId]/multisig/[multisigAddress]` | GET | **None** | Reads any multisig by address |
| 23 | `/api/chain/[chainId]/multisig` | POST | **None** | Creates a multisig record |
| 24 | `/api/chain/[chainId]/multisig/list` | POST | **Sig, decorative** | Unverified `{address, pubkey}` path supported; sig path falls through on verification failure. **SSRF (open, L4)** via `body.chain` RPC |
| 25 | `/api/chain/[chainId]/nonce/[address]` | GET | **None** | Nonce read/issue (supports the ADR-36 flow) |
| 26 | `/api/db/export` | POST | **None** | Default-DB path returns stats only (good); **BYODB path dumps the entire DB the header names (open, L6)**. Mongo target now SSRF-validated (this PR) |
| 27 | `/api/db/import` | POST | **None** (BYODB-only) | Refuses default DB; zod-validated; 50MB cap; SSRF-validated (this PR) |
| 28 | `/api/db/setup` | POST | **None** | **Remediated (this PR)**: SSRF host validation + `withByodbMiddleware` |
| 29 | `/api/db/stats` | GET | **None** | Shared default-DB storage stats |
| 30 | `/api/db/test-connection` | POST | **None** | **Remediated (this PR)**: SSRF host validation + `withByodbMiddleware` |
| 31 | `/api/debug/compare-signdoc` | POST | **None** | **Remediated (this PR)**: 404 in production; dev-only signdoc diff tool |
| 32 | `/api/transaction/[transactionID]` | GET, POST | **None** | GET reads any tx; POST cancels any tx or overwrites its `txHash` |
| 33 | `/api/transaction/[transactionID]/signature` | POST | **None** | Attaches an unverified signature record to any tx |
| 34 | `/api/transaction/export` | POST | **ADR-36 (this PR)** | Sig + membership + nonce verification added in this PR |
| 35 | `/api/transaction` | POST | **None** | Creates txs + imports signatures for any multisig; verbose payload logging removed (this PR) |
| 36 | `/api/transaction/list` | POST | **ADR-36** | The reference pattern: sig decode → membership → nonce increment → verify |
| 37 | `/api/transaction/pending` | POST | **None** | Reads any multisig's pending txs by address alone |
| 38 | `/api/transaction/wipe` | POST | **ADR-36 (this PR)** | Was: anyone could delete all tx history; sig + membership + nonce added in this PR |

## Appendix B — Evidence index

File:line references grouped by control for auditor traceability. Lines cited from the tree as of this PR; the pre-PR anchors are noted where the code was removed.

**Authentication & authorization (CC6.1)**
- Reference ADR-36 pattern: `pages/api/transaction/list/index.ts:32-56`
- Fall-through on failed verification: `pages/api/chain/[chainId]/multisig/list/index.ts:76-88`
- This PR's wipe/export auth: `pages/api/transaction/wipe/index.ts`, `pages/api/transaction/export/index.ts` (`verifyKeplrSignature` + `pubkeyJSON` membership + nonce)
- Self-asserted actor: `pages/api/chain/[chainId]/[address]/emergency/pause.ts:28-31`

**Headers (CC6.7)**
- `next.config.js` — `securityHeaders` + `headers()` (this PR); CSP-exclusion rationale in the adjacent comment

**Secrets (CC6.1)**
- `.gitignore:30` (`.env*.local`), `.gitignore:33` (`/data`)
- `lib/defaultMongoConfig.ts:1-4` (env-only reads); `git log --all -- .env.local` → empty

**Input validation & SSRF (CC6.1 / CC8.1)**
- `lib/byodb/hostValidation.ts` (this PR) — DNS-resolving private/reserved-range validation, SRV-aware
- Enforcement points: `lib/byodb/dynamicMongo.ts` (`getDynamicDb`, `testConnection`), `pages/api/db/setup.ts`, `pages/api/db/test-connection.ts`
- `lib/byodb/importValidator.ts:21-80` (zod import schema); `lib/db.ts:220`, `lib/mongodb.ts:204` (regex escaping)
- Open RPC SSRF: `body.chain` usage in `multisig/list` and `multisig/[multisigAddress]/ensure.ts`

**Audit logging (CC7.2 / CC7.3)**
- Absence: no principal-recording, tamper-evident log anywhere under `pages/api/` or `lib/`
- Feature-state events (not audit): `lib/emergency/pause-controller.ts:93,183,245`, `lib/localDb.ts:255`
- Removed payload logging: pre-PR `pages/api/transaction/index.ts:41-107`

**Error handling (CC6.7)**
- URI sanitizers: `pages/api/db/setup.ts`, `test-connection.ts`, `db/export.ts:93-96`, `db/import.ts:190-193`
- Raw `err.message` returns: `pages/api/transaction/list/index.ts:64-66`, `emergency/pause.ts:64-68`

**Rate limiting (CC6.6)**
- Absence: no limiter in the Next.js app (grep `ratelimit|rate-limit` hits only docs and `services/multisig-indexer`)

**Data protection (CC6.7 / C1.1)**
- `docs/INFRASTRUCTURE.md:11` (production URL/platform); `lib/dataRetention.ts:16` (retention control)

**Dependencies (CC7.1)**
- [PR #29](https://github.com/ShieldnestORG/cliqs_web_app/pull/29) (open); `README.md` Known Issues (elliptic/Keplr); `.npmrc` (`legacy-peer-deps=true`)

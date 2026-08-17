# SOC2 Gap Assessment — Security Trust Services Criteria (Technical Controls)

> **Cluster:** security · **Tags:** soc2, api-auth, headers, secrets, audit-log, rate-limiting, ssrf · **Related:** [Security docs index](README.md), [INFRASTRUCTURE.md](../INFRASTRUCTURE.md), [SETUP.md](../../SETUP.md), [PR #29 deps](https://github.com/ShieldnestORG/cliqs_web_app/pull/29)

**Written:** 2026-08-16 local (PDT), immediately before PR #31 merged.
**Re-verified:** 2026-08-16 local (PDT) against `main` at commit `e5c69cc` (PR #31 **merged**; GitHub records `mergedAt` as 2026-08-17T06:08:53Z, the same moment in UTC). Status language below now reads "#31" rather than "this PR"; every remediation marked done was re-checked in the merged tree.
**Scope:** Technical controls only. Organizational policies (personnel, vendor mgmt, change mgmt) are out of scope for this code repo.
**Method:** Static review of the working tree; every finding cites file:line. Facts tagged VERIFIED / INFERRED / ASSUMED.

## Executive summary

The dominant gap is **authorization**: before PR #31, 36 of 38 API routes read or mutated multisig data with no proof the caller is a member — including destructive operations (wipe history, cancel transactions, pause a multisig, mint role credentials). #31 remediated the highest-risk destructive routes (wipe, export), added security headers, gated the debug endpoint out of production, stripped sensitive payload logging, and closed the BYODB SSRF hole with DNS-resolving host validation. Still open: uniform authorization across the remaining routes (L1), a security audit log (L2 — there is currently no record of who did what), rate limiting (L3), SSRF validation for client-supplied RPC endpoints (L4), error-message minimization (L5), BYODB export authorization (L6), and a Content-Security-Policy. Secrets hygiene is good and is documented here as audit evidence. Dependency remediation is **still in flight and unmerged** as [PR #29](https://github.com/ShieldnestORG/cliqs_web_app/pull/29).

Net position after #31: **3 of 38 routes carry real ADR-36 authorization** (`transaction/list`, `transaction/wipe`, `transaction/export`), a fourth (`multisig/list`) accepts a signature but does not enforce it. Everything else is still open to any caller.

## Scope & methodology

Reviewed: every file under `pages/api/` (38 route handlers — all read in full or grep-swept for auth checks), the BYODB layer (`lib/byodb/*`), database adapters (`lib/db.ts`, `lib/mongodb.ts`, `lib/localDb.ts`), `next.config.js`, `_document.tsx`, environment handling, and `.gitignore`/git history for secrets.

Deployment context (VERIFIED against [INFRASTRUCTURE.md](../INFRASTRUCTURE.md)): production is `https://app.cliqs.io` on Vercel (project `cliqs-web-app`), deployed via Vercel CLI; the database is MongoDB Atlas, with a local JSON fallback for development and an optional user-supplied MongoDB ("BYODB") selected per-request via the `x-byodb-uri` header.

Tags used throughout: **VERIFIED** = the file was read or the command was run during this assessment; **INFERRED** = platform-default reasoning, not tested against the live deploy; **ASSUMED** = explicitly flagged assumption.

## Control domains

### 1. API authentication & authorization — CC6.1

The only real authentication model in the app is ADR-36 wallet-signature verification: decode the signature, check the pubkey is a member of the multisig (`pubkeyJSON`), enforce a server-side incrementing nonce (replay protection), then `verifyKeplrSignature`. Before #31 it existed on exactly one route (`transaction/list`); #31 extended it to the two most dangerous data routes (wipe, export).

Grep-VERIFIED on merged `main`: `verifyKeplrSignature` is referenced by exactly four files under `pages/api/` — `transaction/list`, `transaction/wipe`, `transaction/export`, and `chain/[chainId]/multisig/list` (the decorative one).

| Finding | Evidence | Status |
|---|---|---|
| 36/38 routes had no authentication; most still don't | Appendix A | **Open — L1** |
| `transaction/wipe` (deletes all tx history for a multisig) was callable by anyone | `pages/api/transaction/wipe/index.ts` | **Remediated (#31, merged)** — ADR-36 sig + membership + nonce (VERIFIED in-tree) |
| `transaction/export` (full history dump) was callable by anyone | `pages/api/transaction/export/index.ts` | **Remediated (#31, merged)** — same pattern (VERIFIED in-tree) |
| `transaction/wipe` gained a `multisig` mode that cascades signatures → transactions → the `multisigs` row (`db.deleteMultisig`). Blast radius is now larger than before, which is why the auth above is load-bearing. Modes `all` and `multisig` return `409` if a pending tx carries a signature from a non-caller address — note that guard is keyed on `callerAddress`, so it does not run on the BYODB path | `pages/api/transaction/wipe/index.ts:32,120-146` | Shipped with #31 — accepted (member-scoped, own data) |
| Reference auth pattern to extract into middleware | `pages/api/transaction/list/index.ts:32-56` | Reusable for L1 |
| `multisig/list` accepts an unverified `{address, pubkey}` path and its signature path falls through on verification failure and proceeds anyway | `pages/api/chain/[chainId]/multisig/list/index.ts:76-88` | **Open — L1** |
| `credentials/issue` mints role credentials with field validation only — no issuer authorization; `actor` on emergency/credential routes is a self-asserted body field | `credentials/issue.ts`, `emergency/pause.ts:28-31` | **Open — L1** |
| Anyone can cancel any transaction or overwrite its `txHash` | `pages/api/transaction/[transactionID]/index.ts:30-41` | **Open — L1** |

### 2. Transport & security headers — CC6.7

| Finding | Evidence | Status |
|---|---|---|
| No security headers at all were sent (no `headers()` in `next.config.js`, no root `middleware.ts`) | pre-#31 `next.config.js:1-21`; now `next.config.js:9-15` (`securityHeaders`) and `:21-28` (`headers()`) | **Remediated (#31, merged)** — HSTS (`max-age=63072000; includeSubDomains`, no `preload`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera/mic/geolocation off), applied at `source: "/:path*"` so pages and API routes both get them. VERIFIED in the merged tree; **not** re-measured against the live deploy |
| No Content-Security-Policy | `next.config.js:5-8` (comment documents the rationale) | **Open — follow-up.** Deliberately excluded from #31: the app loads Google Fonts (`_document.tsx`) and connects to arbitrary user-supplied RPC/DB endpoints, so an untested CSP risks breaking production. Needs a report-only rollout first |
| TLS is Vercel-terminated; Atlas connections use TLS via `mongodb+srv://` | INFRASTRUCTURE.md:13 | INFERRED (platform default) — acceptable; HSTS now asserts downgrade protection |

### 3. Secrets management — CC6.1 (good — documented as evidence)

All VERIFIED during the assessment sweep:

| Finding | Evidence | Status |
|---|---|---|
| No hardcoded credentials anywhere in tracked files (grep for token/key/URI-with-credentials patterns hit only doc placeholders) | `lib/userJourneys.ts:524`, `components/DatabaseSettings.tsx:795` (placeholder), `scripts/migrate-mongo-to-mongo.mjs:9-10` (comment) | Good |
| `.env.local` git-ignored and absent from all git history | `.gitignore:30`, `git log --all -- .env.local` empty | Good |
| Secrets read from env only | `lib/defaultMongoConfig.ts:1-4`, chain-registry proxy, `services/multisig-indexer/server.mjs:17` | Good |
| All 18 distinct `NEXT_PUBLIC_*` vars read across `lib/`, `pages/`, `components/`, `context/` are non-sensitive config (chain id, denom, node addresses, flags) — no secret crosses the client boundary | grep inventory (re-counted 2026-08-16; an earlier draft said 20) | Good |
| BYODB connection strings are supplied per-request by the client and not stored server-side | `lib/byodb/middleware.ts:94-125` | Good (see domains 4 and 7 for the flip side) |

### 4. Input validation & injection — CC6.1 / CC8.1

| Finding | Evidence | Status |
|---|---|---|
| NoSQL injection: the one `$regex` query is escaped in both backends; other queries use equality filters | `lib/db.ts:220`, `lib/mongodb.ts:204` | Good |
| Import path is strongly validated: zod schema, array/string caps, 50MB body limit | `lib/byodb/importValidator.ts:21-80` | Good |
| BYODB/setup/test-connection URIs could point the server at internal hosts (SSRF) | pre-#31 `db/setup.ts`, `db/test-connection.ts`, `dynamicMongo.ts` | **Remediated (#31, merged)** — `lib/byodb/hostValidation.ts` resolves every host via DNS and rejects loopback/RFC-1918/CGNAT/link-local (incl. `169.254.169.254`)/reserved targets; enforced at four call sites — `pages/api/db/setup.ts:38`, `pages/api/db/test-connection.ts:49`, and `lib/byodb/dynamicMongo.ts:121` (`getDynamicDb`) / `:176` (`testConnection`) — so the `x-byodb-uri` header path is covered too. (The route anchors previously given, `setup.ts:15` and `test-connection.ts:17`, are the `import` lines, not the calls.) SRV URIs are validated by resolving `_mongodb._tcp.<host>` targets, so Atlas URIs still work (Atlas working state VERIFIED during the #31 workstream; not re-run here) |
| Client-supplied RPC endpoints (`body.chain`) still reach `StargateClient.connect` unvalidated | `multisig/list`, `multisig/[multisigAddress]/ensure.ts` | **Open — L4** (same helper is reusable) |
| Address/chainId params are checked for type/presence only — no bech32/format validation | all `chain/[chainId]/[address]/*` routes | **Open — follow-up** (was QW5 in the investigation; not done in #31) |

### 5. Audit logging & accountability — CC7.2 / CC7.3

| Finding | Evidence | Status |
|---|---|---|
| No security audit trail exists: no record of who created, signed, broadcast, cancelled, or wiped anything | absence VERIFIED across `pages/api/` and `lib/` | **Open — L2** (core SOC2 gap) |
| Existing "event" records are feature state, not audit: emergency events, credential events, the Phase-4 event-stream design — none records an authenticated principal, none is tamper-evident | `lib/emergency/pause-controller.ts:93,183,245`, `lib/localDb.ts:255` | **Open — L2** |
| Verbose payload logging (~20 `console.log` DEBUG lines writing full tx bodies, amounts, and memos to Vercel logs) | pre-#31 `pages/api/transaction/index.ts:41-107` | **Remediated (#31, merged)** — exactly one `console.log` remains in the file (`:78`, a tx id), no payloads/amounts/memos (re-VERIFIED by grep count) |
| Debug endpoint live in production | `pages/api/debug/compare-signdoc.ts:70-71` | **Remediated (#31, merged)** — returns 404 when `NODE_ENV === "production"`; kept for dev (used via curl per `docs/DEBUG-WITHDRAW-COMMISSION.md`; no UI caller exists — grep-VERIFIED) |

### 6. Error handling & information disclosure — CC6.7

| Finding | Evidence | Status |
|---|---|---|
| DB routes sanitize connection strings out of error messages before returning them | `test-connection.ts`, `setup.ts`, `db/export.ts:93-96`, `db/import.ts:190-193` | Good |
| Other routes return raw `err.message` to the client — app-level messages, not stack traces (no `.stack` is serialized anywhere — VERIFIED), but they leak internal detail | e.g. `transaction/list/index.ts:64-66`, `emergency/pause.ts:64-68` | **Open — L5** (low-moderate) |

### 7. Rate limiting & abuse prevention — CC6.6

| Finding | Evidence | Status |
|---|---|---|
| No rate limiting anywhere in the Next.js app — no limiter, no middleware, no per-IP throttle. **Correction (2026-08-16):** an earlier draft said "the only limiter lives in the separate indexer service". That is wrong — the indexer has a request **body-size** cap (`MULTISIG_INDEXER_REQUEST_BODY_LIMIT_BYTES`, default 512 KB, `services/multisig-indexer/server.mjs:34,182`), which is not a rate limit. There is no rate limiter anywhere in this repo | grep VERIFIED (`ratelimit\|rate-limit\|rateLimit` hits only a GitHub response header in the chain-registry proxy and prose in these docs) | **Open — L3** |
| Unauthenticated mutating routes are therefore also unthrottled; BYODB routes let a caller use the server as an outbound connection engine at any rate (target scope now restricted by the SSRF guard, rate still unbounded) | domains 1, 4 | **Open — L3** |

### 8. Data protection (in transit / at rest) — CC6.7 / C1.1

| Finding | Evidence | Status |
|---|---|---|
| In transit: TLS via Vercel + `mongodb+srv://`; HSTS now asserted by the app | domain 2 | Good (INFERRED for platform TLS) |
| At rest: MongoDB Atlas provides at-rest encryption (INFERRED — platform-side, not repo-configurable). ASSUMED: production uses Atlas, not the JSON fallback | INFRASTRUCTURE.md, `lib/defaultMongoConfig.ts` | Acceptable |
| Local JSON fallback stores data plaintext on disk — dev-only, git-ignored | `data/local-db.json`, `.gitignore:33` | Acceptable (dev-only) |
| Data-retention cleanup exists — a minimization control worth citing to auditors. **Correction (2026-08-16):** an earlier draft credited `DATA_RETENTION_DAYS` (`lib/dataRetention.ts:16`). That variable deletes nothing: `getRetentionDays()` is consumed only as a "N days" label in `CreateContractCliqForm` and `CreateFlexCliqForm`. A further correction to that correction: `getWarningDaysBefore`/`getMaxStorageKB` were described as having "no consumers at all", which overstates it — `DATA_WARNING_DAYS_BEFORE` and `MAX_STORAGE_PER_USER_KB` are both read (`lib/dataRetention.ts:23`, `:30`) and `getWarningDaysBefore()` **is** called, at `lib/dataRetention.ts:46` inside `getRetentionInfo()`. The accurate statement is that `getRetentionInfo` has no caller outside its own file and `getMaxStorageKB` has none at all, so both env vars are dead *transitively*, not unreferenced (VERIFIED: `git ls-files '*.ts' '*.tsx' \| xargs grep -n 'getRetentionInfo\|getMaxStorageKB\|getWarningDaysBefore'` returns only definitions plus the intra-file call at `:46`). The real control is `MONGODB_AUTO_CLEANUP_DAYS` (default 30), which drives `mongoDb.autoCleanup` to delete `broadcast` transactions and their signatures | `lib/db.ts:720-724` (`initDb`), `lib/mongodb.ts:621-651` | Good — but cite the right variable |
| Member-invoked deletion added by #31: export / wipe-completed / delete-cliq, ADR-36-gated, surfaced in `components/dataViews/TransactionPrivacy.tsx`. Supports a data-subject-deletion narrative; documented for users in `SETUP.md` | `pages/api/transaction/wipe/index.ts`, `lib/db.ts:555-582` (`deleteMultisig`) | Good (new with #31) |

### 9. Dependency & vulnerability management — CC7.1

| Finding | Evidence | Status |
|---|---|---|
| [PR #29](https://github.com/ShieldnestORG/cliqs_web_app/pull/29) resolves 80/87 dependabot alerts (the critical and all 47 high) via overrides for protobufjs/sharp/postcss | **Still open and unmerged as of 2026-08-16** — VERIFIED: `package.json` on merged `main` contains no `overrides` block. Do not describe this work as shipped | **In flight — do not redo** |
| `elliptic` (CVE-2025-14505) — **two copies ship in the client bundle**, so expect an SCA scan to flag it as *present*: (1) `elliptic@6.6.1` via `@keplr-wallet/cosmos` → `@keplr-wallet/crypto` → `bip32@2.0.6` → `tiny-secp256k1@1.1.7`, which is what `npm ls` and the advisory name; (2) an older undeclared copy vendored inside `node_modules/next/dist/compiled/crypto-browserify`, reached through Next's default browser polyfill for Node's `crypto` and shipped in the `_app` chunk — invisible to `npm ls` and to any `package.json` walk. The honest position is **present but unreachable**, not absent. Primary basis for unreachability: no private key ever enters this process, so there is no secret for the nonce bug to leak regardless of how many copies ship; a runtime probe showing `tiny-secp256k1` never calls `elliptic`'s sign corroborates copy (1) only and says nothing about copy (2). Note an `npm overrides` pin would reach copy (1) ONLY — copy (2) is vendored inside Next's compiled output and is unreachable by npm resolution, so "just override it" is not an available remediation | `README.md` Known Issues. **Correction (2026-08-16):** an earlier draft of this row offered a `shortw` curve-preset token in Next's vendored file as evidence and labelled it independently re-verified. That token does not exist — `grep -ic "shortw" node_modules/next/dist/compiled/crypto-browserify/index.js` returns **0**. What follows states only what the commands actually return, each re-run in full for this revision. Let `$F` = `node_modules/next/dist/compiled/crypto-browserify/index.js`. **(a)** `npm ls elliptic` → `cosmos-multisig-ui → @keplr-wallet/cosmos@0.12.313 → @keplr-wallet/crypto@0.12.313 → bip32@2.0.6 → tiny-secp256k1@1.1.7 → elliptic@6.6.1`. **(b)** `grep -ic elliptic $F` → **0**: the vendored copy carries no package name, so a name grep and any `package.json` walk both miss it. **(c)** `$F` does carry elliptic's curve presets — `grep -o 'type:"short"' $F \| wc -l` → **6**, and the same form gives `type:"edwards"` → **1**, `type:"mont"` → **1**, `curve25519` → **1**, `ed25519` → **5**. **(d)** `grep -o 79be667e $F \| wc -l` → **1** — elliptic's secp256k1 generator x-coordinate. **(e)** the same constant appears **twice** in the built client chunk `.next/static/chunks/pages/_app-a7980641ca8d5141.js` (content hash is local-build-specific; glob `_app-*.js`), which likewise greps **0** for the literal `elliptic` — so elliptic code does reach the browser bundle. Constant-matching cannot distinguish the two copies, so (e) does not prove *which* one landed there. The *unreachability* argument (no private key in-process) is carried over from the #29 workstream and was **not** re-derived here | Documented exception — pending upstream Keplr |
| The 6 `svelte` alerts (via `vanilla-jsoneditor`) are **not exploitable in our usage**; upgrade planned as hygiene, not remediation. Five are SSR-only and the package ships a DOM-mode-only prebuilt bundle (no SSR marker in `.next/server` output); the sixth needs a spread-attribute `<form>`, which the package does not contain | Reachability analysis performed in the PR #29 workstream (not independently re-verified here) | Not exploitable — upgrade is hygiene |
| **Anti-pattern to refuse:** an npm `override` forcing `svelte` 5 under the old package drops `npm audit` 8→6 while changing zero bytes of shipped code. That is alert-laundering, not remediation | Same analysis | Policy note |
| `.npmrc` sets `legacy-peer-deps=true`; `package.json` uses caret ranges throughout — ongoing dependency-drift context | `.npmrc` | Note only |

## Prioritized remediation plan

Effort: **S** = <1hr, **M** = a few hrs, **L** = design + multi-file.

### Quick wins — shipped in PR #31 (merged)

| # | Control | Risk | Effort | Status |
|---|---|---|---|---|
| QW1 | Security headers via `headers()` in `next.config.js` | High | S | **Done (#31, merged)** — CSP excluded, see domain 2 |
| QW2 | Gate debug route out of production; put ADR-36 auth on the live-but-unwired wipe route | Med | S | **Done (#31, merged)** — debug 404s in prod; wipe/export now authenticated |
| QW3 | Strip verbose payload logging from transaction create | Med | S | **Done (#31, merged)** |
| QW4 | SSRF host validation for BYODB targets (`setup`, `test-connection`, `dynamicMongo`) + wrap both routes in `withByodbMiddleware` | High | M | **Done (#31, merged)** — DNS-resolving validation incl. SRV; Atlas verified working during the workstream |
| QW5 | Input format validation (bech32 address, chainId shape) | Med | M | **Open — follow-up** (not in #31) |
| QW6 | Document env & secrets handling as audit evidence | Low | S | **Done (#31, merged)** — domain 3 |

### Larger items — tracked follow-ups

| # | Control | Current state | Risk | Effort |
|---|---|---|---|---|
| L1 | **Uniform authn/authz on mutating routes** — extract the `transaction/list` ADR-36 pattern into middleware and apply everywhere | 3/38 routes enforce ADR-36 after #31 (`transaction/list`, `wipe`, `export`); a 4th, `multisig/list`, accepts a signature but falls through on verification failure | **Critical** | L |
| L2 | **Security audit log** (actor, action, timestamp, tamper-evident) for tx create/sign/broadcast/cancel/wipe + emergency + credential ops | None | High | L |
| L3 | **Rate limiting / abuse controls** | None in the app | High | M |
| L4 | **SSRF validation for client-supplied RPC endpoints** (`multisig/list`, `ensure`) — reuse `lib/byodb/hostValidation.ts`; also close the two residuals on the Mongo path — DNS rebinding (the driver re-resolves after validation) and replica-set discovery (a validated public mongod can advertise private member addresses in its hello response, which the driver connects to unvalidated; `directConnection=true` for non-SRV URIs would close it) | Mongo URIs covered at connect time by #31; RPC URLs still open | High | M |
| L5 | **Error-message minimization** on non-DB routes | Raw `err.message` returned | Low-Med | S-M |
| L6 | **BYODB export authorization** — `db/export.ts` dumps whatever DB the `x-byodb-uri` header names | Header trust model undefined | Med | M |
| — | **Content-Security-Policy** — report-only rollout first (Google Fonts + user-supplied endpoints make an untested CSP a production risk) | No CSP | Med | M |

## Appendix A — Full API route inventory

All 38 route handlers under `pages/api/`. Methods VERIFIED by sweeping every handler's `req.method` dispatch. Auth column reflects merged `main` **after** PR #31.

**Re-verified 2026-08-16 on merged `main`:** the handler count is still exactly 38 (`find pages/api -name "*.ts" | wc -l`), the file list below matches the tree one-for-one, every Methods cell was re-checked against the handler's `req.method` dispatch (including the `switch`-style ones), and the Auth column was re-checked by grepping `verifyKeplrSignature` across `pages/api/`. Note what that command returns: `grep -rn verifyKeplrSignature pages/api/` prints **10 line hits** (imports, call sites, and two explanatory comments) spread across **4 files** — it is the file count, not the line count, that matches the four rows marked below. `grep -rl verifyKeplrSignature pages/api/` is the command that prints 4. No route gained or lost authorization since the assessment was written.

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
| 26 | `/api/db/export` | POST | **None** | Default-DB path returns stats only (good); **BYODB path dumps the entire DB the header names (open, L6)**. Mongo target now SSRF-validated (#31) |
| 27 | `/api/db/import` | POST | **None** (BYODB-only) | Refuses default DB; zod-validated; 50MB cap; SSRF-validated (#31) |
| 28 | `/api/db/setup` | POST | **None** | **Remediated (#31)**: SSRF host validation + `withByodbMiddleware` |
| 29 | `/api/db/stats` | GET | **None** | Shared default-DB storage stats |
| 30 | `/api/db/test-connection` | POST | **None** | **Remediated (#31)**: SSRF host validation + `withByodbMiddleware` |
| 31 | `/api/debug/compare-signdoc` | POST | **None** | **Remediated (#31)**: 404 in production; dev-only signdoc diff tool |
| 32 | `/api/transaction/[transactionID]` | GET, POST | **None** | GET reads any tx; POST cancels any tx or overwrites its `txHash` |
| 33 | `/api/transaction/[transactionID]/signature` | POST | **None** | Attaches an unverified signature record to any tx |
| 34 | `/api/transaction/export` | POST | **ADR-36 (#31)** | Sig + membership + nonce verification added in #31 |
| 35 | `/api/transaction` | POST | **None** | Creates txs + imports signatures for any multisig; verbose payload logging removed (#31) |
| 36 | `/api/transaction/list` | POST | **ADR-36** | The reference pattern: sig decode → membership → nonce increment → verify |
| 37 | `/api/transaction/pending` | POST | **None** | Reads any multisig's pending txs by address alone |
| 38 | `/api/transaction/wipe` | POST | **ADR-36 (#31)** | Was: anyone could delete all tx history; sig + membership + nonce added in #31. Modes `completed` / `all` / `multisig`; `multisig` also deletes the `multisigs` row. `all` and `multisig` `409` when a pending tx holds a non-caller signature. Only `completed` and `multisig` have UI buttons |

## Appendix B — Evidence index

File:line references grouped by control for auditor traceability. Lines cited from merged `main` as of 2026-08-16 and re-checked then; the pre-#31 anchors are noted where the code was removed.

**Authentication & authorization (CC6.1)**
- Reference ADR-36 pattern: `pages/api/transaction/list/index.ts:32-56`
- Fall-through on failed verification: `pages/api/chain/[chainId]/multisig/list/index.ts:76-88`
- #31's wipe/export auth: `pages/api/transaction/wipe/index.ts:80-113`, `pages/api/transaction/export/index.ts:70-102` (`verifyKeplrSignature` + `pubkeyJSON` membership + nonce)
- Shared-data guard on destructive wipe modes: `pages/api/transaction/wipe/index.ts:120-137`
- Self-asserted actor: `pages/api/chain/[chainId]/[address]/emergency/pause.ts:28-31`

**Headers (CC6.7)**
- `next.config.js` — `securityHeaders` + `headers()` (#31); CSP-exclusion rationale in the adjacent comment

**Secrets (CC6.1)**
- `.gitignore:30` (`.env*.local`), `.gitignore:33` (`/data`)
- `lib/defaultMongoConfig.ts:1-4` (env-only reads); `git log --all -- .env.local` → empty

**Input validation & SSRF (CC6.1 / CC8.1)**
- `lib/byodb/hostValidation.ts` (#31) — DNS-resolving private/reserved-range validation, SRV-aware
- Enforcement points (the `assertPublicMongoTarget` **call** lines, not the imports): `lib/byodb/dynamicMongo.ts:121` (`getDynamicDb`), `:176` (`testConnection`), `pages/api/db/setup.ts:38`, `pages/api/db/test-connection.ts:49`
- `lib/byodb/importValidator.ts:21-80` (zod import schema); `lib/db.ts:220`, `lib/mongodb.ts:204` (regex escaping)
- Open RPC SSRF: `body.chain` usage in `multisig/list` and `multisig/[multisigAddress]/ensure.ts`

**Audit logging (CC7.2 / CC7.3)**
- Absence: no principal-recording, tamper-evident log anywhere under `pages/api/` or `lib/`
- Feature-state events (not audit): `lib/emergency/pause-controller.ts:93,183,245`, `lib/localDb.ts:255`
- Removed payload logging: pre-#31 `pages/api/transaction/index.ts:41-107`; the file now holds one `console.log` at `:78`

**Error handling (CC6.7)**
- URI sanitizers: `pages/api/db/setup.ts`, `test-connection.ts`, `db/export.ts:93-96`, `db/import.ts:190-193`
- Raw `err.message` returns: `pages/api/transaction/list/index.ts:64-66`, `emergency/pause.ts:64-68`

**Rate limiting (CC6.6)**
- Absence: no limiter anywhere in the repo. Grep `ratelimit|rate-limit|rateLimit` hits only a GitHub response header read in `pages/api/chain-registry/[...path].ts:69`, a comment in `lib/chainRegistry.ts:11`, and prose in these docs
- Not a rate limit, despite the name: `services/multisig-indexer/server.mjs:34,182` caps request **body size**

**Data protection (CC6.7 / C1.1)**
- `docs/INFRASTRUCTURE.md:13` (production URL/platform)
- Actual retention control: `lib/db.ts:720-724` (`MONGODB_AUTO_CLEANUP_DAYS`, default 30) → `lib/mongodb.ts:621-651` (`autoCleanup`)
- Display-only, deletes nothing: `lib/dataRetention.ts:16` (`DATA_RETENTION_DAYS`)
- Member-invoked deletion: `pages/api/transaction/wipe/index.ts`, `pages/api/transaction/export/index.ts`, `lib/db.ts:555-582` (`deleteMultisig`), UI at `components/dataViews/TransactionPrivacy.tsx`

**Dependencies (CC7.1)**
- [PR #29](https://github.com/ShieldnestORG/cliqs_web_app/pull/29) (**still open, unmerged** — `package.json` on `main` has no `overrides` block); `README.md` Known Issues (elliptic/Keplr); `.npmrc` (`legacy-peer-deps=true`)

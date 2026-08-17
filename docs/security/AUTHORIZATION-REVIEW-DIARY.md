# Authorization Work — Review Diary

> **Cluster:** security · **Tags:** soc2, api-auth, adr36, nonce, review, held · **Related:** [SOC2-GAP-ASSESSMENT.md](SOC2-GAP-ASSESSMENT.md), [README.md](README.md), [INFRASTRUCTURE.md](../INFRASTRUCTURE.md)

**Status: HELD FROM RELEASE by owner decision, 2026-08-17.** The hold applies to the **authorization code** on branch `fix/flow-security-soc2` — that branch is not merged, not deployed, and nothing it describes as built is live.

The hold does **not** apply to this diary. The document itself reached `main` via PR #34 (it was authored while the shared working tree was on that PR's branch, and was carried along with it), so a reader finding it here should treat it as a record of held work, not as evidence that the work shipped. The only security change from that PR which *is* live is the credential-fingerprint removal described in §"open findings not actioned"; everything else here remains pending review.

This is a working diary, not a finished assessment. It records what was attempted, what was measured, what broke, and every decision with who made it. Anything stated here as verified cites a file:line or a command output; anything unverified says so.

---

## 1. The one-paragraph version

An audit found 105 verified problems. The largest was that most API routes let anonymous callers read and mutate multisig data. Uniform ADR-36 authorization was built and applied to five routes, plus injection guards, an audit log, rate limiting and a report-only CSP. **All gates went green — 6 consecutive identical runs, 55 suites, 389 tests, 0 skipped — and the app was still not shippable.** Per-call wallet proofs cannot work on this codebase's nonce design, which is a single counter per address consumed on every call. The owner reviewed the breakage and held the entire branch for human review rather than shipping a partial fix.

## 2. Why this was held — the four measured breaks

None of these are inferred. Each was measured by feeding the real request body into the real handler.

| # | Break | Evidence |
| --- | --- | --- |
| 1 | **Ledger wallets locked out** of create / sign / broadcast / cancel | The proof requires `getKeplrVerifySignature`, which goes through `window.keplr`. `getKeplrVerifyMsg` is module-private in `lib/keplr.ts`. Ledger worked in all four flows before. |
| 2 | **Every validator-dashboard transaction 401s** | `lib/validatorTx.ts:103` calls `createDbTx` with no proof. Measured 401. The new parameter is optional, so it compiled silently — that is the trap. |
| 3 | **Every "pending" badge silently empty** | `/api/transaction/pending` 401s in all three real callers: `context/PendingTransactionsContext/index.tsx:121`, `components/dataViews/ListMultisigTxs.tsx:226`, `pages/[chainName]/[address]/transaction/new.tsx:372`. |
| 4 | **DevTools import broken by design** | `pages/api/transaction/index.ts:83-104` now 403s any `importedSignatures` entry whose address is not the proven caller. Importing a transaction that already carries *other members'* signatures is the entire purpose of that feature (`lib/importedTransaction.ts`). |

### The root cause

The nonce is **one counter per `(chainId, address)`**, and `lib/apiAuth.ts` consumes one per call. So a per-call proof works for a user-initiated, one-at-a-time action — which is why `wipe` and `export` work today — and **cannot** work for anything polled or fanned out. A `Promise.all` over N CLIQs fetches the same nonce N times, so at most one request can verify.

`pages/api/chain/[chainId]/multisig/list/index.ts` also advances the nonce on every signature-bearing call, so a proof signed just before a broadcast can go **stale during the broadcast window**, making `updateDbTxHash` 401 *after* the transaction is already on chain. That failure was contained behind a specific "on chain but hash not saved — do NOT cancel and recreate" toast rather than left as a generic broadcast error, but containment is not a fix.

## 3. The most important lesson: green gates hid a dead app

The first implementation pass produced five passing gates and a non-functional application. `lib/api.ts` was never updated, so the browser sent none of the proof the routes now demanded.

The structural fault is **not** "an agent forgot the client." It is that **handler tests which mock the client boundary cannot detect a hardened route against an un-updated caller, regardless of who writes them.** The parallel session identified that its own PR #31 would have stayed green under this identical failure — `wipe`/`export` answer 200 only because their calling component happened to be written against the new signature *in the same PR*. That is authorship luck, not test coverage.

**Remedy adopted:** a client/server *pair* test that drives `lib/api.ts`'s real request builders against the real handlers with only the DB mocked. The verification pass proved the concept — it mocked `@/lib/request`, called the real builders, captured the exact body each produced, and replayed it into the real handler:

```
createDbTx 200 · updateDbTxHash 200 · cancelDbTx 200 · createDbSignature 200
getPendingDbTxs 200 (with proof) · 401 (as its callers actually call it)
createDbTx 401 (as lib/validatorTx.ts:103 calls it)
controls: getDbUserMultisigs 200 · wipeTransactions 200 · exportTransactions 200
```

This test category does not yet exist as a permanent suite. It should.

## 4. What is actually built and green on the branch

Genuinely complete, verified, and safe as far as the gates can tell:

- **`lib/apiAuth.ts`** — single authorization entry point, extracted verbatim from the recipe already shipped on `wipe`/`export`, preserving identical status codes and bodies. Caller address derived from the signing pubkey, never from a client-supplied field.
- **NoSQL operator-injection closed** — `lib/apiSchemas.ts` zod schemas force strings to be strings, plus defence-in-depth assertions before any Mongo filter is built from caller input in `lib/mongodb.ts` and the `lib/db.ts` switcher. This closed real holes: `{"address": {"$ne": null}}` previously dumped every multisig on the chain.
- **`/dev` anti-phishing** — arrival gate for off-origin entry, plain-language intent summary for authz / Update Admin / Migrate, typed confirmation on the irreversible three, persistent powers banner. 12 new tests.
- **Screen consolidation** — chain-home and operations folded into dashboard as tabs; both routes became **redirects, not deletions**, so the Sidebar logo and ~7 breadcrumbs keep resolving. Verified by execution, including that a bogus tab falls back and an empty query does not redirect.
- **Two flow fixes** — cold entry no longer hardcodes `cosmoshub` over the configured chain; the CLIQ page renders a retry card instead of spinning forever when multisig resolution fails.
- **Report-only CSP** and rate limiting, both with honest in-file caveats about what they do not guarantee.

## 5. Things that are NOT what they appear

Recorded because each would otherwise be marked done.

- **The audit log is not a working control.** `recordAuditEvent` has never completed a successful write. It fails on every call and returns `null` after logging `[Audit] CONTROL GAP`, because it is deliberately fail-safe. Measured as a test-environment artifact only — the real `lib/byodb/middleware.ts` does export `getRequestByodbUri` — but the write path is unproven end to end. **Do not describe this as shipped.** No test asserts audit behaviour, so it can silently regress.
- **`multisig/list` still fails open.** Injection is closed; authorization is not. The route verifies the signature and proceeds regardless. This is documented in-file with the reason: closing it requires fresh per-call signing, because `WalletContext` caches one signature while the route advances the nonce on every call.
- **Rate limiting is per-instance.** On Vercel serverless it raises the cost of casual abuse and does not stop a distributed attacker. The `/pending` limit of 120/min would throttle a user with more than ~60 CLIQs at the current 30s poll cadence.
- **The `pages/index.tsx` chain-redirect fix may be a no-op in production.** It depends on `NEXT_PUBLIC_REGISTRY_NAME`, which could not be verified in the Vercel environment from here.

## 6. Decisions, attributed

An "accepted risk" with nobody named is worse than an open finding, because it looks resolved.

| Decision | Who | When | Reasoning as given |
| --- | --- | --- | --- |
| Do **not** gate `/dev` in production; harden against phishing instead | Owner | 2026-08-17 | "how to prevent phishing attack instead of hiding it, the dev tools are there to help other users" — presented with the gating option and the phishing-amplification analysis, declined it. `lib/featureFlags.ts:14-16`'s rationale therefore **stands** and needs no rewrite. |
| Merge both redundant screen pairs into dashboard | Owner | 2026-08-17 | Chose the fuller consolidation after being shown the risk that `operations` has a divergent pending-transaction implementation. |
| Defer the ephemeral `/tmp` → Atlas migration to top of backlog | Owner | 2026-08-17 | Scope kept to security + SOC2 + flow fixes for this pass. Remains **open**, not resolved. |
| Investigate dead code before deleting any of it | Owner | 2026-08-17 | "have other agents examine more and see what we can or need to do with it" — 14 items, ~4,394 lines, untouched pending that investigation. |
| **Hold the entire branch from release** | Owner | 2026-08-17 | "Ship nothing today; take the whole thing to review." Presented with green gates plus the four measured breaks. |
| Investigate one-popup approaches rather than accepting two | Owner | 2026-08-17 | "investigate more keep a good diary" |

## 7. Correction log

Errors made and corrected during this work, kept rather than tidied away.

1. **Overstated the `/dev` risk.** An auditor reported it as anonymous compromise. It is **phishing amplification** — the victim still signs in their own wallet. Corrected before it reached the compliance document.
2. **Called `/dev` an oversight.** It is deliberate and documented at `lib/featureFlags.ts:14-16`. Reframed as a decision for the owner rather than a bug to fix.
3. **Said "the app was broken" without scoping it.** It was broken *on this branch only*. Production was never affected: `28c6732` is not an ancestor of `origin/main`, and `POST /api/transaction/pending` answers 200 live.
4. **Claimed the BYODB default security level was 0.** It is **1 (passphrase)** — `components/DatabaseSettings.tsx:130` is `useState<SecurityLevel>(1)`, Level 1 is badged "Recommended", and an 8-character passphrase with confirmation is enforced at `:237-250`. Both fixes floated on the strength of the wrong premise ("raise the default", "force a passphrase") were already true.
5. **Attributed the CI-green-while-broken failure to agent carelessness.** It is a missing *test category*, not a mistake — see §3.

## 8. Open findings not yet actioned

From the 105 that survived adversarial verification (5 were refuted and dropped). Highest-value first.

- **Ephemeral production store** — 15 API routes write to a `/tmp` JSON store (`lib/localDb.ts:447`) instead of Atlas, bypassing the `lib/db.ts` switcher whose own header claims to be the single entry point. Credential revocation, policies, incidents and emergency state **do not survive a cold start**. A revoked credential silently un-revoking itself is an access-control failure (CC7). Deferred by owner to top of backlog.
- **No audit trail** — see §5. The single most important SOC 2 control for a multisig (CC7.2 / CC4).
- **`lib/byodb/storage.ts:133`** — an unsalted, truncated SHA-256 of the **full** connection string is written to plaintext localStorage at every security level, next to a `maskedUri` that reveals every field except the password. Nothing reads the field. It converts cracking from PBKDF2-SHA256 at 600k iterations to a plain SHA-256 dictionary attack on the password alone. Fix is a free deletion. **Owned by the parallel session** as of 2026-08-17 by direct instruction from its user.
- **`lib/request.ts:50-52`** — `endpoint.includes(window.location.host)` is a substring test gating the `x-byodb-uri` header, so `https://evil.example/collect?ref=app.cliqs.io` passes it. No exploitable path today (every `requestJson` caller passes a literal relative path, re-verified), but it is a latent credential-exfiltration primitive. Note `//evil.example/x` also starts with `/`.
- **`.gitignore:30`** — only `.env*.local` is ignored, but the installed `@next/env` also loads `.env` and `.env.${NODE_ENV}`. Two of four loaded files are committable. Nothing is currently tracked; preventive gap. Cheapest control on the list.
- **~25 API routes return raw `err.message`** while exactly five BYODB routes sanitize it. Bounded to hostnames and code shape — a negative result confirmed the mongodb driver does **not** put credentials in error objects, tested to depth 8. The inconsistency is what an auditor writes up.
- **CI has no dependency-audit, SCA, secret-scanning or CodeQL job**, and no Dependabot config. Node major is unpinned — CI runs 20, local runs 22.
- **`prebuild` runs `validate-wasm.mjs` without `--strict`**, so it exits 0 on validation errors while the strict variant is never invoked by CI.

## 9. Branch and worktree triage

Decided by tree comparison, not commit counts. `git cherry` reports 7 "unmerged" commits across two branches that are provably fully merged — every merge to main was a **squash**, so **do not use `git cherry` as the deletion gate.** Use `git merge-tree --write-tree origin/main BRANCH` against `origin/main^{tree}`.

Six of seven remote branches are fully merged by content and safe to delete: `0xrasmp`, `preview`, `claude/vigorous-lalande-09590f`, `feat/ui-polish-data-controls`, `fix/repo-hygiene-and-validator-ux`, `claude/sleepy-turing-396774`. Both worktrees are clean with zero unpushed commits and zero stashes — nothing at risk.

`claude/silly-chatelet-81a1a9` (**PR #29**, dependency remediation) holds real unmerged content and belongs to a different session. **Leave alone.**

## 10. Coordination note

Two Claude sessions worked the same checkout concurrently. The file-level lane split (`*.md` to one, code to the other) held, but **the branch pointer is shared state neither lane owned** — a `git checkout` in the repo root moved the other session's HEAD while 24 files of uncommitted work sat in the tree. It was safe only because the two file sets happened not to overlap. Protocol added mid-session: announce before any `checkout`/`switch` in the shared root, or use `git worktree add` instead. Worth keeping for any future parallel work.

---

*Diary opened 2026-08-17. Update it rather than replacing it; the correction log in §7 is the most useful part of this document and only works if it accumulates.*

# Authorization Rework — Approved Plan (not yet started)

> **Cluster:** security · **Tags:** soc2, api-auth, adr36, nonce, session-token, audit-log, backlog · **Related:** [AUTHORIZATION-REVIEW-DIARY.md](AUTHORIZATION-REVIEW-DIARY.md), [SOC2-GAP-ASSESSMENT.md](SOC2-GAP-ASSESSMENT.md), [README.md](README.md), [INFRASTRUCTURE.md](../INFRASTRUCTURE.md)

**Status: BACKLOG — design approved, implementation deliberately not started.** Owner decision, 2026-08-17: *"save as a possible future todo."*

This exists so the design decision is not lost and nobody re-derives it from scratch. The diary records *why the last attempt failed*; this records *what to do instead*. Read the diary first — especially §3 and §5, which are the parts that cost real time.

**Do not treat anything here as built.** Nothing in this document is in `main`.

---

## 1. What problem this solves

36 of 38 API routes let an anonymous caller read or mutate multisig data, including destructive operations (wipe history, cancel transactions, pause a multisig, mint role credentials). Only `transaction/list`, `transaction/wipe` and `transaction/export` enforce ADR-36 today; `chain/[chainId]/multisig/list` verified a signature but ignored the result, and that decorative check was removed in PR #38 rather than left to imply protection.

This is the single largest open security gap in the repo (SOC 2 CC6.1).

## 2. Why the last attempt is held, in one line

The nonce is **one counter per `(chainId, address)`**, consumed on every call, so a per-call wallet proof works for a user-initiated one-at-a-time action and **cannot** work for anything polled or fanned out. Four measured breaks followed; see the diary's table. All five CI gates were green the whole time.

## 3. The approved design: session token, not per-call proof

**Owner-endorsed, 2026-08-17.** One wallet signature at connect time mints a short-TTL bearer token; that token authorizes the N subsequent reads.

```
                        ── TODAY (held branch) ──
  every call ─→ getNonce ─→ incrementNonce ─→ verifyKeplrSignature
                    ↑ one counter per address, consumed per call
  N parallel calls ─→ N reads of the SAME nonce ─→ at most 1 verifies

                        ── APPROVED ──
  connect ─→ ONE signature over {address, chainId, nonce, expiry}
          ─→ server verifies once, consumes the nonce ONCE
          ─→ issues token (short TTL, bound to address + chainId)
  N calls ─→ present token ─→ verified statelessly, nonce untouched
```

### Why this one

- **It fixes the fan-out.** `PendingTransactionsContext` maps over every CLIQ (`allMultisigs.map`) on a 30-second `setInterval`. N concurrent requests against one counter is unfixable by tuning; it needs the proof decoupled from the counter.
- **It fixes the popup problem the owner already raised** (*"investigate one-popup approaches rather than accepting two"*). One signature per session instead of one per action.
- **It gives Ledger a path.** The blocker is that `getKeplrVerifySignature` goes through `window.keplr`, so a Ledger connection cannot produce a proof (the held branch says so itself at `lib/api.ts:245`). Needing *one* signature at connect instead of one per call makes an Amino/Ledger-compatible path tractable, because it happens once at a moment the user is already interacting with their wallet.

### Alternatives considered and rejected

| Option | Why not |
| --- | --- |
| Server-leased per-request nonces | Fixes fan-out but keeps a wallet popup per action — the owner explicitly asked to avoid that. |
| Per-route nonce scoping | Reduces collisions without eliminating them; a single route that fans out (`/pending`) still breaks. |
| Tune the existing counter | Not a fix. The failure is structural, not a tuning problem. |

### Open design questions for whoever picks this up

1. **TTL.** Long enough to cover a working session, short enough that a leaked token expires. Start conservative.
2. **Where the token lives.** `httpOnly` cookie versus memory + `Authorization` header. The cookie is harder to exfiltrate via XSS; the header is easier to reason about with BYODB's per-request header model.
3. **Revocation.** A stateless token cannot be revoked before expiry without server state. Decide whether that is acceptable at the chosen TTL.
4. **Writes.** Consider keeping a fresh per-action signature for destructive writes (wipe, delete multisig) even once reads use a token — those are one-at-a-time and already work, and the extra popup is defensible there.

## 4. Non-negotiables — each one is a bug that already happened

1. **Make the proof parameter required, not optional.** `createDbTx(creatorAddress, chainId, dataJSON, importedSignatures?, auth?)` has `auth` as an optional 5th parameter, so `lib/validatorTx.ts` calling it with three arguments compiled cleanly and 401'd at runtime. A required parameter turns that class of break into a compile error.
2. **Authorize import on multisig membership, not signature-address identity.** The held branch 403s any `importedSignatures` entry whose address is not the proven caller. Importing a transaction that already carries *other members'* signatures is the entire point of the feature.
3. **Never let a hardened route ship against an un-updated caller.** Add the client/server **pair test** category: drive `lib/api.ts`'s real request builders against the real handlers with only the DB mocked. A prior pass proved this catches all four breaks; the permanent suite still does not exist. Handler tests that mock the client boundary cannot detect this failure, no matter who writes them.
4. **Do not regress Ledger.** Create, sign, broadcast and cancel all work for Ledger today. Any design that cannot serve them is not done.
5. **Verify against a running app, not just gates.** The last attempt had 55 suites and 389 passing tests while the application was non-functional.

## 5. The audit log is separable — do it first

`lib/audit.ts` (335 lines) exists only on the held branch; `main` has **no audit trail at all**, which is the most important single SOC 2 control for a multisig (CC7.2 / CC4).

**It does not depend on this rework.** `recordAuditEvent` takes an action, a target multisig, an outcome and an `authMethod` that already defaults to `"none"`. It records *what happened*; it does not need authorization to exist. It can therefore ship on its own, ahead of everything above.

Two honest caveats to carry with it:

- **`recordAuditEvent` has never completed a successful write.** It is deliberately fail-safe: it returns `null` after logging `[Audit] CONTROL GAP` rather than throwing into a live transaction path. The diary measured that as a test-environment artifact, but **the write path is unproven end to end** and no test asserts audit behaviour, so it can regress silently. Proving that write path is the first task, not an afterthought.
- **Until the rework lands, the "who" is self-asserted.** Action, target, timestamp and outcome are all trustworthy; the actor is not, because callers are unauthenticated. That still beats no trail — but write it down that way rather than claiming attribution the system cannot support.

Suggested sequencing: prove the write path → wire the destructive routes first (wipe, cancel, delete multisig, credential issue, emergency pause) → assert behaviour in tests → widen. Do not describe it as shipped until a test asserts a successful write.

## 6. Effort

Days, not hours, and the shape depends on §3's open questions. The audit log slice (§5) is meaningfully smaller and independently valuable.

---

*Opened 2026-08-17 alongside the five production deploys of the same day. Update this rather than replacing it; if the design changes, record why in the diary's correction log.*

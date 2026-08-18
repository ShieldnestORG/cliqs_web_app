# Security Docs

> **Cluster:** security · **Tags:** soc2, security, index, api-auth, ssrf, headers · **Related:** [SOC2-GAP-ASSESSMENT.md](SOC2-GAP-ASSESSMENT.md), [INFRASTRUCTURE.md](../INFRASTRUCTURE.md), [README.md](../../README.md)

Index for `docs/security/`.

| Doc | What it covers |
| --- | --- |
| [SOC2-GAP-ASSESSMENT.md](SOC2-GAP-ASSESSMENT.md) | Canonical security document. Security-TSC technical-controls gap assessment: nine control domains, the full 38-route API inventory with an auth column, what PR #31 remediated, and the prioritized follow-up list (L1–L6 plus CSP). |
| [AUTHORIZATION-REVIEW-DIARY.md](AUTHORIZATION-REVIEW-DIARY.md) | Working diary for the L1 uniform-authorization attempt. Why branch `fix/flow-security-soc2` is **held from release** despite green gates, the four measured breaks and their shared root cause in the nonce design, attributed owner decisions, and a running correction log. Not an assessment — a record. |
| [AUTH-REWORK-PLAN.md](AUTH-REWORK-PLAN.md) | The approved way forward for L1, in **backlog** — not started. The session-token design (one signature at connect mints a short-TTL bearer) endorsed by the owner 2026-08-17, why the alternatives were rejected, the open design questions, the five non-negotiables drawn from breaks that already happened, and why the audit log is separable and should ship first. |

Security facts documented elsewhere:

- [INFRASTRUCTURE.md](../INFRASTRUCTURE.md) — "Edge & outbound controls": the security headers `next.config.js` sets and the BYODB SSRF host validation, in operational terms.
- [SETUP.md](../../SETUP.md) — "Data retention & deletion (hosted MongoDB)": what is stored, what auto-expires, and the member-authorized export/wipe/delete controls.
- [README.md](../../README.md) — "Known Issues": the `elliptic` position (present but unreachable; two copies ship, only one visible to npm).

Standing caveats, current as of **2026-08-17** — do not describe any of these as done:

- **Uniform authorization (L1) is still open**, and only 3 of 38 routes enforce ADR-36. The plan is approved but not started — see [AUTH-REWORK-PLAN.md](AUTH-REWORK-PLAN.md). Note the count did not improve on 2026-08-17: PR #38 *removed* `multisig/list`'s signature check because the route verified and then proceeded regardless, so it protected nothing while burning a member's shared nonce on every call.
- **Security audit log (L2) — now live, but PARTIAL. Do not describe L2 as closed.** `lib/audit.ts` is on `main` with a per-multisig tamper-evident hash chain, and `recordAuditEvent` is proven to complete a successful write (`__tests__/lib/audit.test.ts`) — it never had before, and no test asserted audit behaviour, so it could regress silently. What is genuinely covered and what is not:
  - **Wired:** `transaction/wipe` (allow **and** the 409 deny, with a reason), `transaction/export`, and cancel / broadcast on `transaction/[transactionID]`. Every other route is unaudited.
  - **The actor is only trustworthy on the ADR-36 routes.** `wipe` and `export` record a real signature-derived caller. Cancel and broadcast record `authMethod: "none"` because those routes have no caller proof — the action is evidenced, the actor is not. That closes when L1 lands; see [AUTH-REWORK-PLAN.md](AUTH-REWORK-PLAN.md).
  - **Append-only is convention, not enforcement.** Nothing in the repo issues an update or delete against `audit_events`, but the database user still holds those grants. Until the Atlas role is split, an attacker with database credentials can rewrite the whole chain consistently — the chain proves *partial* tampering only. That is an infrastructure change outside this repo and it has **not** been made.
  - **Proven against a fake, not against Atlas.** The tests drive a faithful in-memory stand-in for the collection operations used. End-to-end behaviour against a real deployment is still unobserved.
  - **Concurrent appends can fork a chain.** Two events for one multisig can read the same head and share a `prevHash`; `verifyAuditChain` reports that as a break. Serverless instances have no shared lock.
  - Nothing alerts on `[Audit] CONTROL GAP` today, and no route surfaces `verifyAuditChain`.
- **No Content-Security-Policy.** Confirmed by measurement on 2026-08-17: `app.cliqs.io` sends no `content-security-policy` header. The report-only CSP is on the held branch.
- **Rate limiting (L3) is partial, not done.** `/api/transaction/[transactionID]` reads and the transaction page's `getServerSideProps` share a 60/min/IP budget (PR #39, merged and verified live: 60 reads allowed, then 429 with `Retry-After`). Writes on that route are deliberately unlimited — a throttled post-broadcast write strands a transaction that is already on chain. Every other route is unlimited, and the limiter is **per serverless instance**, so it raises the cost of casual abuse and does not stop a distributed attacker.
- **Unauthenticated transaction disclosure is still open.** Anyone holding a transaction id can read its full `dataJSON` and signatures, via the API route or the page's SSR props. PR #39 priced it; it did not close it. Closing it changes who can open a transaction link — a product decision that must not land before Ledger holders can authenticate.
- The same nonce-burn-before-verify pattern PR #38 removed is **still live** on `transaction/list`, `transaction/export` and `transaction/wipe`.

Closed on 2026-08-17 — safe to describe as done:

- Dependency remediation merged as [PR #29](https://github.com/ShieldnestORG/cliqs_web_app/pull/29). Open Dependabot alerts: **87 → 7 (6 moderate, 1 low), zero critical, zero high** (verified via the alerts API).
- CI now runs **Node 24**, matching the Vercel production build image, and has a dependency-audit job that fails on high/critical. Previously CI ran Node 20 against a Node 24 production, so green CI did not prove the shipped build compiled ([PR #42](https://github.com/ShieldnestORG/cliqs_web_app/pull/42)).
- `.gitignore` now covers all four env files `@next/env` loads; two were previously committable.
- Security headers **measured live**, not just read out of the tree — see [INFRASTRUCTURE.md](../INFRASTRUCTURE.md).

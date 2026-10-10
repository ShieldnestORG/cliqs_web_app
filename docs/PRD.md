# Cosmos Multisig UI (CLIQs) - Consolidated PRD

> **Cluster:** product · **Tags:** prd, multisig, phases, cliq, roadmap · **Related:** [User Guide](App%20User%20Guide.md), [Appendix](Appendix/), [SOC2 gap assessment](security/SOC2-GAP-ASSESSMENT.md), [UI design docs](ui/INDEX.md)

## Overview
Production Next.js app for PubKey + Contract multisig on Cosmos/Coreum. Dual engines, credentials. *(Until 2026-10-10 this line read: "Dual engines, policies, credentials, monitoring." Phase 4 was removed, see below.)*

**Phases build progressively:**
- Phase 0: PubKey hardening (canonical tx, hashing, multi-RPC).
- Phase 1: CW3-fixed contracts + 3-layer indexer.
- Phase 2: CW3-flex + CW4 groups, snapshots.
- Phase 3: NFT credentials (soulbound, gated).
- Phase 4: Policies (timelock, spend, msg restrict), emergency/safe-mode, alerts. **Removed 2026-10-10** (owner chose option B), archived at git tag `archive/phase4-policies-2026-10-10`.

See [User Guide](App%20User%20Guide.md), [Appendix](Appendix/).

Member-facing data controls (export / wipe completed / delete cliq) ship on the CLIQ page's Data & Privacy tab and are documented for users in the [User Guide](App%20User%20Guide.md#data--privacy) and for operators in [SETUP.md](../SETUP.md).

## Phase 0: PubKey Production Hardening
MultisigEngine interface, CanonicalTxBuilder, ProposalHasher, MultiRpcVerifier, ProposalIntentView.

Key: Deterministic tx, content hashing, intent UI.

## Phase 1: Contract Multisig (CW3-Fixed)
Dual PubKey/Contract. CW3Client, 3-layer indexer (WS→unconfirmed, sync→authoritative, verify→on-demand).

API: /contract-multisig. UI: Tabbed create.

## Phase 2: Group-Backed (CW3-Flex + CW4)
Dynamic members via CW4. Dual snapshots (proposal/vote time). GroupProvider extensible.

UI: MembershipPanel, AuditTrail. *(Removed 2026-10-10: the closest components, `MembershipManagementPanel` and `ProposalAuditTrail`, were never rendered by any page. The group and snapshot API routes stay.)*

## Phase 3: Identity NFTs
Coreum assetnft soulbound creds. Gated voting/execution. Burn→revoke.

CredentialService, verifyCredential(). DB: classes/credentials/events.

## Phase 4: Policies + Safeguards
**Removed 2026-10-10** (owner chose option B), archived at git tag `archive/phase4-policies-2026-10-10`. Nothing in the app ever called this code: no transaction was created, signed or sent differently because of a policy or a pause. The text below is the old plan, kept for the record.

PolicyEvaluator (P1 timelock, P2 emergency, P3 msg-type, P4 spend, P5 address filter).

Emergency: Pause/safe-mode. Monitoring: Events/anomalies/alerts/playbooks.

**Status**: Phases 0-3 have code under `lib/` (engines, canonical builder/hasher, multi-RPC verifier, indexer, CW3/CW4 clients, credential service). Checked by import graph on 2026-10-10: the app uses the hasher, the multi-RPC verifier, the indexer sync job and the CW3/CW4 clients; the engine classes and the canonical builder are reached only by tests; nothing imports the credential service. Phase 4 was removed on 2026-10-10. *(Until 2026-10-10 this line read: "All five phases have shipping code (engines, canonical builder/hasher, multi-RPC verifier, indexer, CW3/CW4 clients, credential service, policy registry, emergency + monitoring modules all exist under `lib/`).")*

**Not in scope of that status — open, not shipped:**
- Uniform authorization across the API surface. `/api/transaction/wipe` and `/api/transaction/export` now require an ADR-36 membership proof; most other routes remain unauthenticated. Tracked as follow-up L1 in [SOC2-GAP-ASSESSMENT.md](security/SOC2-GAP-ASSESSMENT.md).
- Security audit log is **live but PARTIAL** (L2, PR #58): `lib/audit.ts` records transaction cancel and broadcast, history export, and history wipe / multisig delete (refused wipes included). Creating or signing a transaction, emergency and credential actions are not recorded. Rate limiting is **partial** (L3, PR #39): only transaction reads on `/api/transaction/[transactionID]`, counted per serverless instance. No Content-Security-Policy (CSP is deliberately deferred; the other security headers ship in `next.config.js`). Caveats: [security/README.md](security/README.md). *Until 2026-10-09 this line read: "No security audit log, no rate limiting, no Content-Security-Policy" — accurate until PRs #39 and #58 merged on 2026-08-17.*
- Dependency remediation is in **PR #29, which is open and not merged**.
- `MsgUnjail`: since PR #77 (2026-10-08) the validator page has a one-click Unjail inside the jailed banner, for single-wallet and CLIQ operators. *(Until 2026-10-09 this line read: "has codec and gas support but no UI entry point.")*
- A transaction that lands on chain but fails execution (DeliverTx code != 0) still renders the "Completed" view — there is no failed status in the data model.
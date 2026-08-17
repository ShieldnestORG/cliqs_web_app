# Cosmos Multisig UI (CLIQs) - Consolidated PRD

> **Cluster:** product · **Tags:** prd, multisig, phases, cliq, roadmap · **Related:** [User Guide](App%20User%20Guide.md), [Appendix](Appendix/), [SOC2 gap assessment](security/SOC2-GAP-ASSESSMENT.md), [UI design docs](ui/INDEX.md)

## Overview
Production Next.js app for PubKey + Contract multisig on Cosmos/Coreum. Dual engines, policies, credentials, monitoring.

**Phases build progressively:**
- Phase 0: PubKey hardening (canonical tx, hashing, multi-RPC).
- Phase 1: CW3-fixed contracts + 3-layer indexer.
- Phase 2: CW3-flex + CW4 groups, snapshots.
- Phase 3: NFT credentials (soulbound, gated).
- Phase 4: Policies (timelock, spend, msg restrict), emergency/safe-mode, alerts.

See [User Guide](App%20User%20Guide.md), [Appendix](Appendix/).

Member-facing data controls (export / wipe completed / delete cliq) ship on the CLIQ's Transactions tab and are documented for users in the [User Guide](App%20User%20Guide.md#data--privacy) and for operators in [SETUP.md](../SETUP.md).

## Phase 0: PubKey Production Hardening
MultisigEngine interface, CanonicalTxBuilder, ProposalHasher, MultiRpcVerifier, ProposalIntentView.

Key: Deterministic tx, content hashing, intent UI.

## Phase 1: Contract Multisig (CW3-Fixed)
Dual PubKey/Contract. CW3Client, 3-layer indexer (WS→unconfirmed, sync→authoritative, verify→on-demand).

API: /contract-multisig. UI: Tabbed create.

## Phase 2: Group-Backed (CW3-Flex + CW4)
Dynamic members via CW4. Dual snapshots (proposal/vote time). GroupProvider extensible.

UI: MembershipPanel, AuditTrail.

## Phase 3: Identity NFTs
Coreum assetnft soulbound creds. Gated voting/execution. Burn→revoke.

CredentialService, verifyCredential(). DB: classes/credentials/events.

## Phase 4: Policies + Safeguards
PolicyEvaluator (P1 timelock, P2 emergency, P3 msg-type, P4 spend, P5 address filter).

Emergency: Pause/safe-mode. Monitoring: Events/anomalies/alerts/playbooks.

**Status**: All five phases have shipping code (engines, canonical builder/hasher, multi-RPC verifier, indexer, CW3/CW4 clients, credential service, policy registry, emergency + monitoring modules all exist under `lib/`).

**Not in scope of that status — open, not shipped:**
- Uniform authorization across the API surface. `/api/transaction/wipe` and `/api/transaction/export` now require an ADR-36 membership proof; most other routes remain unauthenticated. Tracked as follow-up L1 in [SOC2-GAP-ASSESSMENT.md](security/SOC2-GAP-ASSESSMENT.md).
- No security audit log, no rate limiting, no Content-Security-Policy (CSP is deliberately deferred; the other security headers ship in `next.config.js`).
- Dependency remediation is in **PR #29, which is open and not merged**.
- `MsgUnjail` has codec and gas support but no UI entry point.
- A transaction that lands on chain but fails execution (DeliverTx code != 0) still renders the "Completed" view — there is no failed status in the data model.
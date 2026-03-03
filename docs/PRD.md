# Cosmos Multisig UI (CLIQs) - Consolidated PRD

## Overview
Production Next.js app for PubKey + Contract multisig on Cosmos/Coreum. Dual engines, policies, credentials, monitoring.

**Phases build progressively:**
- Phase 0: PubKey hardening (canonical tx, hashing, multi-RPC).
- Phase 1: CW3-fixed contracts + 3-layer indexer.
- Phase 2: CW3-flex + CW4 groups, snapshots.
- Phase 3: NFT credentials (soulbound, gated).
- Phase 4: Policies (timelock, spend, msg restrict), emergency/safe-mode, alerts.

See [User Guide](App%20User%20Guide.md), [Appendix](Appendix/).

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

**Status**: All phases implemented (code verified).
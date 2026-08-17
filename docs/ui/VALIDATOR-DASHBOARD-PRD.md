# Validator Dashboard PRD

> **Cluster:** design-system · **Tags:** validator, dashboard, cliq-mode, gas, info-blue · **Related:** [UI index](INDEX.md), [STYLE-GUIDE.md](../STYLE-GUIDE.md), [Transaction Page Redesign PRD](TRANSACTION-PAGE-REDESIGN-PRD.md), [User Guide](../App%20User%20Guide.md)

**Cosmos Multisig UI - Free Validator Dashboard Specification**  
**Version:** 1.1  
**Last Updated:** 2026-08-16

> **Reconciled against the shipped code.** Sections 4, 6, 7, 9 and 12 were rewritten
> to match `components/dataViews/ValidatorDashboard/` as it exists today; the rest is
> still the original intent spec and may describe work that was never built. Where a
> token value here disagrees with [`docs/STYLE-GUIDE.md`](../STYLE-GUIDE.md), the
> style guide wins.

---

## 1. Executive Summary

### Problem Statement
Validators on Cosmos chains currently need to use CLI tools or multiple separate interfaces to:
- Claim validator commission
- Withdraw staking rewards
- Set withdraw addresses
- Monitor their validator performance

This creates friction and limits adoption of our CLIQ multisig service.

### Solution Overview
Create a **free, no-signup Validator Dashboard** that:
- Allows any validator to connect their wallet and manage rewards
- Provides real-time analytics and performance metrics
- Executes single-signature transactions (commission claim, reward withdrawal)
- Serves as a **gateway to CLIQ adoption** by showcasing multisig benefits
- Uses on-chain data only (no stored data, privacy-preserving)

### Strategic Goals
1. **User Acquisition**: Attract validators who don't use multisig yet
2. **Value Demonstration**: Show the power of our UI/UX
3. **Conversion Funnel**: Soft-sell CLIQ as a security upgrade
4. **Brand Building**: Position as the go-to validator management tool

---

## 2. User Flow

### Entry Points (as shipped)
1. "Validator Tools" link and Validator tab on the chain landing page (`pages/[chainName]/index.tsx`)
2. "Validator" item in the desktop sidebar rail (`components/Sidebar.tsx`)
3. Direct URL (`/[chainName]/validator`)
4. `/[chainName]/validator?address=<cliq address>` — see CLIQ mode below

### Primary Flow
```
1. User lands on Validator tab/page
2. Connects wallet (Keplr/Ledger)
3. System detects if connected address is a validator
4. If validator: Show full dashboard with analytics + actions
5. If not validator: Show helpful message + option to delegate
```

### Direct mode vs CLIQ mode
The dashboard runs in one of two modes, decided by `isCliqMode` in
`ValidatorDashboard/index.tsx`: an `?address=` query param that differs from the
connected wallet address puts the page in **CLIQ mode**.

| | Direct mode | CLIQ mode |
|---|---|---|
| Trigger | no `?address=`, or it equals the connected wallet | `?address=` is a CLIQ the wallet is a member of |
| Who signs | the connected wallet, immediately | the CLIQ, after the threshold is met |
| Who pays the fee | the connected wallet | the CLIQ account itself |
| What a button does | `signAndBroadcast` on the spot | creates a multisig transaction and redirects to its signing page |
| Button labels | "Claim Commission Only", "Claim Rewards Only" | "Create: Claim Commission", "Create: Claim Rewards" |
| Button variants | `action` / `action-outline` | `action-bronze` / `action-bronze-outline` |

CLIQ mode also verifies membership before enabling anything: a non-member sees the
dashboard read-only (`cliqReadOnly`).

---

## 3. Page Layout

> The two diagrams below are the **original intent**, not a description of the shipped
> page. The Quick Stats row and the Recent Transactions card were never built, and the
> real page adds Validator Commands, Delegators and Proposal Viewer cards. See §4 for
> what actually renders.

### Desktop Layout (5-column bento grid)
```
┌─────────────────────────────────────────────────────────────────────────┐
│ ← BACK TO [CHAIN] HOME                                                  │
├─────────────────────────────────────────────────────────────────────────┤
│ // VALIDATOR TOOLS                                                      │
│ Validator Dashboard                         [Connect Wallet] (if needed)│
├─────────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────┐  ┌──────────────────────────────────────┐ │
│ │ VALIDATOR IDENTITY       │  │ QUICK STATS                          │ │
│ │ (2 cols, 1 row)          │  │ (3 cols, 1 row)                      │ │
│ │                          │  │ Commission | Rewards | Voting Power  │ │
│ │ Moniker, Status, Logo    │  │                                      │ │
│ └──────────────────────────┘  └──────────────────────────────────────┘ │
│                                                                         │
│ ┌──────────────────────────┐  ┌──────────────────────────────────────┐ │
│ │ PENDING REWARDS          │  │ VALIDATOR PERFORMANCE                │ │
│ │ (2 cols, 2 rows)         │  │ (3 cols, 2 rows)                     │ │
│ │                          │  │                                      │ │
│ │ Commission: $XXX         │  │ Uptime: 99.8%                        │ │
│ │ Staking Rewards: $XXX    │  │ Missed Blocks: 12                    │ │
│ │                          │  │ Commission Rate: 5%                  │ │
│ │ [Claim Commission]       │  │ Delegators: 1,234                    │ │
│ │ [Withdraw Rewards]       │  │ Self-Delegation: 10K CORE            │ │
│ └──────────────────────────┘  └──────────────────────────────────────┘ │
│                                                                         │
│ ┌───────────────────────────────────────────────────────────────────┐  │
│ │ UPGRADE TO CLIQ (Full width CTA)                                  │  │
│ │ "Your validator key is a single point of failure.                 │  │
│ │  Secure your operations with multi-signature protection."         │  │
│ │ [Create Validator CLIQ] [Learn More]                              │  │
│ └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│ ┌──────────────────────────┐  ┌──────────────────────────────────────┐ │
│ │ WITHDRAW ADDRESS         │  │ RECENT TRANSACTIONS                  │ │
│ │ (2 cols, 1 row)          │  │ (3 cols, 1 row)                      │ │
│ │                          │  │                                      │ │
│ │ Current: core1...        │  │ Last 5 commission claims             │ │
│ │ [Change Withdraw Address]│  │                                      │ │
│ └──────────────────────────┘  └──────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

### Mobile Layout (Single column, stacked)
```
┌─────────────────────────┐
│ // VALIDATOR TOOLS      │
│ Validator Dashboard     │
├─────────────────────────┤
│ [Connect Wallet]        │
├─────────────────────────┤
│ VALIDATOR IDENTITY      │
│ Moniker, Status         │
├─────────────────────────┤
│ QUICK STATS             │
│ Commission | Rewards    │
├─────────────────────────┤
│ PENDING REWARDS         │
│ [Claim Commission]      │
│ [Withdraw Rewards]      │
├─────────────────────────┤
│ CLIQ UPGRADE CTA        │
├─────────────────────────┤
│ PERFORMANCE             │
├─────────────────────────┤
│ WITHDRAW ADDRESS        │
└─────────────────────────┘
```

---

## 4. Component Breakdown

The cards below are the ones that exist. Two cards from the original spec — a
separate Quick Stats row and a Recent Transactions card — were never built; their
content was folded into the identity and performance cards instead.

### 4.1 Validator Identity Card
`ValidatorIdentityCard.tsx` · **Variant:** `institutional` with `bracket="green"`
(note: the bracket colour token is `--accent-green`, which is **coral** — see §7)
**Content:**
- Validator moniker (or address if no moniker)
- Status badge: Active (`success`), Unbonding (`warning`), Jailed (`destructive`), Inactive (muted)
- Commission rate
- Validator operator address (truncated with copy)
- "View in Explorer" link

### 4.2 Pending Rewards Card (Primary Action Card)
`PendingRewardsCard.tsx` · **Variant:** `institutional` with `accent="left"`
**Content:**
- Pending commission and self-delegation rewards, in the chain's primary denom
- **Primary Actions** — labels and behaviour depend on the mode (see §2):
  - Claim All (Commission + Rewards) — `MsgWithdrawValidatorCommission` + `MsgWithdrawDelegatorReward`
  - Claim Commission Only — `MsgWithdrawValidatorCommission` alone
  - Claim Rewards Only — `MsgWithdrawDelegatorReward` alone
- Self-delegation rewards are only included when they are actually non-zero, so a
  jailed validator with no self-delegation sends the commission message alone.
- In CLIQ mode an inline note reads "Actions will create a transaction for multisig signing".

### 4.3 Validator Performance Card
`ValidatorPerformanceCard.tsx` · **Variant:** `institutional`
**Content:** Voting Power, Ranking, Delegators, Total Stake, Self-Delegation,
Commission, Min Self-Delegation.
Uptime percentage and missed-block counts were specified but are **not implemented** —
they need signing-info/slashing queries that the dashboard does not make.

### 4.4 Validator Delegators Card
`ValidatorDelegatorsCard.tsx` · **Variant:** `institutional`
Delegator listing derived from the dashboard data payload.

### 4.5 Validator Commands Card
`ValidatorCommandsCard.tsx` · **Variant:** `institutional` with `accent="left"`
**Content:**
- Deep links that pre-select a message type on the new-transaction page:
  Delegate, Undelegate, Redelegate, Withdraw Rewards, Vote
  (`/[chainName]/<target>/transaction/new?type=<typeUrl>`)
- An inline "Edit Validator Details" form (moniker, identity, website, security
  contact, details, commission rate, min self-delegation) that submits `MsgEditValidator`

### 4.6 Proposal Viewer
`ProposalViewer.tsx` · **Variant:** `institutional` with `accent="left"`
Governance proposals with Yes / No / Abstain / No-with-veto voting (`MsgVote`).
Yes uses the `success` token; the tally chips are semantic, not decorative.

### 4.7 CLIQ Upgrade CTA Card
`CliqUpgradeCTA.tsx` · **Variant:** `institutional` with `bracket="purple"`
CTA into `/[chainName]/create`.

### 4.8 Withdraw Address Card
`WithdrawAddressCard.tsx` · **Variant:** `institutional`
**Content:**
- Current withdraw address, or "Same as operator account" (rendered with the `success` token) when unset
- Inline edit form submitting `MsgSetWithdrawAddress`

---

## 5. Data Sources

### On-Chain Queries (CosmJS)
| Data | Query Method |
|------|--------------|
| Validator info | `staking.validator(operatorAddr)` |
| Commission | `distribution.validatorCommission(operatorAddr)` |
| Rewards | `distribution.delegationRewards(delegatorAddr, validatorAddr)` |
| Withdraw address | `distribution.delegatorWithdrawAddress(delegatorAddr)` |
| Delegators count | `staking.validatorDelegations(operatorAddr)` (paginated) |

`slashing.signingInfo(consAddress)` is **not** queried — `lib/validatorHelpers.ts`
carries a comment about consensus-pubkey derivation but makes no slashing call, which
is why there are no uptime or missed-block figures in the UI.

### External APIs (never integrated)
None of the following ship. Amounts are shown in the native denom, and there is no
historical-performance or transaction-history feed.

| Data | API |
|------|-----|
| Historical performance | Mintscan API / Chain registry |
| USD prices | CoinGecko / Osmosis API |
| Transaction history | Mintscan API |

### Privacy-First Approach
- No analytics tracking of validator addresses
- Chain queries are made client-side
- Local storage holds UI preferences (e.g. `sidebarPinned` in `lib/settingsStorage.ts`) **and,
  if the user configures BYODB, their MongoDB connection string.** `lib/byodb/storage.ts:127`
  writes the credential under `byodb:credential` and `:85` writes a metadata blob
  (`byodb:meta`: masked URI, fingerprint, security level). At **security level 0 the
  credential is base64-encoded, not encrypted** — `encryptLevel0` in
  `lib/byodb/crypto.ts:173-176` is `LEVEL0_PREFIX + btoa(...)`, and the level-0 radio in
  `components/DatabaseSettings.tsx:881` says "Credentials encoded in localStorage" for that
  reason. Levels 1 and 2 apply AES-256-GCM keyed by a passphrase or a wallet signature.
  Anything with read access to the origin's local storage can recover a level-0 URI. This is
  the same client-side store [INFRASTRUCTURE.md](../INFRASTRUCTURE.md#byodb) describes as
  "stored client-side in Settings"; the app still never persists the URI server-side.
- **"No data stored on our servers" holds for direct mode only.** In CLIQ mode the page
  calls `ensureChainMultisigInDb` and `createCliqTransaction`, which persist the multisig
  record and the proposed transaction to the app database. Members can export or delete
  that data from the CLIQ's Transactions tab — see the
  [User Guide](../App%20User%20Guide.md#data--privacy).

---

## 6. Transaction Execution

### Gas comes from the shared table — no local estimates

Every dashboard action, **including the direct-signing paths**, sizes its gas with
`gasOfTx()` from `lib/txMsgHelpers.ts` and turns it into a fee with
`calculateFee(gasLimit, chain.gasPrice)`. There are no hand-written gas constants in
these components any more. Call sites: `PendingRewardsCard.tsx`,
`WithdrawAddressCard.tsx`, `ValidatorCommandsCard.tsx`, `ProposalViewer.tsx`, and
`lib/validatorTx.ts`.

`gasOfTx` = **100,000 flat per transaction** + `gasOfMsg` for each message.

### Supported Actions
| Action | Message Type(s) | Gas (`gasOfTx`) |
|--------|-----------------|----------------:|
| Claim All (commission + self-delegation rewards) | MsgWithdrawValidatorCommission + MsgWithdrawDelegatorReward | 1,200,000 |
| Claim Commission Only | MsgWithdrawValidatorCommission | 700,000 |
| Claim Rewards Only | MsgWithdrawDelegatorReward | 600,000 |
| Set Withdraw Address | MsgSetWithdrawAddress | 200,000 |
| Edit Validator | MsgEditValidator | 600,000 |
| Vote (Proposal Viewer) | MsgVote | 200,000 |

These are recomputed from `gasOfMsg` as it stands today. `WithdrawValidatorCommission`
was raised to 600,000 in an earlier PR, which is why the claim-all figure is 1,200,000
and not the 1,100,000 this document used to state.

**Not available in the UI:** `MsgUnjail`. It has codec, amino and gas support
(`lib/msg.ts`, `types/txMsg.ts`, `gasOfMsg` = 200,000) but **no entry point anywhere in
the dashboard or the transaction type selector**. A jailed validator cannot unjail from
this app.

### Transaction Flow (direct mode)
1. User clicks action button
2. Build messages, size gas with `gasOfTx`, derive fee with `calculateFee`
3. `SigningStargateClient.signAndBroadcast` from the connected wallet
4. Non-zero result code raises an error; success toasts the hash with a "View" action into the explorer
5. Dashboard data refreshes via `onTransactionComplete`

### Transaction Flow (CLIQ mode)
1. User clicks action button
2. Messages are built identically, then handed to `createCliqTransaction`
3. On success the user is redirected to `/[chainName]/<cliq>/transaction/<txId>` to collect signatures
4. Fees are paid by the CLIQ account, not the clicking member — see the
   [User Guide](../App%20User%20Guide.md#who-pays-the-fees)

---

## 7. Design Specifications

### Color Scheme (Dark Mode)
Following the Coherence Daddy tokens in [`docs/STYLE-GUIDE.md`](../STYLE-GUIDE.md):

**Trap, and it bites here specifically:** `--accent-green` is hue 10.9 — it is
**coral**, not green. `Card`'s `accent="left"`, `accent="top"` and `bracket="green"`
all paint with it. Never use it to mean "healthy". Semantic status must use
`--success` / `--warning` / `--destructive`.

- Brand accent (decorative brackets and left rules): `--accent-green` (coral)
- Secondary accent: purple (`purple-accent` utility) for the CLIQ CTA bracket
- **Validator surfaces read info-blue**: `--info` carries the shields, the
  "Validators Found" panel, the associated-validator rows and their hover states in
  `ValidatorDashboard/index.tsx`, and the "Using Direct signing mode" notice in
  `TransactionSigning.tsx`. This is the same tone the message-type chips give the
  staking/distribution family in `lib/txMsgHelpers.ts` (`chipToneOfMsg` → `"info"`).
- Status colors (`ValidatorIdentityCard`):
  - Active / BONDED: `--success`
  - Unbonding: `--warning`
  - Jailed: `--destructive`
  - Inactive: muted

### Typography
- Validator moniker: `font-heading`, `text-xl`, `font-bold`
- KPI values: `text-kpi`, `tabular-nums`
- Labels: `font-mono`, `uppercase`, `tracking-wider`
- Addresses: `font-mono`, `text-sm`

### Cards
- Use `Card` component with `variant="institutional"`
- Primary action card: `accent="left"` (coral left rule — decorative, not "healthy")
- CLIQ CTA: `bracket="purple"` for visual distinction
- The `from-card to-muted/30` gradient is now the **default** on `Card`'s `default` and
  `institutional` variants; it is no longer applied per call site. Surfaces that set
  their own background opt out with `bg-none`.

### Buttons
- Primary actions: `variant="action"`, `size="action"`
- Secondary actions: `variant="action-outline"`
- CLIQ-mode actions: `variant="action-bronze"` / `action-bronze-outline`, so
  "this creates a proposal" reads differently from "this signs right now"
- Destructive: `variant="destructive"` (if needed)

---

## 8. Empty/Error States

### Not Connected State
```tsx
<Card variant="institutional" bracket="green">
  <CardHeader>
    <CardLabel comment>Validator Tools</CardLabel>
    <CardTitle>Connect Your Wallet</CardTitle>
  </CardHeader>
  <CardContent>
    <p>Connect your validator wallet to access the dashboard.</p>
    <div className="flex gap-3">
      <Button>Connect Keplr</Button>
      <Button variant="outline">Connect Ledger</Button>
    </div>
  </CardContent>
</Card>
```

### Not a Validator State
```tsx
<Card variant="institutional">
  <CardHeader>
    <CardLabel comment>Info</CardLabel>
    <CardTitle>Not a Validator</CardTitle>
  </CardHeader>
  <CardContent>
    <p>The connected wallet is not associated with a validator on {chainName}.</p>
    <Button>View Validators to Delegate</Button>
  </CardContent>
</Card>
```

### Jailed Validator Warning
```tsx
<Alert variant="destructive">
  <AlertCircle className="h-4 w-4" />
  <AlertTitle>Validator Jailed</AlertTitle>
  <AlertDescription>
    Your validator has been jailed. You can still claim pending rewards.
  </AlertDescription>
</Alert>
```

---

## 9. Integration Points

### Navigation (shipped)
- "Validator" tab and "Validator Tools" link on the chain landing page
- "Validator" item in the desktop sidebar rail. The rail auto-collapses to icons and
  expands on hover or keyboard focus as an **overlay**; the pin button (persisted via
  `lib/settingsStorage.ts` `sidebarPinned`) switches it to push mode.
- Below the `lg` breakpoint there is no rail at all — `components/Header.tsx` is the
  only navigation, and it does **not** currently list Validator.

### URL Structure
- Primary: `/[chainName]/validator`
- CLIQ mode: `/[chainName]/validator?address=<core1... cliq address>` — the query
  param is the **CLIQ account address**, not a `corevaloper1...` operator address.
  The dashboard derives the operator address from it.

---

## 10. Implementation Plan

### Phase 1: Core Dashboard (MVP)
1. Create `/pages/[chainName]/validator.tsx`
2. Implement validator detection on wallet connect
3. Build identity card with basic info
4. Add commission/rewards display
5. Implement claim commission action

### Phase 2: Enhanced Analytics
1. ~~Add performance metrics (uptime, missed blocks)~~ — **not done**
2. Add delegator count — done (`ValidatorDelegatorsCard`, plus a Delegators stat)
3. ~~Integrate external API for USD prices~~ — **not done**; amounts are shown in the native denom only
4. ~~Add transaction history~~ — **not done**; no Recent Transactions card exists

### Phase 3: CLIQ Conversion
1. Design and implement CLIQ upgrade CTA
2. Add "Why Multisig?" info modal
3. Track conversion funnel (optional, privacy-respecting)

### Phase 4: Polish
1. Mobile optimization
2. Loading states and skeleton UI
3. Error handling edge cases
4. Accessibility audit

---

## 11. Success Metrics

### User Engagement
- Number of wallet connections
- Transactions executed (claim, withdraw)
- Time spent on dashboard

### Conversion
- Click-through to CLIQ creation
- Validators who later create a CLIQ

### Performance
- Page load time < 2s
- Transaction broadcast success rate > 99%

---

## 12. File Structure

As shipped:

```
/pages/
  └── [chainName]/
      └── validator.tsx              # Main validator dashboard page

/components/
  └── dataViews/
      └── ValidatorDashboard/
          ├── index.tsx              # Main dashboard component + mode detection
          ├── ValidatorIdentityCard.tsx
          ├── PendingRewardsCard.tsx
          ├── ValidatorPerformanceCard.tsx
          ├── ValidatorDelegatorsCard.tsx
          ├── ValidatorCommandsCard.tsx
          ├── ProposalViewer.tsx
          ├── CliqUpgradeCTA.tsx
          └── WithdrawAddressCard.tsx

/lib/
  ├── validatorHelpers.ts            # Validator-specific queries and utils
  ├── validatorTx.ts                 # Tx assembly (gas via gasOfTx)
  ├── validatorEdit.ts               # MsgEditValidator helpers
  └── txMsgHelpers.ts                # gasOfMsg / gasOfTx — the single gas table
```

`ValidatorStatsCard.tsx` and `RecentTransactionsCard.tsx` from the original spec do
not exist.

---

## 13. Accessibility

### Requirements
- All interactive elements keyboard accessible
- Screen reader announcements for status changes
- Color-blind friendly status indicators (icons + color)
- Focus management on action completion

---

## 14. Security Considerations

- No private key handling (all signing via wallet)
- No address storage or tracking
- ~~Rate limiting on RPC queries~~ — **not implemented**; there is no rate limiting anywhere in the app
- Clear transaction preview before signing
- Validate all user inputs
- CLIQ mode verifies membership before enabling any action; a non-member gets a read-only dashboard

---

*Validator Dashboard PRD for Cosmos Multisig UI*


# Validator Dashboard PRD

**Cosmos Multisig UI - Free Validator Dashboard Specification**  
**Version:** 1.0  
**Last Updated:** December 2024

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

### Entry Points
1. Tab on chain landing page (`/[chainName]`)
2. Direct URL (`/[chainName]/validator`)
3. CTA from account page when validator address detected

### Primary Flow
```
1. User lands on Validator tab/page
2. Connects wallet (Keplr/Ledger)
3. System detects if connected address is a validator
4. If validator: Show full dashboard with analytics + actions
5. If not validator: Show helpful message + option to delegate
```

---

## 3. Page Layout

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

### 4.1 Validator Identity Card
**Location:** Top-left  
**Variant:** `institutional` with `bracket="green"`  
**Content:**
- Validator moniker (or address if no moniker)
- Validator status badge (Active/Jailed/Inactive)
- Commission rate
- Validator operator address (truncated with copy)
- Link to explorer

### 4.2 Quick Stats Row
**Location:** Top-right  
**Variant:** `outline` (3 mini cards)  
**Content:**
- Total Pending Commission (in native token + USD)
- Total Staking Rewards (in native token + USD)
- Voting Power (% of network)

### 4.3 Pending Rewards Card (Primary Action Card)
**Location:** Middle-left  
**Variant:** `institutional` with `accent="left"` (green)  
**Content:**
- Commission breakdown by token
- Self-delegation rewards
- Last claim timestamp
- **Primary Actions:**
  - "Claim Commission" button (executes MsgWithdrawValidatorCommission + MsgWithdrawDelegatorReward)
  - Optional: "Claim to Different Address" (if withdraw address is set)

### 4.4 Validator Performance Card
**Location:** Middle-right  
**Variant:** `institutional`  
**Content:**
- Uptime percentage (last 10K blocks)
- Missed blocks count
- Current commission rate
- Number of delegators
- Self-delegation amount
- Ranking in active set

### 4.5 CLIQ Upgrade CTA Card
**Location:** Middle, full width  
**Variant:** `institutional` with `bracket="purple"` (secondary accent)  
**Content:**
- Headline: "Secure Your Validator Operations"
- Value props:
  - "No single point of failure"
  - "Team-based key management"
  - "Works with your existing validator"
- CTAs:
  - Primary: "Create Validator CLIQ" → `/[chainName]/create`
  - Secondary: "Learn More" → Opens info modal

### 4.6 Withdraw Address Card
**Location:** Bottom-left  
**Variant:** `institutional`  
**Content:**
- Current withdraw address (or "Same as operator" if not set)
- "Change Withdraw Address" button
- Form inline or modal

### 4.7 Recent Transactions Card
**Location:** Bottom-right  
**Variant:** `outline`  
**Content:**
- Last 5 commission-related transactions from explorer API
- Links to block explorer

---

## 5. Data Sources

### On-Chain Queries (CosmJS)
| Data | Query Method |
|------|--------------|
| Validator info | `staking.validator(operatorAddr)` |
| Commission | `distribution.validatorCommission(operatorAddr)` |
| Rewards | `distribution.delegationRewards(delegatorAddr, validatorAddr)` |
| Withdraw address | `distribution.delegatorWithdrawAddress(delegatorAddr)` |
| Signing info | `slashing.signingInfo(consAddress)` |
| Delegators count | `staking.validatorDelegations(operatorAddr)` (paginated) |

### External APIs (Optional Enhancement)
| Data | API |
|------|-----|
| Historical performance | Mintscan API / Chain registry |
| USD prices | CoinGecko / Osmosis API |
| Transaction history | Mintscan API |

### Privacy-First Approach
- No data stored on our servers
- All queries made client-side
- No analytics tracking of validator addresses
- Optional: Local storage for UI preferences only

---

## 6. Transaction Execution

### Supported Actions
| Action | Message Type(s) | Gas Estimate |
|--------|-----------------|--------------|
| Claim Commission | MsgWithdrawValidatorCommission + MsgWithdrawDelegatorReward | 1,100,000 |
| Withdraw Rewards | MsgWithdrawDelegatorReward | 500,000 |
| Set Withdraw Address | MsgSetWithdrawAddress | 100,000 |

### Transaction Flow
1. User clicks action button
2. Build transaction with appropriate gas
3. Display fee estimate to user
4. User confirms in wallet (Keplr/Ledger)
5. Broadcast transaction
6. Show success/error with tx hash
7. Auto-refresh data after confirmation

---

## 7. Design Specifications

### Color Scheme (Dark Mode)
Following existing UI4 design system:
- Primary accent: Green (`--accent-green`)
- Secondary accent: Purple (`--accent-purple`) for CLIQ CTA
- Status colors:
  - Active: Green
  - Jailed: Red (`--destructive`)
  - Inactive: Yellow/Warning

### Typography
- Validator moniker: `font-heading`, `text-xl`, `font-bold`
- KPI values: `text-kpi`, `tabular-nums`
- Labels: `font-mono`, `uppercase`, `tracking-wider`
- Addresses: `font-mono`, `text-sm`

### Cards
- Use `Card` component with `variant="institutional"`
- Primary action card: `accent="left"` (green border)
- CLIQ CTA: `bracket="purple"` for visual distinction
- Stats cards: `variant="outline"` for lighter appearance

### Buttons
- Primary actions: `variant="action"`, `size="action"`
- Secondary actions: `variant="action-outline"`
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

### Navigation
- Add "Validator" tab to chain landing page tabs
- Add sidebar link in dashboard layout
- Add link from account page when validator detected

### URL Structure
- Primary: `/[chainName]/validator`
- Direct access with validator address: `/[chainName]/validator?address=corevaloper1...`

### Header Updates
Add "Validator" to main navigation when on chain pages.

---

## 10. Implementation Plan

### Phase 1: Core Dashboard (MVP)
1. Create `/pages/[chainName]/validator.tsx`
2. Implement validator detection on wallet connect
3. Build identity card with basic info
4. Add commission/rewards display
5. Implement claim commission action

### Phase 2: Enhanced Analytics
1. Add performance metrics (uptime, missed blocks)
2. Add delegator count
3. Integrate external API for USD prices
4. Add transaction history

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

```
/pages/
  └── [chainName]/
      └── validator.tsx              # Main validator dashboard page

/components/
  └── dataViews/
      └── ValidatorDashboard/
          ├── index.tsx              # Main dashboard component
          ├── ValidatorIdentityCard.tsx
          ├── ValidatorStatsCard.tsx
          ├── PendingRewardsCard.tsx
          ├── ValidatorPerformanceCard.tsx
          ├── CliqUpgradeCTA.tsx
          ├── WithdrawAddressCard.tsx
          └── RecentTransactionsCard.tsx

/lib/
  └── validatorHelpers.ts            # Validator-specific queries and utils
```

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
- Rate limiting on RPC queries
- Clear transaction preview before signing
- Validate all user inputs

---

*Validator Dashboard PRD for Cosmos Multisig UI*


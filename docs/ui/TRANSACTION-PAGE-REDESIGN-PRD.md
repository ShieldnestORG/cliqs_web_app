# Transaction Page Redesign PRD

> **Cluster:** design-system · **Tags:** transaction-page, broadcast, bento, fees, verification · **Related:** [UI index](INDEX.md), [CARDS-PRD.md](CARDS-PRD.md), [Validator Dashboard PRD](VALIDATOR-DASHBOARD-PRD.md), [User Guide](../App%20User%20Guide.md)

**Cosmos Multisig UI - In Progress Transaction Page Redesign**  
**Version:** 1.1  
**Last Updated:** 2026-08-16

> **Status: shipped, with drift.** `pages/[chainName]/[address]/transaction/[transactionID].tsx`
> implements this redesign, but the in-progress layout landed as a two-column flex row
> rather than the 4-card bento grid drawn in §5, and the page has since grown a set of
> broadcast-safety states that this document originally did not cover (§4.5–§4.9).
> Sections marked **(as shipped)** were reconciled against the code; the rest is the
> original intent spec.

---

## 1. Executive Summary

### Problem Statement
The current "In Progress Transaction" page uses a vertical, stacked layout that:
- Requires excessive scrolling to view all transaction information
- Lacks visual hierarchy and intuitive information grouping
- Doesn't leverage the existing bento card design system
- Makes it difficult to quickly assess transaction status and required actions

### Solution Overview
Redesign the transaction page using a horizontal bento card layout that:
- Groups related information into distinct, scannable cards
- Utilizes the existing bento grid system for responsive, intuitive layouts
- Improves information density while maintaining readability
- Follows established design patterns from the dashboard and other pages

---

## 2. Current State Analysis

### Current Layout Structure
```
┌─────────────────────────────────────┐
│ ← BACK TO MULTISIG                  │
├─────────────────────────────────────┤
│ In Progress Transaction             │
├─────────────────────────────────────┤
│ [Broadcast Transaction Button]      │
├─────────────────────────────────────┤
│ Current Signers                     │
│ • core1jcas459gnu857ylephjdjlea... │
│ • core1mgvlgvh2hfw5pgdqc79up3du... │
│ • core1ltltw0jya4hq39myd9798qqv... │
│ ✔ You've signed this transaction   │
├─────────────────────────────────────┤
│ [Cancel Transaction Button]         │
│ Cancelling marks this transaction...│
├─────────────────────────────────────┤
│ Signing Info                        │
│ Chain ID: coreum-mainnet-1          │
│ Account #: 31625                     │
│ Tx Sequence: 3                      │
│ Chain Sequence: 3 ✔ OK              │
│ Gas: 600000                         │
│ Fee: 37500 UCORE                    │
├─────────────────────────────────────┤
│ MsgWithdrawValidatorCommission      │
│ Validator Address: corevaloper14... │
└─────────────────────────────────────┘
```

> Historical snapshot — the `Gas: 600000 / Fee: 37500` figures above were captured
> before `gasOfMsg(WithdrawValidatorCommission)` was raised to 600,000. The same
> transaction is sized at **700,000 gas / 43,750 ucore** today (100,000 flat +
> 600,000, at a 0.0625 ucore gas price).

### Issues Identified
1. **Vertical Stacking**: All information stacked vertically, requiring scrolling
2. **No Visual Grouping**: Related information not visually grouped
3. **Action Buttons Scattered**: Primary actions (Broadcast, Cancel) not prominently placed
4. **Information Hierarchy**: No clear visual distinction between different types of information
5. **Mobile Unfriendly**: Vertical layout doesn't adapt well to different screen sizes

---

## 3. Proposed Design

### Layout Structure (Desktop)
```
┌─────────────────────────────────────────────────────────────────────────┐
│ ← BACK TO MULTISIG                                                      │
├─────────────────────────────────────────────────────────────────────────┤
│ In Progress Transaction                                                 │
├─────────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────┐  ┌──────────────────────┐  ┌───────────────┐ │
│ │ SIGNING STATUS       │  │ TRANSACTION DETAILS  │  │ MESSAGE INFO  │ │
│ │                      │  │                      │  │               │ │
│ │ [Threshold Progress] │  │ Chain ID: ...        │  │ Type: ...     │ │
│ │ Signatures: 2/3      │  │ Account #: ...       │  │ Details: ...  │ │
│ │                      │  │ Sequence: ...        │  │               │ │
│ │ [Current Signers]    │  │ Gas: ...             │  │               │ │
│ │ • Address 1          │  │ Fee: ...             │  │               │ │
│ │ • Address 2          │  │                      │  │               │ │
│ │                      │  │                      │  │               │ │
│ │ [Sign Transaction]   │  │                      │  │               │ │
│ └──────────────────────┘  └──────────────────────┘  └───────────────┘ │
│                                                                         │
│ ┌───────────────────────────────────────────────────────────────────┐ │
│ │ PRIMARY ACTIONS                                                   │ │
│ │                                                                   │ │
│ │ [Broadcast Transaction] [Cancel Transaction]                      │ │
│ │                                                                   │ │
│ └───────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

### Layout Structure (Mobile)
```
┌─────────────────────────┐
│ ← BACK TO MULTISIG      │
├─────────────────────────┤
│ In Progress Transaction │
├─────────────────────────┤
│ ┌─────────────────────┐ │
│ │ SIGNING STATUS      │ │
│ │ [Progress]          │ │
│ │ [Signers List]      │ │
│ │ [Sign Button]       │ │
│ └─────────────────────┘ │
│ ┌─────────────────────┐ │
│ │ TRANSACTION DETAILS │ │
│ │ [All metadata]      │ │
│ └─────────────────────┘ │
│ ┌─────────────────────┐ │
│ │ MESSAGE INFO         │ │
│ │ [Message details]    │ │
│ └─────────────────────┘ │
│ ┌─────────────────────┐ │
│ │ PRIMARY ACTIONS      │ │
│ │ [Broadcast]          │ │
│ │ [Cancel]             │ │
│ └─────────────────────┘ │
└─────────────────────────┘
```

---

## 4. Component Breakdown

### Card 1: Signing Status Card
**Location:** Top-left (desktop), First card (mobile)  
**Col Span:** 2 (desktop), Full (mobile)  
**Row Span:** 2 (desktop), 1 (mobile)  
**Variant:** `highlight` (green accent border)  
**Content:**
- Threshold progress indicator (X/Y signatures)
- List of current signers with addresses
- User's signing status (signed/not signed)
- Sign transaction button (if applicable)
- Share URL functionality

**Components Used:**
- `BentoCard` with `variant="highlight"`, `colSpan={2}`, `rowSpan={2}`
- `BentoCardHeader` with `BentoCardTitle` (icon: Users)
- `BentoCardContent` for signers list
- `BentoCardFooter` for sign button

### Card 2: Transaction Details Card
**Location:** Top-center (desktop), Second card (mobile)  
**Col Span:** 2 (desktop), Full (mobile)  
**Row Span:** 1 (desktop), 1 (mobile)  
**Variant:** `default`  
**Content:**
- Chain ID
- Account Number
- Transaction Sequence
- Chain Sequence (with mismatch indicator if applicable)
- Gas limit
- Fee amount
- Memo (if present)

**Components Used:**
- `BentoCard` with `variant="default"`, `colSpan={2}`
- `BentoCardHeader` with `BentoCardTitle` (icon: FileText)
- `BentoCardContent` with key-value pairs
- Sequence mismatch warning (if applicable)

### Card 3: Message Details Card
**Location:** Top-right (desktop), Third card (mobile)  
**Col Span:** 1 (desktop), Full (mobile)  
**Row Span:** 1 (desktop), 1 (mobile)  
**Variant:** `accent` (purple gradient)  
**Content:**
- Message type (e.g., MsgWithdrawValidatorCommission)
- Message-specific parameters
- Expandable details for complex messages

**Components Used:**
- `BentoCard` with `variant="accent"`, `colSpan={1}`
- `BentoCardHeader` with `BentoCardTitle` (icon: MessageSquare)
- `BentoCardContent` with message details
- Existing `TxMsgDetails` components

### Card 4: Primary Actions Card
**Location:** Bottom, full width  
**Col Span:** Full  
**Row Span:** 1  
**Variant:** `muted`  
**Content:**
- Broadcast Transaction button (if threshold met)
- Cancel Transaction button
- Action descriptions/help text

**Components Used:**
- `BentoCard` with `variant="muted"`, `colSpan="full"`
- `BentoCardHeader` with `BentoCardTitle` (icon: Zap)
- `BentoCardContent` with action buttons
- `BentoCardFooter` for help text

### Special States **(as shipped)**

#### Sequence Mismatch Warning
**Location:** Full-width `Card variant="institutional"` above the layout
**Style:** `border-destructive/50 bg-destructive/10`, `AlertTriangle`
**Content:**
- Warning message
- Expected vs actual sequence
- Solution guidance ("cancel this transaction and create a new one")

Setting the mismatch also swaps the page out of the in-progress layout into the bento
grid used for completed transactions, so signing and broadcasting are unavailable.

#### Cancelled Transaction State
**Location:** Full-width banner above cards
**Style:** `border-border/[0.06] bg-muted/20`
**Content:**
- Cancelled status message
- Explanation that transaction cannot be signed/broadcast
- Followed by a flat, non-nested card layout (Signing Info + one card per message)

#### Completed Transaction State
**Location:** Full-width `CompletedTransaction` block above the bento grid
**Content:**
- Transaction hash
- "View in Explorer" button
- The Multi-Endpoint Verification card (below)

#### Pre-broadcast fee balance check
Before broadcasting, the page queries the **multisig account's** balance for every
denom in `txInfo.fee.amount` and refuses to send if it cannot cover the fee. The error
names the shortfall and the fact that the multisig — never a signer wallet — is the fee
payer, and states that the collected signatures remain valid because nothing was sent.
The check is best-effort: if the balance query itself throws, the page proceeds and
lets the chain give the definitive answer.

Two distinct post-broadcast fee errors are surfaced with different guidance:
- **"Multisig account cannot cover the fee"** (`insufficient funds`) — the fix is to
  fund the multisig address and retry. The page only claims the signatures are still
  valid when it can prove the tx never entered a block (a cosmjs `Broadcasting
  transaction failed` CheckTx rejection, or its own pre-broadcast check).
- **"Transaction fee too low"** (`insufficient fee`) — the chain's gas price rose after
  the proposal was created; the fee is fixed at signing time, so the transaction must be
  cancelled and recreated.

#### Multi-endpoint verification (verified / partial)
`verificationStatus` is one of `idle | verifying | verified | partial | failed`. The
Multi-Endpoint Verification card lists the primary broadcast endpoint and each
secondary verification with its response time. **Partial** means the primary endpoint
proved inclusion but fewer witness endpoints than required have confirmed yet — it is
rendered as a `warning`-toned success, not a failure, and the tx hash is still written
to the database.

#### DeliverTx failure (landed but failed)
When the transaction is included in a block with a non-zero result code, the page
records the hash, sets status `broadcast`, and raises a "Transaction failed on-chain"
notification explaining that the fee was consumed and the sequence advanced, so
re-broadcasting can never succeed. Two raw-log patterns get specific guidance:
commission changed more than once in 24 hours, and a commission change exceeding the
validator's max change rate.

> **Known limitation.** The page title (`[transactionID].tsx:706-712`) resolves in order:
> `isLoadingTx` → "Loading Transaction...", then `transactionStatus === "cancelled"` →
> "Cancelled Transaction", then `transactionHash` → "Completed Transaction", else
> "In Progress Transaction". So the hash is not the only input — but it is the only one
> that distinguishes a landed transaction, and nothing in that chain inspects the result
> code. A landed-but-failed transaction has a hash and a status of `broadcast`, not
> `cancelled`, so it still renders as **"Completed Transaction"**. There is no failed
> status in the data model. Until there is, the explorer link is the only reliable
> indicator of whether the transaction did what it was meant to.

#### Retry cards (instead of dead ends)
- **Could not load this transaction** — a transient fetch failure no longer bounces the
  user to `/404`; only a definitive "Transaction not found" does. Everything else
  renders a destructive-toned card with a **Retry** button that re-runs `loadTx`.
- **Could not load the multisig account** — without a pubkey the whole signing footer
  is hidden, so the failure gets its own card with a **Retry** button rather than a
  toast that scrolls away.

---

## 5. Design Specifications

### Grid Layout **(as shipped)**

The page renders one of three layouts depending on state:

**In progress** — a two-column flex row, not a bento grid:

```tsx
<div className="flex flex-col gap-4 md:gap-6 lg:flex-row">
  <div className="w-full lg:w-[380px] lg:flex-shrink-0">
    <BentoCard variant="highlight" className="flex h-full flex-col p-6">
      {/* Signing Status: threshold count, signer list, Sign / Broadcast / Cancel */}
    </BentoCard>
  </div>
  <div className="…">
    <BentoCard variant="default" className="p-6">{/* Transaction Details */}</BentoCard>
    <BentoCard variant="accent"  className="flex-1 p-6">{/* Message Details */}</BentoCard>
  </div>
</div>
```

**Completed, or sequence mismatch** — a 3-column bento grid of Transaction Details
(`default`), Message Details (`accent`) and, when still cancellable, an Actions card
(`muted`, `Zap` icon):

```tsx
<BentoGrid className="auto-rows-[minmax(200px,auto)] grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
```

**Cancelled** — a flat `space-y-4` stack of `Card variant="institutional"` blocks
(Signing Info, then one card per message), deliberately avoiding nested cards.

The original proposal below is kept for intent; the separate full-width "Primary
Actions" card was never built — Broadcast and Cancel live in the Signing Status card's
footer while the transaction is in progress.

```tsx
<BentoGrid className="grid-cols-1 md:grid-cols-4 lg:grid-cols-5 auto-rows-[minmax(200px,auto)]">
  {/* Signing Status - 2 cols, 2 rows */}
  <BentoCard colSpan={2} rowSpan={2} variant="highlight">
    {/* Content */}
  </BentoCard>
  
  {/* Transaction Details - 2 cols, 1 row */}
  <BentoCard colSpan={2} variant="default">
    {/* Content */}
  </BentoCard>
  
  {/* Message Details - 1 col, 1 row */}
  <BentoCard colSpan={1} variant="accent">
    {/* Content */}
  </BentoCard>
  
  {/* Primary Actions - Full width */}
  <BentoCard colSpan="full" variant="muted">
    {/* Content */}
  </BentoCard>
</BentoGrid>
```

### Responsive Breakpoints
- **Mobile (< 768px)**: Single column, all cards full width
- **Tablet (768px - 1024px)**: 2 columns, cards adapt
- **Desktop (> 1024px)**: 4-5 columns, optimized layout

### Color Usage
- **Signing Status**: `variant="highlight"` — a `border-green-accent/50` edge plus
  bracket corners. **Note the trap:** `--accent-green` is hue 10.9, i.e. **coral**, not
  green. It is decoration, not a health signal.
- **Transaction Details**: `variant="default"` — neutral information display
- **Message Details**: `variant="accent"` — purple gradient, highlights transaction type
- **Primary Actions**: `variant="muted"` — secondary action area
- **Semantic status** uses the semantic tokens, never the brand accents: `text-success`
  for a verified endpoint, `text-warning` for partial/unconfirmed, `text-destructive`
  (with `bg-destructive/10`) for the sequence-mismatch and retry cards.

### Typography
- **Card Titles**: `font-heading`, `text-lg`, `font-semibold`
- **Labels**: `text-label`, `text-label-comment` (monospace, uppercase)
- **Values**: `font-mono`, `text-foreground`
- **Help Text**: `text-sm`, `text-muted-foreground`

### Icons
- **Signing Status**: `Users` (lucide-react)
- **Transaction Details**: `FileText` (lucide-react)
- **Message Details**: `MessageSquare` (lucide-react)
- **Primary Actions**: `Zap` (lucide-react)
- **Warning**: `AlertTriangle` (lucide-react)
- **Success**: `CheckCircle2` (lucide-react)

---

## 6. Implementation Plan

### Phase 1: Component Extraction
1. Extract `TransactionSigning` component logic into reusable pieces
2. Extract `TransactionInfo` component into card-compatible format
3. Create new card components for each section

### Phase 2: Layout Implementation
1. Replace `StackableContainer` with `BentoGrid` and `BentoCard`
2. Implement responsive grid layout
3. Add proper card variants and styling

### Phase 3: State Management
1. Ensure all transaction states (pending, cancelled, completed) work with new layout
2. Handle sequence mismatch warnings
3. Implement threshold progress visualization

### Phase 4: Polish & Testing
1. Add hover effects and transitions
2. Test responsive behavior
3. Verify accessibility
4. Test with different transaction types

---

## 7. File Structure

### Modified Files **(as shipped)**
- `pages/[chainName]/[address]/transaction/[transactionID].tsx` - Main page component;
  holds all three layouts, the broadcast flow, the fee pre-check and every special state
- `components/dataViews/CompletedTransaction.tsx` - hash + "View in Explorer"
- `components/forms/TransactionSigning.tsx` - signing widget, intent verification gate

### New Components (Optional)
None of the four extracted card components below were created. The cards are written
inline in the page component, which is why it is ~1,400 lines. Extraction remains open.

- ~~`components/dataViews/TransactionInfo/SigningStatusCard.tsx`~~
- ~~`components/dataViews/TransactionInfo/TransactionDetailsCard.tsx`~~
- ~~`components/dataViews/TransactionInfo/MessageDetailsCard.tsx`~~
- ~~`components/dataViews/TransactionInfo/ActionsCard.tsx`~~

---

## 8. Success Metrics

### User Experience
- ✅ Reduced scrolling required to view all information
- ✅ Faster comprehension of transaction status
- ✅ Clearer visual hierarchy
- ✅ Better mobile experience

### Technical
- ✅ Consistent with existing design system
- ✅ Responsive across all breakpoints
- ✅ Accessible (WCAG 2.1 AA)
- ✅ Performance maintained or improved

---

## 9. Design Tokens Reference

### BentoCard Variants **(as shipped — `components/ui/bento-grid.tsx`)**
- `default`: `bg-card bg-gradient-to-br from-card to-muted/30 border-border/[0.06]`
- `highlight`: same gradient + `border-green-accent/50 card-bracket-corner`
- `accent`: `bg-gradient-to-br from-card to-muted/50 border-purple-accent/30`
- `muted`: `bg-muted/30 border-border/50`

The `from-card to-muted/30` gradient is the **default** on `default` and `highlight`
(and on `Card`'s `default` and `institutional`); it is no longer opted into per call
site. Surfaces that paint their own background opt out with `bg-none`.

### Spacing
- Card padding: `p-6` (24px)
- Grid gap: `gap-4 md:gap-6` (16px mobile, 24px desktop)
- Content spacing: `space-y-4` (16px)

### Borders
- Default: `border-border/[0.06]`
- Highlight: `border-green-accent/50` — the utility is `green-accent`, and the token
  behind it (`--accent-green`) is **coral**
- Accent: `border-purple-accent/30` — the utility is `purple-accent`, **not**
  `accent-purple`; the reversed name silently produces no CSS

---

## 10. Accessibility Considerations

### Keyboard Navigation
- All interactive elements must be keyboard accessible
- Focus states clearly visible
- Tab order logical

### Screen Readers
- Card titles properly labeled
- Status changes announced
- Action buttons have descriptive labels

### Color Contrast
- All text meets WCAG AA contrast ratios
- Status indicators use icons + color
- No information conveyed by color alone

---

*Transaction Page Redesign PRD for Cosmos Multisig UI*










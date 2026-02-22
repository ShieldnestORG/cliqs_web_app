# Transaction Page Redesign PRD

**Cosmos Multisig UI - In Progress Transaction Page Redesign**  
**Version:** 1.0  
**Last Updated:** December 2024

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

### Special States

#### Sequence Mismatch Warning
**Location:** Full-width banner above cards  
**Style:** Red accent border, warning icon  
**Content:**
- Warning message
- Expected vs actual sequence
- Solution guidance

#### Cancelled Transaction State
**Location:** Full-width banner above cards  
**Style:** Gray muted border  
**Content:**
- Cancelled status message
- Explanation that transaction cannot be signed/broadcast

#### Completed Transaction State
**Location:** Full-width banner above cards  
**Style:** Green accent border  
**Content:**
- Transaction hash
- Link to explorer
- Completion timestamp

---

## 5. Design Specifications

### Grid Layout
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
- **Signing Status**: Green accent (`variant="highlight"`) - indicates active signing process
- **Transaction Details**: Default card - neutral information display
- **Message Details**: Purple accent (`variant="accent"`) - highlights transaction type
- **Primary Actions**: Muted (`variant="muted"`) - secondary action area

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

### Modified Files
- `pages/[chainName]/[address]/transaction/[transactionID].tsx` - Main page component
- `components/dataViews/TransactionInfo/index.tsx` - Refactor to card format
- `components/forms/TransactionSigning.tsx` - Refactor to card format

### New Components (Optional)
- `components/dataViews/TransactionInfo/SigningStatusCard.tsx` - Signing status card
- `components/dataViews/TransactionInfo/TransactionDetailsCard.tsx` - Transaction metadata card
- `components/dataViews/TransactionInfo/MessageDetailsCard.tsx` - Message info card
- `components/dataViews/TransactionInfo/ActionsCard.tsx` - Primary actions card

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

### Card Variants
- `default`: Standard card with border
- `highlight`: Green accent border (for signing status)
- `accent`: Purple gradient (for message details)
- `muted`: Subtle background (for actions)

### Spacing
- Card padding: `p-6` (24px)
- Grid gap: `gap-4 md:gap-6` (16px mobile, 24px desktop)
- Content spacing: `space-y-4` (16px)

### Borders
- Default: `border-2 border-border`
- Highlight: `border-green-accent/50`
- Accent: `border-accent-purple/30`

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










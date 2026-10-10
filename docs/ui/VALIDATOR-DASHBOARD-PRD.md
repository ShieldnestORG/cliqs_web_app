# Validator Dashboard PRD

> **Cluster:** design-system · **Tags:** validator, dashboard, cliq-mode, gas, scale-rule, kit-icons · **Related:** [UI index](INDEX.md), [STYLE-GUIDE.md](../STYLE-GUIDE.md), [Buttons PRD](BUTTONS-PRD.md), [Patterns PRD](PATTERNS-PRD.md), [Transaction Page Redesign PRD](TRANSACTION-PAGE-REDESIGN-PRD.md), [User Guide](../App%20User%20Guide.md)

**Cosmos Multisig UI - Free Validator Dashboard Specification**  
**Version:** 1.4  
**Last Updated:** 2026-10-10

> **2026-10-10: compact layout.** After the owner's review of the PR #81 preview the page was
> rebuilt as a short column of sections under scale rules (§3, §4). Signing did not change: every
> claim, vote, unjail, edit and withdraw button keeps its handler and its `disabled` rule, byte for
> byte. Two checks hold that, and they cover different things: the signing fence (a
> check kept outside this repo that hashes the signing functions; it prints `FENCE OK`) freezes
> the signing **functions**; it does **not** see JSX wiring (which handler a button calls, with which
> arguments, and its `disabled` rule: measured 2026-10-10, swapping the two Claim handlers left
> the fence green). That wiring is pinned by jest: `validator-rewards`, `validator-vote-options`,
> `validator-edit-submit`, `validator-withdraw-address`, `jailed-alert`, `unjail-action` and the
> "what the cards are handed" and "connect your wallet" groups in `validator-dashboard`. Wording
> that described the earlier layout is kept below as "until 2026-10-10".
>
> The last gaps in that wiring are closed: `validator-edit-submit` has a table over all
> seven editable fields (moniker, identity, website, security contact, details, commission rate,
> min self-delegation), in direct and CLIQ mode, that switches only one field on and checks the
> message carries its value there and `[do-not-modify]` everywhere else (six single swaps of
> switch or input bindings had survived the single-field tests) and also reads the screen: each
> switch shows its own field's state (only the clicked one on) and each text box shows its own
> value before and after typing (a switch `checked` or a box `value` pointed at another field
> left the message unchanged, so seven swaps of each had survived the message-only table);
> `validator-dashboard` gives the
> commission and the self-delegation rewards different amounts and checks each card prop by
> identity (two empty lists were equal, so swapping them passed); and `validator-withdraw-address`
> and `validator-edit-submit` each hold the signing stub pending and check that Confirm /
> Update Validator and Cancel are off while the submit is in flight.

> **2026-10-10: one row where it was two.** The first version left the network control
> 352x74px (its caption wrapped to two lines under the boxes), the identity strip on two rows at
> 1024px (the Explorer link wrapped), the withdraw address on two lines, and an opened "Past
> proposals" list that grew Governance from 384px to 966px and dragged the Stakers card with it
> (all measured on a real build). Now: the control is one row (§4.8), the strip is one row at
> 1024px with an icon-only explorer link (§4.1), the withdraw address is one line (§4.2), the
> opened past list scrolls inside one box and its count is honest (§4.4), and the tile and the
> section both say "Stakers" (§4.3, §4.5). Wording from before is kept as "until 2026-10-10".

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
3. **Conversion Funnel**: Soft-sell running a *new* validator from a CLIQ (an existing validator's operator can't change)
4. **Brand Building**: Position as the go-to validator management tool

---

## 2. User Flow

### Entry Points (as shipped)
1. "Validator" item in the Sidebar (lg and up) and in the Header menu (below lg). Both read the one list in `lib/navigation.ts`.
2. "Validators" section on Home (`/[chainName]/dashboard`), shown when the connected wallet (or one of its CLIQs) is linked to a validator. Its "Manage Validator" button opens `/[chainName]/validator?address=<address>`.
3. Direct URL (`/[chainName]/validator`). This URL is unchanged by the 2026-10 flow cleanup because external runbooks link it.
4. `/[chainName]/validator?address=<cliq address>` — see CLIQ mode below

> Note (2026-10-09): this list said the entry points were a "Validator Tools" link and a Validator tab on the chain landing page, plus the Validator item in the desktop sidebar only. The landing page is gone (`/[chainName]` now redirects to Home), and Validator is in both menus.

### Primary Flow
```
1. User lands on the Validator page
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
| Button labels | "Claim", "Claim all" (one Claim per amount) | "Create: Claim", "Create: Claim all" |
| Button variants | `default` (the one primary) / `outline` | `action-bronze` / `action-bronze-outline` |

*Until 2026-10-10 the labels were "Claim Commission Only" / "Claim Rewards Only" (CLIQ: "Create: Claim Commission" / "Create: Claim Rewards") and the variants `action` / `action-outline`.*

CLIQ mode also verifies membership before enabling anything: a non-member sees the
dashboard read-only (`cliqReadOnly`).

**Page top.** The page title ("Validator Dashboard", an H1) comes first in every state
(`pages/[chainName]/validator.tsx`). Directly under it an **"Acting as" band** states the
mode in plain words: "Acting as your wallet. Actions sign with your connected wallet.",
"Acting as CLIQ core1…. Actions create a transaction for this CLIQ; its members
sign it, then one member broadcasts.", or "No wallet connected. Connect a wallet to act on
this validator.". In CLIQ mode, when membership could not be verified, the band also carries the
read-only warning (`ValidatorDashboard/index.tsx`).

---

## 3. Page Layout

### Shipped layout (2026-10-10)

The old layout measured 3,454px tall at 1024px for TOKNS.FI. A static render of the new one at
the same width measured 1,865px on testnet and 1,903px on mainnet (the real-assets line added a
row; it now shares the control's row). That render used a fallback font and no lucide icons, so
treat the figures as approximate. Measured on a real build of the first version (1024px, 645
stakers): 1,939px by default. The one-row changes remove the context-row wrap (74px to about 40px,
measured by editing the live DOM of that build) and the strip wrap (about 40px). Measured on a
real build of the head after those changes (1024px, 645 stakers): 1,843px by default, the context
row 40px, the identity strip and the withdraw line one row each.
Nothing important is below the first screen: the header, the context row and the Rewards panel
all fit in the first 768px.

Top to bottom (`pages/[chainName]/validator.tsx` and `ValidatorDashboard/index.tsx`):

```
Validator Dashboard                                  (H1, under the breadcrumb)
[JAILED ALERT, only while jailed, with Unjail]
TOKNS.FI  Active  Commission 5.0%  Operator core1..  Account core1..  [explorer icon]   (header strip, one row at 1024px)
Acting as your wallet. ...   [Mainnet] [Testnet] Real assets. Check before you sign.  [Refresh]   (context row; on testnet a gold TESTNET badge replaces the caption)

| REWARDS  |||||||||||||     | PERFORMANCE  |||||||||||||      (scale rules; Rewards is coral)
[ commission .... [Claim]  ]  [ voting power | rank | stakers ]
[ self-delegation [Claim]  ]  [ total stake, self-delegation, ... ]
[ Claim all                ]
[ Paid to core1.. [Change] ]            (one line)

| GOVERNANCE  ||||||||||||     | STAKERS  ||||||||||||||||
[ active proposals         ]  [ 645 stakers . 0 unbonding ]
[ Past proposals (latest N) v ]  [ top 5 rows, Show all 645 ]   (N = rows shown, at most 10)

| MANAGE  ||||||||||||||||||||||||||||||||||||||||||||||||||
[ validator commands, Edit validator ]
[ CLIQ upgrade CTA: unchanged, hidden in CLIQ mode ]
```

- **Jailed alert** (`JailedAlert.tsx`): a full-width alert, the very first block of the dashboard
  while the validator is jailed, hosting `UnjailAction` unchanged. At 375px the Unjail button is
  on the first screen.
- **Header strip** (`ValidatorIdentityCard.tsx`, now a strip rather than a card): moniker (h2),
  status badge (Active `success`, Unbonding `warning`, Jailed `destructive`), commission rate,
  operator and account addresses with copy buttons, explorer link. No card chrome, no "Validator" label.
- **Context row**: left, the "Acting as" sentence (and, in a read-only CLIQ, the `text-warning`
  line, exactly once); right, the network control (`components/DevTools/NetworkToggle.tsx`) and Refresh.
- **Sections**: each is a `<section>` with a `ScaleRule` heading (Rewards `tone="primary"`,
  Performance, Governance, Stakers, Manage) over one `Card` panel. The child components render
  their content only; `index.tsx` provides the panels. At `lg` Rewards sits beside Performance and
  Governance beside Stakers (equal-height panels); below `lg` everything is one column in the same order.
- **Loading skeletons** (`DashboardSkeleton` in `index.tsx`) have the same silhouette, so the page does not jump.
- Phone (375px): no horizontal scroll; every action is at least 44px tall (`max-sm:h-11` on the `sm`
  buttons, `max-sm:min-h-11` on the Stakers / Unbonding tabs) except the copy icons next to
  addresses (24px). *Until 2026-10-10 the two tabs measured 34px at 375px, below the 44px this
  page promises; `validator-delegators` pins the class now.*

### Original intent (kept legible; superseded by the layout above)

> The two diagrams below are the **original intent**, not a description of the shipped
> page. The Quick Stats row and the Recent Transactions card were never built. Until
> 2026-10-10 the real page was a 5-column bento: Identity beside Performance, Pending Rewards
> beside Withdraw Address, Delegators beside Proposals, then Commands, each card stretched to
> the height of its row (which is why Withdraw Address, one line of content, filled a 3/5-wide box).

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
│ │ RUN A VALIDATOR FROM A CLIQ (Full width CTA)                      │  │
│ │ "Create a new validator controlled by a CLIQ. This sets up        │  │
│ │  a new validator; it does not convert an existing one."           │  │
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

The pieces below are the ones that exist. Two cards from the original spec (a separate
Quick Stats row and a Recent Transactions card) were never built; their content was folded
into the strip and the Performance section instead. **Since 2026-10-10 the section components
render their content only**: the panel (a `Card`) and the `ScaleRule` heading come from
`ValidatorDashboard/index.tsx`, so no section carries its own `// label` and title.

### 4.1 Jailed Alert and Validator Identity Strip
`JailedAlert.tsx` · `ValidatorIdentityCard.tsx` (a strip now, not a card)
**Strip content:**
- Validator moniker (h2)
- Status badge: Active (`success`), Unbonding (`warning`), Jailed (`destructive`), Inactive (outline)
- Commission rate
- Operator address and account address (truncated, each with a copy button)
- Explorer link, **icon-only** (`size="icon-sm"`, `aria-label="View validator in explorer"`, `title`
  "View in explorer", the same href; 44px on phones). With a text label it was 102px wide and
  wrapped to a second row at 1024px (the other parts take about 707px of a 792px row). Below 1024px
  the strip may wrap. *Until 2026-10-10 the link read "Explorer".*

**Jailed alert** (only while `validator.jailed`): a full-width `role="alert"` block at the very
top of the dashboard that says the validator is jailed and hosts the **Unjail validator** action
(`UnjailAction.tsx`: `Button variant="action" size="action"`, `w-full sm:w-auto`, a one-line
warning, and a status line in `text-destructive` (tombstoned) or `text-warning` (jail period
not over / signing info unreadable). See §6, Unjail. *Until 2026-10-10 the identity card was
a `Card` with `bracket="green"`, a "// Validator" label, tinted rows for commission and the two addresses, and a "View in
Explorer" button, and the jailed block (with Unjail) sat at the bottom of that card, in the
left 2/5 column; the jailed layout test pinned an `order-first` class on its grid slot.*

### 4.2 Rewards (`PendingRewardsCard.tsx`, with the withdraw address folded in)
**Section:** `ScaleRule label="Rewards" tone="primary"`: the one coral heading on the page.
**Content:**
- Two rows, each = kit icon, label, the amount (tabular figures, in the chain's primary denom)
  and its **own** Claim button on the right:
  - Validator commission: Claim (`MsgWithdrawValidatorCommission` alone, `claimCommission(false)`)
  - Self-delegation rewards: Claim (`MsgWithdrawDelegatorReward` alone, `claimRewards`)
- One primary **Claim all** under them (`claimCommission(true)`: `MsgWithdrawDelegatorReward` +
  `MsgWithdrawValidatorCommission`), shown only when both amounts exist.
- Each button keeps its exact `disabled` rule (read-only, a claim running, or nothing to claim) and
  its loading spinner. Labels depend on the mode (see §2): in CLIQ mode they read "Create: Claim"
  and "Create: Claim all", with an inline note "Actions will create a transaction for multisig signing".
- One primary per view: when only one amount exists that row's Claim is the coral button.
- Self-delegation rewards are only included when they are actually non-zero, so a jailed
  validator with no self-delegation sends the commission message alone.
- **The withdraw address, as one line** (`WithdrawAddressCard.tsx`, compact): "Paid to core1…asj6gw
  [copy] [Change]". The row already fills a half-width Rewards card (342px of 342px), so the fact
  "Same as operator account" / "Custom address" is not a second line any more: it is the "Paid
  to" label's `title` and a screen-reader-only phrase after the label (", same as operator
  account" or ", custom address"). For a custom address that is the only place the word
  "custom" appears: the address itself is on screen, so a sighted reader sees it directly. *Until 2026-10-10 it was a visible second line (`success` token for
  the operator account, muted for a custom address).* Change reveals the input and the submit
  (`MsgSetWithdrawAddress`); Cancel folds it back.

*Until 2026-10-10: a card "// Pending / Rewards & Commission" with two large amounts, then three
stacked full-width buttons (Claim All, Claim Commission Only, Claim Rewards Only), and a separate
full-height "// Distribution / Withdraw Address" card beside it (the owner's "distribution box huge
and unnecessary").*

### 4.3 Performance (`ValidatorPerformanceCard.tsx`)
**Section:** `ScaleRule label="Performance"`.
**Content:** three headline stats with kit icons (Voting Power `portfolio`, Ranking `rank`,
Stakers `stakers`), then one quiet list of the secondary figures: Total Stake, Self-Delegation,
Commission, and Min Self-Delegation when it is set above the chain default. No nested tiles.
Uptime percentage and missed-block counts were specified but are **not implemented**:
they need signing-info/slashing queries that the dashboard does not make for healthy
validators. (Since 2026-10-08 the dashboard does read signing info, but only while the
validator is jailed, to gate Unjail; it is not shown as uptime.)
*Until 2026-10-10: six bordered tiles in a 2- or 3-column grid inside a card. Until 2026-10-10
the third tile said "Delegators" while the section beside it said "Stakers"; one
word for the same people now. Chain terms in data rows ("Self-Delegation", "Min Self-Delegation")
stay.*

**A figure that could not be fetched is a dash, not a zero.** `ValidatorDashboardData` types
`delegatorsCount` as `number | null` and `votingPowerPercentage` as `string | null` (the same
contract as `delegations`: `null` = unavailable, a real `0` is a measurement). A `null` tile shows
an em dash (`aria-hidden`) with a screen-reader-only "unavailable" inside a `relative` span (so
the hidden word cannot escape a scroll box, see `CLAUDE.md` §3), and the ranking tile does the
same for a `null` ranking. **One number, one fetch:** the stakers count is the length of the
stakers list (`delegations === null ? null : delegations.length`), so the tile and the Stakers
section (§4.5) cannot disagree; the second full pagination that used to count them, and its
helper `getValidatorDelegatorsCount`, are gone. The two voting-power sentences in Governance
("Your validator represents X% of the network's voting power" and the vote dialog's "Your voting
power: X%") are not rendered when the share is `null`. Pinned by `validator-performance`,
`validator-proposals` and, for the real `getValidatorDashboardData` against a stubbed query
client, `validator-dashboard-data`. *Until 2026-10-10 a failed stakers fetch read "STAKERS 0
total" next to a Stakers section that said "unavailable right now", and a failed pool query read
"0%".*

### 4.4 Governance (`ProposalViewer.tsx`)
**Section:** `ScaleRule label="Governance"`.
Active proposals as before (a tile each, vote badge or NEEDS VOTE, **Vote Now** and **Details**).
Governance proposals are voted Yes / No / Abstain / No-with-veto (`MsgVote`); Yes uses the
`success` token, and the tally chips are semantic, not decorative. **Past proposals sit in a
drop-down, "Past proposals (latest N)", closed by default** (`components/ui/collapsible.tsx`); it
lists the latest 10 finished proposals, or says the history is unavailable. **N is honest:** the
label reads **"latest N" whenever N is 1 or more** (N = the rows shown, at most 10), "(0)" with the
text "No past proposals found." for none, and "(unavailable)" for `null`. The helper
(`getPastProposals`) reads the newest 20 proposals of any status and keeps the finished ones, so a
bare "(7)" could be less than the chain's real total while "latest 7" is always true. *(Until
2026-10-10 the label counted the rows shown and read "(10)" even when more existed; then it said
the real number up to 10 and "latest 10" only above that, so "(7)" could still understate.)*
**The opened list scrolls inside one box**
(`relative max-h-[260px] overflow-y-auto`, the same treatment as the stakers list), so Governance
grows by one box instead of ten rows; opened, it used to grow Governance from 384px to 966px and
drag the Stakers card to the same height, leaving about 580px of empty card (measured). Governance
and Stakers are **equal-height panels** side by side from `lg`, so opening the history still
leaves about 200px of empty space in the Stakers card (measured 199px on a real build); accepted,
because a second card that does not follow its neighbour's height would break the row. The vote dialog and
`submitVote` are unchanged, except that `submitVote` no longer blocks later votes after a
"connect your wallet first" toast (PR #81, 2026-10-10).
*Until 2026-10-10 the past proposals were always listed inline under the active ones.*

**A proposal shows its real title, and the list stays what it was.** The LIST of active proposals
drives the Vote Now buttons, so it is decided as on the main branch: `getActiveProposals` asks the
v1beta1 `gov.proposals` query first and uses the gov v1 REST list only when v1beta1 throws or
returns nothing (in that REST-list path only a proposal whose RAW status is
`PROPOSAL_STATUS_VOTING_PERIOD` is kept). gov v1 supplies **titles only**: when a listed proposal
has no usable title (`readProposalTitle` in `lib/validatorHelpers.ts` is the one rule, shared with
the viewer), REST is asked once and its title is copied onto the proposal with the same id. REST
may never add, remove or reorder a proposal when v1beta1 answered, and a proposal that already has
a title keeps it; when no REST endpoint answers the list stays and the title falls back.
Seen on the real page: proposal 47 on TX mainnet ("TX Chain Mainnet Upgrade v8.0.0", one
`MsgSoftwareUpgrade`) showed "Untitled Proposal", because the node's v1beta1 view of it has
`content` keys `@type, authority, plan` and no title (both views were read with curl against a
TX mainnet REST node on 2026-10-10); the title is only at `/cosmos/gov/v1/proposals/47`. The
proposal id, status and voting times are v1beta1's own either way. When no title can be had the
card says **"Proposal #47" once**: the small "Proposal #47" kicker above the heading is hidden
for a proposal with no title (the heading already reads it) and stays above a real title. It
never says "Untitled Proposal" (a claim; the proposal does have a title on chain). A title is
read from `content.title`, then from `content.value.title` (a decoded Any); a blank or non-text
one counts as none; both branches and their order are pinned in `validator-proposals`.
*Until 2026-10-10 the fallback text was "Untitled Proposal" and nothing fetched a title.* Why
gov v1 is not simply made the source of the list (it carries the title): a REST node that answers
`[]` would hide a proposal v1beta1 knows, and a REST host that ignores `proposal_status=2` could
put a finished proposal on the page with a Vote Now button (both shown with probes); the list
drives the vote buttons, so it must not get less reliable.
The vote flow is untouched: `submitVote`, `gasLimit` and the vote option table are byte for byte
what they were, the signing fence still prints `FENCE OK`, and `validator-vote-options` still pins
what each option sends. Not done (nothing showed it was needed): reading a title out of a v1
legacy-content message (`MsgExecLegacyContent`) when the proposal-level `title` is empty.

### 4.5 Stakers (`ValidatorDelegatorsCard.tsx`)
**Section:** `ScaleRule label="Stakers"`.
The summary line is the tab list: "645 stakers · 0 unbonding". The Stakers tab shows the top 5
(the data helper sorts by amount, largest first) and **Show all** opens the rest in a drop-down with
its own scroll (`max-h-[260px]`), **Show fewer** folds it back. The Unbonding tab keeps its total
and its table. *Until 2026-10-10: "Active Stakers (n)" and "Unbonding (n)" tabs over a 300px scroll
box of every staker.*

**A failed fetch is not "0 stakers".** `getValidatorDelegations` and
`getValidatorUnbondingDelegations` return `null` when the query fails and `[]` only when the
chain really answers with nothing, and `ValidatorDashboardData.delegations` /
`.unbondingDelegations` are typed `... | null` (the same contract as `pastProposals`). When the
stakers list is `null` the section says "Stakers unavailable right now. Use Refresh to try
again." and the tab reads just "Stakers", with no count; when the unbonding list is `null` the
tab reads "Unbonding" and its panel says "Unbonding unavailable right now. Use Refresh to try
again." One failing does not hide the other (a loaded part still shows). A real empty answer still
reads "0 stakers" and "No stakers yet". *Until 2026-10-10 both helpers caught every
error and returned `[]`; on one real load the Performance tile said 645 while this section said
"0 stakers · 0 unbonding / No active delegators found".* The Performance tile follows the same
contract (§4.3): its stakers count is the length of this list, `null` when the fetch failed.
*(This paragraph said "Not fixed here: `getValidatorDelegatorsCount`, which feeds the Performance
tile, still returns `0` when its query fails" until 2026-10-10; that second pagination and its
helper are gone.)*

### 4.6 Manage (`ValidatorCommandsCard.tsx`)
**Section:** `ScaleRule label="Manage"`.
**Content:**
- CLIQ mode only: four tiles that deep-link to the new-transaction page with a message
  type pre-selected: Delegate, Undelegate, Redelegate and "Claim delegation rewards"
  (`/[chainName]/<target>/transaction/new?type=<typeUrl>`). The last tile was labelled
  "Withdraw Rewards" until the 2026-10 flow cleanup. The Vote tile is gone: vote from the
  Governance section (§4.4).
- Direct mode: no tiles. A short note says those actions are proposed through a CLIQ.
- One "Edit validator" button (`w-full sm:w-auto`) that opens a dialog "Edit Validator Details"
  (moniker, identity, website, security contact, details, commission rate, min self-delegation)
  and submits `MsgEditValidator`

### 4.7 CLIQ Upgrade CTA Card
`CliqUpgradeCTA.tsx` · **Variant:** `institutional` with `bracket="purple"`
CTA into `/[chainName]/create`. Hidden in CLIQ mode (`!isCliqMode`): a CLIQ already has
the protection it advertises. Copy (2026-10-09): the card offers a *new* validator run by a CLIQ,
because on TX an existing validator's operator account and keys cannot change (verified at TX's
running tags; TX ecosystem hub note CLIQS-VALIDATOR-OPS §5.1). *(Until 2026-10-09 the card said
"Works With Existing Validator" and "Upgrade to a CLIQ".)* Unchanged by the 2026-10-10 layout.

### 4.8 Network control (`components/DevTools/NetworkToggle.tsx`)
Two small outlined boxes, Mainnet | Testnet, 36px tall (`h-9`; 44px on phones, `max-sm:h-11` on
both boxes, pinned by `network-toggle`), not a panel. The word
"Testnet" is always gold (the `warning` token). While testnet is active its box gets a gold
outline and a gold **TESTNET** badge shows beside the control, so it is obvious you are not on
main. While mainnet is active one short muted caption sits **on the same row** as the boxes and
never wraps: "Real assets. Check before you sign." (the old sentence, "Mainnet actions use real
assets. Verify all addresses and messages before signing.", is its `title` **and** screen-reader-only
text beside the short caption, which is itself `aria-hidden` so nothing is read twice: a `title`
alone does not reach a screen reader; the caption is `relative` so the `sr-only` sentence cannot
escape a scroll box, pinned by `network-toggle`). From 640px up the
row is `flex-nowrap`; on a phone the caption drops under the boxes. Props and `onNetworkChange`
are unchanged (Dev Tools uses the same component), and a chain with no testnet variant still
says so. *Until 2026-10-10 the sentence was a 22rem-wide line under the boxes that
wrapped to two lines, so the control measured 352x74px and set the height of the whole context
row.* Measured on a real build at 1024px (editing the live DOM, so INFERRED for the shipped
classes): with this caption the context row is 40px (the two-line "Acting as" sentence sets it);
with the longer example caption "Real assets. Check every address before you sign." it was 60px,
because the right side then took 571px of 792px and squeezed the sentence to three lines.
*Until 2026-10-10: a
bordered panel with a "Network Mode" header, a red/outline badge, two tabs and, on mainnet, a red
warning banner.* The gold-for-testnet choice is cliqs-specific, on the owner's words; the TOKNS
kit's own testnet marker is coral and is not changed.

---

## 5. Data Sources

### On-Chain Queries (CosmJS)
| Data | Query Method |
|------|--------------|
| Validator info | `staking.validator(operatorAddr)` |
| Commission | `distribution.validatorCommission(operatorAddr)` |
| Rewards | `distribution.delegationRewards(delegatorAddr, validatorAddr)` |
| Withdraw address | `distribution.delegatorWithdrawAddress(delegatorAddr)` |
| Stakers count | the length of the stakers list below (one fetch; `null` when it failed). *Until 2026-10-10 a second pagination of `staking.validatorDelegations` counted them.* |
| Voting power share | `staking.pool()` bonded tokens against the validator's tokens; `null` when the query fails |
| Stakers, unbonding stakers | `staking.validatorDelegations` / `validatorUnbondingDelegations` (paginated); `null` when the query fails, `[]` when the answer is empty (§4.5) |
| Active proposals | the `gov.proposals` v1beta1 query decides the list; gov v1 REST `GET /cosmos/gov/v1/proposals?proposal_status=2` is the list only when v1beta1 throws or returns nothing (voting-period status only), and otherwise supplies titles for listed proposals that have none (§4.4) |
| Past proposals | gov v1 REST, latest 20 in reverse, filtered to finished; `null` when no endpoint answers |
| Signing info (only while jailed) | `slashing.signingInfo(consAddress)`, with `consAddress` from `consensusPubkeyToAddress` (sha256 of the consensus pubkey) |

Signing info is queried **only for a jailed validator**, to gate the Unjail action
(`getValidatorSigningInfo`). It is not shown as uptime, so there are still no uptime or
missed-block figures in the UI. *(This paragraph said "`slashing.signingInfo(consAddress)`
is **not** queried" until 2026-10-08.)* `validatorToConsensusAddress` in
`lib/validatorHelpers.ts` is **not** the consensus address (it re-encodes the operator
bytes; the chain answers 404 for it) and has no callers.

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
| Claim all (commission + self-delegation rewards) | MsgWithdrawValidatorCommission + MsgWithdrawDelegatorReward | 1,200,000 |
| Claim (commission row) | MsgWithdrawValidatorCommission | 700,000 |
| Claim (self-delegation rewards row) | MsgWithdrawDelegatorReward | 600,000 |
| Set Withdraw Address | MsgSetWithdrawAddress | 200,000 |
| Edit Validator | MsgEditValidator | 600,000 |
| Vote (Proposal Viewer) | MsgVote | 200,000 |
| Unjail Validator (jailed alert) | MsgUnjail | 300,000 |

These are recomputed from `gasOfMsg` as it stands today. `WithdrawValidatorCommission`
was raised to 600,000 in an earlier PR, which is why the claim-all figure is 1,200,000
and not the 1,100,000 this document used to state.

**Unjail** (added 2026-10-08, after the testnet validator Tokns.fi was jailed and could
only be unjailed through Developer Tools → Import Transaction). `MsgUnjail` has codec,
amino and gas support (`lib/msg.ts`, `types/txMsg.ts`, `gasOfMsg` = 200,000, so
`gasOfTx` = 300,000). The dashboard now offers it in the jailed alert at the top of the page (until 2026-10-10: the jailed block at the bottom of the identity card):
- Shown only while `validator.jailed`. The dashboard reads the chain's signing info for the
  validator's consensus address (derived from its consensus pubkey, **not** from the
  operator address bytes) and disables the button when the validator is tombstoned (can
  never be unjailed) or `jailed_until` is still in the future (the time is shown).
- If the signing info cannot be read the button stays enabled with a notice, and the chain
  decides. A jailed validator with no signing record at all was never bonded; Cosmos SDK
  v0.53.8 (`x/slashing/keeper/unjail.go`) applies no tombstone or jail-time check to it, so
  it is treated as unrestricted (3 of 165 jailed validators on coreum-testnet-1 on 2026-10-08).
- CLIQ operator: `createCliqTransaction` and redirect to the signing page. Single wallet:
  signs and broadcasts with the connected wallet; this path must pass `makeAppRegistry()`
  to `SigningStargateClient` because cosmjs' default registry has no `MsgUnjail`.
- Not checked: the validator's self-delegation must still be at least its
  `min_self_delegation`, or the chain rejects the unjail.

*(This paragraph said "Not available in the UI: `MsgUnjail` ... A jailed validator cannot
unjail from this app" until 2026-10-08.)*

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
- Since 2026-10-10 each section is one `Card` (`variant="default"`, 1px border) under a
  `ScaleRule`; the header strip and the context row have no card. Until then every section was
  a `variant="institutional"` card with `accent="left"` or `bracket="green"`.
- `accent="left"` is a coral left rule: decorative, not "healthy"
- CLIQ CTA: `bracket="purple"` for visual distinction (unchanged)
- The `from-card to-muted/30` gradient is now the **default** on `Card`'s `default` and
  `institutional` variants; it is no longer applied per call site. Surfaces that set
  their own background opt out with `bg-none`.

### Buttons
House-style buttons since 2026-10-10 (see [Buttons PRD](BUTTONS-PRD.md)). Until then: primary actions
`variant="action"` `size="action"` (11px mono uppercase), secondary `action-outline`.
- The one primary per view is the coral `default` button ("Claim all"); strong actions that are
  not the primary use `variant="action"` (Edit validator, Unjail validator)
- Row actions: `variant="outline"` `size="sm"` (Claim, Change, Vote Now); chips are not used here
- CLIQ-mode actions keep `variant="action-bronze"` / `action-bronze-outline`, so
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

### Data that could not load (`null`) is not data that is empty (`[]`)
The page never turns a failed fetch into a zero or an empty-list claim. `pastProposals` (null =
"Proposal history unavailable"), `delegations` and `unbondingDelegations` (null = "unavailable
right now. Use Refresh to try again") follow one contract: **`null` = unavailable, `[]` = none**.
The two single figures follow it too: `delegatorsCount` and `votingPowerPercentage` are `null`
when their fetch failed (an em dash with a screen-reader "unavailable" in the Performance tile,
§4.3) and a real `0` still reads "0". A new list or figure on this page does the same, and a test
pins both answers.

### Jailed Validator Warning
Shipped as `JailedAlert.tsx` (§4.1), at the very top of the dashboard. The block below is the original intent.
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
- One list feeds both menus: `lib/navigation.ts`. "Validator" is in its main group, so it
  appears in the Sidebar (lg and up) and in the Header menu (below lg).
- The Sidebar rail auto-collapses to icons and expands on hover or keyboard focus as an
  **overlay**; the pin button (persisted via `lib/settingsStorage.ts` `sidebarPinned`)
  switches it to push mode.
- Below the `lg` breakpoint there is no rail at all — `components/Header.tsx` is the
  only navigation, and it now lists Validator.
- Home (`/[chainName]/dashboard`) has a "Validators" section that links here.
- The chain landing page (the old "Validator Tools" link and Validator tab) no longer
  exists; `/[chainName]` redirects to Home.

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
2. Add delegator count — done (`ValidatorDelegatorsCard`, plus a Stakers stat; "Delegators" until 2026-10-10)
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
          ├── index.tsx              # Dashboard: mode detection, the sections and their panels, the skeleton
          ├── JailedAlert.tsx        # Jailed alert at the very top, hosts UnjailAction
          ├── ValidatorIdentityCard.tsx   # The header strip (not a card)
          ├── PendingRewardsCard.tsx      # Rewards rows + Claim all
          ├── ValidatorPerformanceCard.tsx
          ├── ValidatorDelegatorsCard.tsx # Stakers: top 5 + Show all, Unbonding tab
          ├── ValidatorCommandsCard.tsx   # Manage
          ├── ProposalViewer.tsx          # Governance: active proposals + Past proposals drop-down
          ├── CliqUpgradeCTA.tsx
          ├── UnjailAction.tsx       # Unjail validator, hosted in JailedAlert (was the identity card's jailed block)
          └── WithdrawAddressCard.tsx     # The "Paid to" line, inside the Rewards panel

/components/ (the shared pieces the page uses)
  ├── DevTools/NetworkToggle.tsx     # The compact Mainnet | Testnet control
  ├── icons/kit.tsx                  # Kit icons used by the sections
  └── ui/scale-rule.tsx              # The section dividers

/lib/
  ├── validatorHelpers.ts            # Validator-specific queries and utils
  ├── validatorTx.ts                 # Tx assembly (gas via gasOfTx)
  ├── validatorEdit.ts               # MsgEditValidator helpers
  ├── validatorUnjail.ts             # getUnjailGate: pure show/disable rule for Unjail
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


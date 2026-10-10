# CLAUDE.md: cliqs (app.cliqs.io)

> **Cluster:** overview · **Tags:** agents, rules, audit-report, signing-fence, gates · **Related:** [README.md](README.md), [STYLE-GUIDE.md](docs/STYLE-GUIDE.md), [Security docs](docs/security/README.md), [Audit report data](content/audit-report.json)

Standing rules for any agent working in this repo. Written 2026-10-09 during the navigation and flow cleanup.

## 1. Keep the public audit report current

The app's **Audit & tests** page renders `content/audit-report.json`. After a change merges with tests or checks that
passed, append **one** entry at the top (newest first), set `updatedAt`, and refresh `testSuite` from a real
`npm run test:ci` run (numbers you measured, the commit they ran on). Corrections edit the entry in place and add
`(corrected YYYY-MM-DD)` to its summary; never delete entries. The rules (field lengths, statuses, proof links) are in
the owner's shared audit-report spec (AUDIT-REPORT-SPEC.md in the TX ecosystem hub, also used by tokns) and are enforced by
`__tests__/lib/audit-report.test.tsx`, so a bad edit fails CI.

The page is public. Never add open or unfixed security findings, remaining-advisory counts, secrets, keys, private
wallet addresses, or anything an attacker could use. `verified` needs at least one proof link; when in doubt use
`shipped` or leave it out.

## 2. Wallet and transaction signing are off-limits

Do not change signing code unless the owner explicitly asks for that change. This covers `lib/keplr.ts`,
`lib/multisigAmino.ts`, `lib/multisigDirect.ts`, `lib/signDocDebug.ts`, `lib/msg.ts`, `lib/tx/*`, `lib/rpc/*`,
`lib/contract/cw3-client.ts`, `lib/contract/cw4-client.ts`, `lib/validator{Unjail,Tx,Edit}.ts`, `lib/txMsgHelpers.ts`,
`lib/transactionJson.ts`, `lib/importedTransaction.ts`, `lib/api.ts`, `context/WalletContext/`,
`components/forms/TransactionSigning.tsx`, `components/forms/CreateTxForm/MsgForm/*`,
`components/dataViews/ProposalIntentView.tsx`, `types/{txMsg,signing,cosmjs-types}.ts`, the transaction, signature,
nonce and multisig-list API routes, and every handler that calls a wallet, signing or broadcast API (for example
`broadcastTx`, `addSignature`, `submitUnjail`, `handleDeploy`, `createTx`). UI work may move such a handler or the
card that hosts it, byte for byte, but never change it. Keep the provider order in `pages/_app.tsx`
(Chains > Wallet > PendingTransactions).

## 3. Traps measured here

- `components/forms/CreateTxForm` is the **live** create-transaction form. It was called `OldCreateTxForm` until
  2026-10-09; the hidden Ctrl+. alternative it was "old" relative to has been deleted.
- jest ignores every path containing `/.claude/` (`testPathIgnorePatterns`), so a git worktree under `.claude/` runs
  **0 tests**. Put worktrees outside the repo.
- The chain registry slug for TX is `tx`; any first path segment containing `coreum` is mapped to it.
- `sr-only` is `position: absolute`. A label inside an unpositioned control (the copy button has
  one) uses `<main>` as its containing block and escapes a scroll box's clip, so hundreds of them
  stretched the validator page from 1,939px to 29,805px (measured 2026-10-10). jsdom does no layout
  and cannot see this: after touching a scrolling list, `CopyButton` or any button with an `sr-only`
  child, measure `document.documentElement.scrollHeight` in a real browser. `CopyButton` is
  `relative` now and scroll boxes stay `relative` too (`docs/ui/PATTERNS-PRD.md` section 22).
- The signing fence (it prints `FENCE OK`) hashes the functions that sign. It does **not** see JSX
  wiring: which handler a button calls, with which arguments, and its `disabled` rule. Swapping
  the two Claim handlers left the fence green (measured 2026-10-10). Jest pins that wiring
  (`validator-rewards`, `validator-vote-options`, `validator-edit-submit`,
  `validator-withdraw-address`, `jailed-alert`, `unjail-action`, `validator-dashboard`): run those
  as well as the fence whenever a signing button moves or is restyled.

## 4. Gates before a pull request

`npx tsc --noEmit`, `npm run lint` (zero warnings), `npm run format:check`, `npm run test:ci`, `npm run build`
(CI copies `.env.sample` to `.env.local` first). UI changes follow `docs/STYLE-GUIDE.md` (canonical tokens) and
`docs/ui/*.md`: tokens only, no raw colours, no one-off components.

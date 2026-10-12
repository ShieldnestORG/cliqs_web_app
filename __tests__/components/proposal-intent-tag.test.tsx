/**
 * Proposal intent view: the "High impact" tag
 *
 * File: __tests__/components/proposal-intent-tag.test.tsx
 *
 * The status tag (components/ui/badge.tsx, docs/ui/CARDS-PRD.md §5) is mono 11px; a call site may
 * pass layout classes only, never a text size. ProposalIntentView's "High impact" tag carried
 * `text-xs` (12px) after round 2 because the file is under the signing fence; the owner OK'd the
 * one-class fix on 2026-10-11 ("e fix"). The view's logic is untouched.
 *
 * Priority: P2
 */

import { render, screen } from "@testing-library/react";
import ProposalIntentView from "@/components/dataViews/ProposalIntentView";

it('sets "High impact" in the status tag type, with no 12px override', () => {
  render(
    <ProposalIntentView
      msgs={[
        {
          typeUrl: "/cosmwasm.wasm.v1.MsgExecuteContract",
          value: { sender: "core1a", contract: "core1contract", msg: new Uint8Array(), funds: [] },
        },
      ]}
      fee={{ amount: [], gas: "200000" }}
      memo=""
      chainId="coreum-mainnet-1"
      accountNumber={1}
      sequence={0}
      onVerified={() => undefined}
    />,
  );

  const tag = screen.getByText("High impact");
  expect(tag).toHaveClass("text-destructive");
  expect(tag).not.toHaveClass("text-xs");
});

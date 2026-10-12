/**
 * Transaction list status tags
 *
 * File: __tests__/components/tx-status-tag.test.tsx
 *
 * Owner, 2026-10-11, on the plain coloured dots left on the transaction list after the round-2
 * status-tag change: "switch". Each row's state is now a status tag (components/ui/badge.tsx,
 * docs/ui/CARDS-PRD.md §5) with the mark the table there gives it, and no plain dot:
 *   - completed (broadcast)  -> success, `signal`
 *   - waiting for signatures -> warning, `half`  ("N/M signed")
 *   - cancelled              -> secondary, `ring`
 * The "(you signed)" note stays beside the tag, outside it.
 *
 * Priority: P2
 */

// jest.setup.js replaces ListMultisigTxs with a stub card; this file tests the real one.
jest.unmock("@/components/dataViews/ListMultisigTxs");

import { render, screen, within } from "@testing-library/react";
import { TransactionCard } from "@/components/dataViews/ListMultisigTxs";
import type { DbTransaction } from "@/graphql";

const WALLET = "core1signer";

function tx(over: Partial<DbTransaction> = {}): DbTransaction {
  return {
    id: "abc123-def",
    txHash: null,
    status: "pending",
    dataJSON: JSON.stringify({ msgs: [{ typeUrl: "/cosmos.bank.v1beta1.MsgSend", value: {} }] }),
    signatures: [],
    ...over,
  } as unknown as DbTransaction;
}

function renderCard(t: DbTransaction) {
  return render(
    <TransactionCard
      tx={t}
      multisigAddress="core1cliq"
      multisigThreshold={3}
      chainName="tx"
      walletAddress={WALLET}
    />,
  );
}

/** Every status tag the card renders for its state (the msg-type tags carry no mark). */
const stateTags = (root: HTMLElement) =>
  Array.from(root.querySelectorAll("[data-mark]")).map((m) => m.parentElement as HTMLElement);

describe("TransactionCard status tags: P2", () => {
  it("shows a completed transaction as a success tag with the signal mark", () => {
    const { container } = renderCard(tx({ txHash: "ABC", status: "broadcast" } as never));

    const tags = stateTags(container);
    expect(tags.length).toBeGreaterThan(0);
    for (const tag of tags) {
      expect(tag).toHaveTextContent("Completed");
      expect(tag).toHaveClass("text-success");
      expect(tag.querySelector("[data-mark]")).toHaveClass("status-mark-signal");
    }
  });

  it("shows a transaction waiting for signatures as a warning tag with the half mark", () => {
    const { container } = renderCard(
      tx({ signatures: [{ address: WALLET }, { address: "core1other" }] } as never),
    );

    const tags = stateTags(container);
    expect(tags.length).toBeGreaterThan(0);
    for (const tag of tags) {
      expect(tag).toHaveTextContent("2/3 signed");
      expect(tag).not.toHaveTextContent("you signed");
      expect(tag).toHaveClass("text-warning");
      expect(tag.querySelector("[data-mark]")).toHaveClass("status-mark-half");
    }
    // the note stays beside the tag
    expect(screen.getAllByText(/you signed/).length).toBeGreaterThan(0);
  });

  it("shows a cancelled transaction as a quiet tag with the ring mark", () => {
    const { container } = renderCard(tx({ status: "cancelled" } as never));

    const tags = stateTags(container);
    expect(tags.length).toBeGreaterThan(0);
    for (const tag of tags) {
      expect(tag).toHaveTextContent("Cancelled");
      expect(tag).toHaveClass("text-muted-foreground");
      expect(tag.querySelector("[data-mark]")).toHaveClass("status-mark-ring");
    }
  });

  it("has no plain coloured dot left", () => {
    const { container } = renderCard(tx());

    expect(container.querySelector("span.rounded-full")).toBeNull();
    expect(within(container).queryAllByText("", { selector: ".h-2.w-2" })).toHaveLength(0);
  });
});

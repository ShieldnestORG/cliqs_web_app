/**
 * CliqUpgradeCTA copy must not claim an existing validator can be moved into a CLIQ.
 * Verified 2026-10-09 at TX's running tags: a validator's operator account and keys cannot
 * change, so a CLIQ can only run a validator it creates (hub CLIQS-VALIDATOR-OPS.md §5.1).
 */
import { render, screen } from "@testing-library/react";
import CliqUpgradeCTA from "@/components/dataViews/ValidatorDashboard/CliqUpgradeCTA";

describe("CliqUpgradeCTA copy", () => {
  it("does not claim to work with an existing validator", () => {
    render(<CliqUpgradeCTA />);
    expect(screen.queryByText("Works With Existing Validator")).toBeNull();
    expect(screen.queryByText(/Upgrade to a CLIQ/)).toBeNull();
  });

  it("says it creates a new validator and does not convert an existing one", () => {
    render(<CliqUpgradeCTA />);
    expect(screen.getByText(/It does not convert an existing one\./)).toBeInTheDocument();
    expect(screen.getByText("Run a Validator From a CLIQ")).toBeInTheDocument();
  });
});

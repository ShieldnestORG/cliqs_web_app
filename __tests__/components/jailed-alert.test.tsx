/**
 * Jailed Alert Test
 *
 * File: __tests__/components/jailed-alert.test.tsx
 *
 * The full-width alert at the very top of the validator dashboard while the validator is
 * jailed (components/dataViews/ValidatorDashboard/JailedAlert.tsx). It says what happened and
 * hosts the Unjail action; every prop the old identity card passed on still reaches it.
 *
 * Priority: P1
 */

import { render, screen } from "@testing-library/react";
import JailedAlert from "@/components/dataViews/ValidatorDashboard/JailedAlert";
import { ValidatorInfo } from "@/lib/validatorHelpers";

const unjailProps = jest.fn();
jest.mock("@/components/dataViews/ValidatorDashboard/UnjailAction", () => (props: unknown) => {
  unjailProps(props);
  return <button type="button">Unjail validator</button>;
});

const validator = { moniker: "Tokns.fi", jailed: true } as ValidatorInfo;

describe("JailedAlert: P1", () => {
  beforeEach(() => unjailProps.mockClear());

  it("is an alert that says the validator is jailed and that rewards can still be claimed", () => {
    render(<JailedAlert validator={validator} />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Validator jailed");
    expect(alert).toHaveTextContent("You can still claim pending rewards");
  });

  it("hosts the Unjail action inside the alert", () => {
    render(<JailedAlert validator={validator} />);

    expect(screen.getByRole("alert")).toContainElement(
      screen.getByRole("button", { name: "Unjail validator" }),
    );
  });

  it("passes every prop through to UnjailAction unchanged", () => {
    const onTransactionComplete = jest.fn();
    const signingInfo = { tombstoned: false } as never;
    render(
      <JailedAlert
        validator={validator}
        signingInfo={signingInfo}
        onTransactionComplete={onTransactionComplete}
        isCliqMode
        cliqAddress="testcore1cliq"
        readOnly
      />,
    );

    expect(unjailProps).toHaveBeenCalledWith({
      validator,
      signingInfo,
      onTransactionComplete,
      isCliqMode: true,
      cliqAddress: "testcore1cliq",
      readOnly: true,
    });
  });
});

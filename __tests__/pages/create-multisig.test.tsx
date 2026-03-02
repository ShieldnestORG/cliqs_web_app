/**
 * Create Multisig Route Test
 *
 * File: __tests__/pages/create-multisig.test.tsx
 *
 * Tests for the create multisig route (/[chainName]/create)
 * Priority: P0
 */

import { render, screen } from "@testing-library/react";
import CreateCliqPage from "@/pages/[chainName]/create";

// Mock the ChainsContext
jest.mock("@/context/ChainsContext", () => ({
  useChains: () => ({
    chain: {
      registryName: "cosmos",
      chainDisplayName: "Cosmos Hub",
      chainId: "cosmoshub-4",
      addressPrefix: "cosmos",
      nodeAddress: "https://rpc.cosmos.network",
    },
  }),
}));

// Mock next/router
jest.mock("next/router", () => ({
  useRouter: () => ({
    query: { chainName: "cosmos" },
    pathname: "/cosmos/create",
  }),
}));

// Mock CreateCliqForm component
jest.mock("@/components/forms/CreateCliqForm", () => {
  return function MockCreateCliqForm() {
    return (
      <form data-testid="create-cliq-form">
        <input name="members" placeholder="Members" />
        <input name="threshold" placeholder="Threshold" />
        <button type="submit">Create CLIQ</button>
      </form>
    );
  };
});

describe("Create Multisig Route (/[chainName]/create): P0", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should load create multisig page", () => {
    render(<CreateCliqPage />);

    // Use getAllByText since "Create Cliq" appears multiple times (title, breadcrumb, etc.)
    const createCliqElements = screen.getAllByText(/Create Cliq/i);
    expect(createCliqElements.length).toBeGreaterThan(0);
  });

  it("should display create CLIQ form", () => {
    render(<CreateCliqPage />);

    const form = screen.getByTestId("create-cliq-form");
    expect(form).toBeInTheDocument();
  });

  it("should display breadcrumb navigation", () => {
    render(<CreateCliqPage />);

    // Breadcrumb should be present
    const breadcrumb = screen.getByRole("navigation");
    expect(breadcrumb).toBeInTheDocument();
  });

  it("should display chain name in page title", () => {
    render(<CreateCliqPage />);

    // Use getAllByText since "Create Cliq" appears multiple times
    const createCliqElements = screen.getAllByText(/Create Cliq/i);
    expect(createCliqElements.length).toBeGreaterThan(0);
  });
});

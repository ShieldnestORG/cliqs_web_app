/**
 * Create Multisig Route Test
 *
 * File: __tests__/pages/create-multisig.test.tsx
 *
 * Tests for the create multisig route (/[chainName]/create)
 * Priority: P0
 */

import { render, screen, within } from "@testing-library/react";
import CreateCliqPage from "@/pages/[chainName]/create";

let mockRegistryName = "cosmos";

// Mock the ChainsContext
jest.mock("@/context/ChainsContext", () => ({
  useChains: () => ({
    chain: {
      registryName: mockRegistryName,
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
    mockRegistryName = "cosmos";
  });

  it("should show a single H1 reading Create CLIQ", () => {
    render(<CreateCliqPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Create CLIQ" })).toBeInTheDocument();
    // Retired wording must not come back
    expect(screen.queryByText(/Create Cliq/)).not.toBeInTheDocument();
    expect(screen.queryByText("Create a CLIQ")).not.toBeInTheDocument();
  });

  it("should display create CLIQ form", () => {
    render(<CreateCliqPage />);

    const form = screen.getByTestId("create-cliq-form");
    expect(form).toBeInTheDocument();
  });

  it("should link the breadcrumb Home to the dashboard", () => {
    render(<CreateCliqPage />);

    const breadcrumb = screen.getByRole("navigation");
    const home = within(breadcrumb).getByText("Home");
    expect(home.closest("a")).toHaveAttribute("href", "/cosmos/dashboard");
    expect(within(breadcrumb).getByText("Create CLIQ")).toBeInTheDocument();
  });

  it("should fall back to the site root, not //dashboard, before the chain has loaded", () => {
    mockRegistryName = "";
    render(<CreateCliqPage />);

    const home = within(screen.getByRole("navigation")).getByText("Home");
    expect(home.closest("a")).toHaveAttribute("href", "/");
  });

  it("should offer the three types as cards", () => {
    render(<CreateCliqPage />);

    for (const name of ["PubKey", "Fixed", "Flex"]) {
      expect(screen.getByRole("heading", { level: 3, name })).toBeInTheDocument();
    }
  });

  it("should hide the card detail bullets below the sm breakpoint", () => {
    render(<CreateCliqPage />);

    const bulletLists = screen
      .getAllByRole("list", { hidden: true })
      .filter((list) => list.tagName === "UL");
    expect(bulletLists).toHaveLength(3);
    for (const list of bulletLists) {
      expect(list).toHaveClass("hidden", "sm:block");
    }
  });

  it("should use the responsive page gutter", () => {
    const { container } = render(<CreateCliqPage />);

    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveClass("px-4", "sm:px-6", "lg:px-[0.75in]");
    expect(root).not.toHaveClass("px-[0.75in]");
  });
});

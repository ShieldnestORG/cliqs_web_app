/**
 * Validator Page Test
 *
 * File: __tests__/pages/validator.test.tsx
 *
 * Tests for the validator page route (/[chainName]/validator)
 * Priority: P1
 */

import { render, screen, waitFor } from "@testing-library/react";
import ValidatorPage from "@/pages/[chainName]/validator";

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
    pathname: "/cosmos/validator",
  }),
}));

// Mock ValidatorDashboard component
jest.mock("@/components/dataViews/ValidatorDashboard", () => {
  return function MockValidatorDashboard() {
    return (
      <div data-testid="validator-dashboard">
        <h2>Validator Dashboard</h2>
        <p>Manage your validator operations</p>
      </div>
    );
  };
});

/** True when `a` comes before `b` in document order (no bitwise ops: the lint config bans them). */
const precedes = (a: Element, b: Element) => {
  const all = Array.from(document.body.querySelectorAll("*"));
  return all.indexOf(a) < all.indexOf(b);
};

describe("Validator Page Route (/[chainName]/validator): P1", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should load validator page", async () => {
    render(<ValidatorPage />);

    await waitFor(() => {
      const validatorElements = screen.getAllByText(/Validator Dashboard/i);
      expect(validatorElements.length).toBeGreaterThan(0);
    });
  });

  it("should display validator dashboard component", async () => {
    render(<ValidatorPage />);

    await waitFor(() => {
      const dashboard = screen.getByTestId("validator-dashboard");
      expect(dashboard).toBeInTheDocument();
      expect(screen.getByText(/Manage your validator operations/i)).toBeInTheDocument();
    });
  });

  it("should display breadcrumb navigation", async () => {
    render(<ValidatorPage />);

    await waitFor(() => {
      // Home might be in a link, check for breadcrumb or validator text
      const breadcrumb = screen.queryByTestId("breadcrumb");
      const homeLinks = screen.queryAllByRole("link", { name: /home/i });
      const validatorElements = screen.getAllByText(/Validator Dashboard/i);
      expect((breadcrumb || homeLinks.length > 0) && validatorElements.length > 0).toBe(true);
    });
  });

  it("roots the breadcrumb at Home -> /{chain}/dashboard", () => {
    render(<ValidatorPage />);

    const home = screen.getByRole("link", { name: "Home" });
    expect(home).toHaveAttribute("href", "/cosmos/dashboard");
  });

  it("renders the page H1 before the dashboard content", () => {
    render(<ValidatorPage />);

    const h1 = screen.getByRole("heading", { level: 1, name: "Validator Dashboard" });
    const dashboard = screen.getByTestId("validator-dashboard");
    expect(precedes(h1, dashboard)).toBe(true);
  });

  it("uses the responsive page gutter, not the fixed 0.75in one", () => {
    const { container } = render(<ValidatorPage />);

    const root = container.firstElementChild as HTMLElement;
    for (const cls of ["px-4", "sm:px-6", "lg:px-[0.75in]"]) {
      expect(root.className.split(/\s+/)).toContain(cls);
    }
    expect(root.className).not.toMatch(/(^|\s)px-\[0\.75in\]/);
  });
});

/**
 * Dashboard Route Test
 * 
 * File: __tests__/pages/dashboard.test.tsx
 * 
 * Tests for the dashboard route (/[chainName]/dashboard)
 * Priority: P0
 */

import { render, screen, waitFor } from '@testing-library/react';
import DashboardPage from '@/pages/[chainName]/dashboard';

// Mock the ChainsContext
jest.mock('@/context/ChainsContext', () => ({
  useChains: () => ({
    chain: {
      registryName: 'cosmos',
      chainDisplayName: 'Cosmos Hub',
      chainId: 'cosmoshub-4',
      addressPrefix: 'cosmos',
      nodeAddress: 'https://rpc.cosmos.network',
    },
  }),
}));

// Mock next/router
jest.mock('next/router', () => ({
  useRouter: () => ({
    query: { chainName: 'cosmos', tab: 'overview' },
    pathname: '/cosmos/dashboard',
    push: jest.fn(),
  }),
}));

// Mock ListUserCliqs component
jest.mock('@/components/dataViews/ListUserCliqs', () => {
  return function MockListUserCliqs() {
    return <div data-testid="list-user-cliqs">My CLIQS</div>;
  };
});

// Mock FindMultisigForm component
jest.mock('@/components/forms/FindMultisigForm', () => {
  return function MockFindMultisigForm() {
    return <div data-testid="find-multisig-form">Find Multisig Form</div>;
  };
});

describe('Dashboard Route (/[chainName]/dashboard): P0', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should load dashboard successfully', async () => {
    render(<DashboardPage />);
    
    await waitFor(() => {
      // Dashboard text appears multiple times, use getAllByText
      const dashboardElements = screen.getAllByText(/Dashboard/i);
      expect(dashboardElements.length).toBeGreaterThan(0);
    });
  });

  it('should display chain name in dashboard title', async () => {
    render(<DashboardPage />);
    
    await waitFor(() => {
      expect(screen.getByText(/Cosmos Hub.*Dashboard/i)).toBeInTheDocument();
    });
  });

  it('should display quick stats', async () => {
    render(<DashboardPage />);
    
    await waitFor(() => {
      // These texts might appear multiple times, use getAllByText
      const networkElements = screen.getAllByText(/Network/i);
      const chainIdElements = screen.getAllByText(/Chain ID/i);
      const statusElements = screen.getAllByText(/Status/i);
      expect(networkElements.length).toBeGreaterThan(0);
      expect(chainIdElements.length).toBeGreaterThan(0);
      expect(statusElements.length).toBeGreaterThan(0);
    });
  });

  it('should display overview tab by default', async () => {
    render(<DashboardPage />);
    
    await waitFor(() => {
      expect(screen.getByText(/Quick Actions/i)).toBeInTheDocument();
    });
  });

  it('should display tabs for navigation', async () => {
    render(<DashboardPage />);
    
    await waitFor(() => {
      // Check for tab buttons - they might be rendered as buttons or in tab list
      const overviewTab = screen.queryByRole('tab', { name: /overview/i }) || 
                         screen.queryByText(/Overview/i);
      const cliqsTab = screen.queryByRole('tab', { name: /cliqs/i }) || 
                       screen.queryByText(/My CLIQS/i) ||
                       screen.queryByText(/CLIQS/i);
      const findTab = screen.queryByRole('tab', { name: /find/i }) || 
                      screen.queryByText(/Find/i);
      const activityTab = screen.queryByRole('tab', { name: /activity/i }) || 
                         screen.queryByText(/Activity/i);
      
      expect(overviewTab || cliqsTab || findTab || activityTab).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('should display create CLIQ button', async () => {
    render(<DashboardPage />);
    
    await waitFor(() => {
      const createButton = screen.getByText(/New CLIQ/i);
      expect(createButton).toBeInTheDocument();
    });
  });
});

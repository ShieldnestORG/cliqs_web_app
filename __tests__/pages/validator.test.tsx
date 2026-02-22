/**
 * Validator Page Test
 * 
 * File: __tests__/pages/validator.test.tsx
 * 
 * Tests for the validator page route (/[chainName]/validator)
 * Priority: P1
 */

import { render, screen, waitFor } from '@testing-library/react';
import ValidatorPage from '@/pages/[chainName]/validator';

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
    query: { chainName: 'cosmos' },
    pathname: '/cosmos/validator',
  }),
}));

// Mock ValidatorDashboard component
jest.mock('@/components/dataViews/ValidatorDashboard', () => {
  return function MockValidatorDashboard() {
    return (
      <div data-testid="validator-dashboard">
        <h2>Validator Dashboard</h2>
        <p>Manage your validator operations</p>
      </div>
    );
  };
});

describe('Validator Page Route (/[chainName]/validator): P1', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should load validator page', async () => {
    render(<ValidatorPage />);
    
    await waitFor(() => {
      const validatorElements = screen.getAllByText(/Validator Dashboard/i);
      expect(validatorElements.length).toBeGreaterThan(0);
    });
  });

  it('should display validator dashboard component', async () => {
    render(<ValidatorPage />);
    
    await waitFor(() => {
      const dashboard = screen.getByTestId('validator-dashboard');
      expect(dashboard).toBeInTheDocument();
      expect(screen.getByText(/Manage your validator operations/i)).toBeInTheDocument();
    });
  });

  it('should display breadcrumb navigation', async () => {
    render(<ValidatorPage />);
    
    await waitFor(() => {
      // Home might be in a link, check for breadcrumb or validator text
      const breadcrumb = screen.queryByTestId('breadcrumb');
      const homeLinks = screen.queryAllByRole('link', { name: /home/i });
      const validatorElements = screen.getAllByText(/Validator Dashboard/i);
      expect((breadcrumb || homeLinks.length > 0) && validatorElements.length > 0).toBe(true);
    });
  });
});

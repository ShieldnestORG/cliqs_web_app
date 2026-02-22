/**
 * Chain Selection Route Test
 * 
 * File: __tests__/pages/chain-selection.test.tsx
 * 
 * Tests for the chain selection route (/[chainName])
 * Priority: P0
 */

import { render, screen, waitFor } from '@testing-library/react';
import ChainIndexPage from '@/pages/[chainName]/index';

// Mock the ChainsContext
const mockSetChain = jest.fn();
jest.mock('@/context/ChainsContext', () => ({
  useChains: () => ({
    chain: {
      registryName: 'cosmos',
      chainDisplayName: 'Cosmos Hub',
      chainId: 'cosmoshub-4',
      addressPrefix: 'cosmos',
      nodeAddress: 'https://rpc.cosmos.network',
    },
    setChain: mockSetChain,
  }),
}));

// Mock next/router
jest.mock('next/router', () => ({
  useRouter: () => ({
    query: { chainName: 'cosmos' },
    pathname: '/cosmos',
    push: jest.fn(),
  }),
}));

describe('Chain Selection Route (/[chainName]): P0', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should load chain selection page', async () => {
    render(<ChainIndexPage />);
    
    // Check for chain-specific content - the page shows chain name in multiple places
    await waitFor(() => {
      const chainNameElements = screen.getAllByText(/Cosmos/i);
      expect(chainNameElements.length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });

  it('should display chain information', async () => {
    render(<ChainIndexPage />);
    
    // Verify chain details are displayed - check for network label or chain name
    await waitFor(() => {
      const networkElements = screen.queryAllByText(/Network/i);
      const cosmosElements = screen.getAllByText(/Cosmos/i);
      expect(networkElements.length > 0 || cosmosElements.length > 0).toBe(true);
    }, { timeout: 3000 });
  });

  it('should allow navigation to create CLIQ', async () => {
    render(<ChainIndexPage />);
    
    // Check for create CLIQ button/link - look for button text or link
    await waitFor(() => {
      const createLinks = screen.queryAllByRole('link', { name: /create/i });
      const createButtons = screen.queryAllByRole('button', { name: /create/i });
      const createTexts = screen.getAllByText(/Create/i);
      expect(createLinks.length > 0 || createButtons.length > 0 || createTexts.length > 0).toBe(true);
    }, { timeout: 3000 });
  });
});

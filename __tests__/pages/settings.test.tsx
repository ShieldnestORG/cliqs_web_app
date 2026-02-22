/**
 * Settings Page Test
 * 
 * File: __tests__/pages/settings.test.tsx
 * 
 * Tests for the settings page route (/[chainName]/settings)
 * Priority: P1
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import SettingsPage from '@/pages/[chainName]/settings';
import { getUserSettings, updateUserSettings } from '@/lib/settingsStorage';

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
    pathname: '/cosmos/settings',
  }),
}));

// Mock settings storage
jest.mock('@/lib/settingsStorage', () => ({
  getUserSettings: jest.fn().mockReturnValue({
    requireWalletSignInForCliqs: false,
  }),
  updateUserSettings: jest.fn(),
}));

// Note: @/lib/utils is not mocked - cn function needs to work
// toastError and toastSuccess use sonner which is mocked in jest.setup.js

describe('Settings Page Route (/[chainName]/settings): P1', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should load settings page', async () => {
    render(<SettingsPage />);
    
    await waitFor(() => {
      const settingsElements = screen.getAllByText(/Settings/i);
      expect(settingsElements.length).toBeGreaterThan(0);
    });
  });

  it('should display security settings section', async () => {
    render(<SettingsPage />);
    
    await waitFor(() => {
      const securityElements = screen.getAllByText(/Additional Security/i);
      const requireSignInElements = screen.getAllByText(/Require Wallet Sign-In for Cliqs/i);
      expect(securityElements.length).toBeGreaterThan(0);
      expect(requireSignInElements.length).toBeGreaterThan(0);
    });
  });

  it('should toggle require wallet sign-in setting', async () => {
    render(<SettingsPage />);
    
    await waitFor(() => {
      const toggle = screen.getByRole('switch', { name: /Require Wallet Sign-In/i });
      expect(toggle).toBeInTheDocument();
      
      fireEvent.click(toggle);
      
      expect(updateUserSettings).toHaveBeenCalledWith({
        requireWalletSignInForCliqs: true,
      });
    });
  });

  it('should load saved settings on mount', async () => {
    (getUserSettings as jest.Mock).mockReturnValue({
      requireWalletSignInForCliqs: true,
    });

    render(<SettingsPage />);
    
    await waitFor(() => {
      const toggle = screen.getByRole('switch', { name: /Require Wallet Sign-In/i });
      expect(toggle).toBeChecked();
    });
  });
});

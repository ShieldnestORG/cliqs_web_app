/**
 * Jest Setup File
 * 
 * File: jest.setup.js
 * 
 * Global test configuration and mocks for the Cosmos Multisig UI test suite.
 */

import '@testing-library/jest-dom';
import { jest } from '@jest/globals';
import React from 'react';

// Polyfill TextEncoder/TextDecoder for Node.js environment
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

// Also set on window for browser-like environment
if (typeof window !== 'undefined') {
  if (typeof window.TextEncoder === 'undefined') {
    const { TextEncoder, TextDecoder } = require('util');
    window.TextEncoder = TextEncoder;
    window.TextDecoder = TextDecoder;
  }
}

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter: () => ({
    route: '/',
    pathname: '/',
    query: {},
    asPath: '/',
    push: jest.fn(),
    replace: jest.fn(),
    reload: jest.fn(),
    back: jest.fn(),
    prefetch: jest.fn().mockResolvedValue(undefined),
    beforePopState: jest.fn(),
    events: {
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
    },
    isReady: true,
  }),
}));

// Mock Next.js Link component - handle asChild prop to prevent nested <a> tags
jest.mock('next/link', () => {
  return ({ children, href, asChild }) => {
    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children, { href });
    }
    return React.createElement('a', { href }, children);
  };
});

// Mock Next.js Image component
jest.mock('next/image', () => {
  return ({ src, alt, ...props }) => {
    return React.createElement('img', { src, alt, ...props });
  };
});

// Mock WalletContext
jest.mock('@/context/WalletContext', () => ({
  useWallet: () => ({
    walletInfo: null,
    isConnecting: false,
    loading: {},
    verificationSignature: null,
    isVerified: false,
    isVerifying: false,
    ledgerSigner: null,
    connectKeplr: jest.fn(),
    connectLedger: jest.fn(),
    disconnect: jest.fn(),
    verify: jest.fn().mockResolvedValue(null),
    getAminoSigner: jest.fn().mockResolvedValue(null),
    getDirectSigner: jest.fn().mockResolvedValue(null),
  }),
  WalletProvider: ({ children }) => children,
}));

// Mock ChainsContext with all exports
jest.mock('@/context/ChainsContext', () => ({
  useChains: () => ({
    chain: {
      registryName: 'cosmos',
      chainDisplayName: 'Cosmos Hub',
      chainId: 'cosmoshub-4',
      addressPrefix: 'cosmos',
      nodeAddress: 'https://rpc.cosmos.network',
      nodeAddresses: ['https://rpc.cosmos.network'],
      assets: [],
      gasPrice: '0.025uatom',
    },
    chains: {
      mainnets: new Map(),
      testnets: new Map(),
      localnets: new Map(),
    },
    setChain: jest.fn(),
    newConnection: { action: 'edit' },
    validatorState: { validators: { bonded: [], unbonded: [], unbonding: [] }, status: 'initial' },
  }),
  ChainsProvider: ({ children }) => children,
  isChainInfoFilled: () => true,
}));

// Mock ChainsContext helpers
jest.mock('@/context/ChainsContext/helpers', () => ({
  isChainInfoFilled: () => true,
  emptyChain: {},
  setChain: jest.fn(),
  setChains: jest.fn(),
  setChainsError: jest.fn(),
}));

// Mock Keplr wallet
global.window = global.window || {};
global.window.keplr = {
  enable: jest.fn().mockResolvedValue(true),
  getKey: jest.fn().mockResolvedValue({
    name: 'test-wallet',
    algo: 'secp256k1',
    pubKey: new Uint8Array([1, 2, 3, 4]),
    address: 'cosmos1test',
    bech32Address: 'cosmos1test',
  }),
  signAmino: jest.fn().mockResolvedValue({
    signed: {},
    signature: {
      pub_key: {
        type: 'tendermint/PubKeySecp256k1',
        value: 'test',
      },
      signature: 'test-signature',
    },
  }),
  signDirect: jest.fn().mockResolvedValue({
    signed: {},
    signature: {
      pub_key: {
        type: 'tendermint/PubKeySecp256k1',
        value: 'test',
      },
      signature: new Uint8Array([1, 2, 3]),
    },
  }),
  getOfflineSigner: jest.fn(),
  getOfflineSignerOnlyAmino: jest.fn(),
  getOfflineSignerAuto: jest.fn(),
  experimentalSuggestChain: jest.fn().mockResolvedValue(true),
};

// Mock Ledger transport
jest.mock('@ledgerhq/hw-transport-webusb', () => ({
  default: {
    create: jest.fn().mockResolvedValue({
      send: jest.fn(),
      close: jest.fn(),
    }),
    isSupported: jest.fn().mockResolvedValue(true),
    list: jest.fn().mockResolvedValue([]),
    listen: jest.fn(),
    open: jest.fn(),
  },
}));

// Mock @cosmjs/stargate
jest.mock('@cosmjs/stargate', () => ({
  StargateClient: {
    connect: jest.fn().mockResolvedValue({
      getAccount: jest.fn().mockResolvedValue({
        address: 'cosmos1test',
        accountNumber: 1,
        sequence: 0,
      }),
      getBalance: jest.fn().mockResolvedValue({ denom: 'uatom', amount: '1000000' }),
      getAllBalances: jest.fn().mockResolvedValue([]),
      disconnect: jest.fn(),
    }),
  },
  makeMultisignedTxBytes: jest.fn(),
}));

// Mock @cosmjs/amino
jest.mock('@cosmjs/amino', () => ({
  pubkeyToAddress: jest.fn().mockReturnValue('cosmos1test'),
  MultisigThresholdPubkey: {},
  makeCosmoshubPath: jest.fn().mockReturnValue([44, 118, 0, 0, 0]),
  decodeSignature: jest.fn().mockReturnValue({
    pubkey: new Uint8Array([1, 2, 3]),
  }),
  isMultisigThresholdPubkey: jest.fn().mockReturnValue(false),
  isSecp256k1Pubkey: jest.fn().mockReturnValue(true),
}));

// Mock @cosmjs/encoding
jest.mock('@cosmjs/encoding', () => ({
  fromBase64: jest.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
  toBase64: jest.fn().mockReturnValue('AQID'),
  fromHex: jest.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
  toHex: jest.fn().mockReturnValue('010203'),
  Bech32: jest.fn().mockImplementation(() => ({
    encode: jest.fn().mockReturnValue('cosmos1test'),
    decode: jest.fn().mockReturnValue({ prefix: 'cosmos', data: new Uint8Array([1, 2, 3]) }),
  })),
}));

// Mock @cosmjs/proto-signing to avoid TextEncoder issues
jest.mock('@cosmjs/proto-signing', () => ({
  DirectSecp256k1HdWallet: {
    fromMnemonic: jest.fn(),
  },
  makeAuthInfoBytes: jest.fn(),
  makeSignBytes: jest.fn(),
}));

// Mock @cosmjs/utils
jest.mock('@cosmjs/utils', () => ({
  assert: jest.fn((condition, message) => {
    if (!condition) throw new Error(message || 'Assertion failed');
  }),
  sleep: jest.fn().mockResolvedValue(undefined),
}));

// Mock lib/multisigDirect to avoid TextEncoder issues
jest.mock('@/lib/multisigDirect', () => ({
  makeMultisignedTxBytesDirect: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
  shouldUseDirectMode: jest.fn().mockReturnValue(false),
}));

// Mock GraphQL client
jest.mock('graphql-request', () => ({
  GraphQLClient: jest.fn().mockImplementation(() => ({
    request: jest.fn().mockResolvedValue({}),
  })),
}));

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn().mockReturnValue({
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
          order: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
      insert: jest.fn().mockResolvedValue({ data: null, error: null }),
      update: jest.fn().mockResolvedValue({ data: null, error: null }),
      delete: jest.fn().mockResolvedValue({ data: null, error: null }),
    }),
  }),
}));

// Mock sonner toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warning: jest.fn(),
  },
  Toaster: () => null,
}));

// Mock copy-to-clipboard
jest.mock('copy-to-clipboard', () => jest.fn().mockReturnValue(true));

// Mock lucide-react icons
jest.mock('lucide-react', () => {
  const icons = {};
  return new Proxy(icons, {
    get: (_, name) => {
      return (props) => React.createElement('span', { 'data-testid': `icon-${name}`, ...props });
    },
  });
});

// Mock common layout components
jest.mock('@/components/layout/DashboardLayout', () => ({
  __esModule: true,
  default: ({ children, title }) => React.createElement('div', { 'data-testid': 'dashboard-layout' }, title, children),
  DashboardSection: ({ children, title }) => React.createElement('div', { 'data-testid': 'dashboard-section' }, title, children),
  QuickStat: ({ label, value }) => React.createElement('div', { 'data-testid': 'quick-stat' }, label, value),
  QuickStatsRow: ({ children }) => React.createElement('div', { 'data-testid': 'quick-stats-row' }, children),
}));

jest.mock('@/components/layout/Page', () => ({
  __esModule: true,
  default: ({ children }) => React.createElement('div', { 'data-testid': 'page-layout' }, children),
}));

jest.mock('@/components/layout/StackableContainer', () => ({
  __esModule: true,
  default: ({ children }) => React.createElement('div', { 'data-testid': 'stackable-container' }, children),
}));

// Mock UI components that might cause issues
jest.mock('@/components/ui/bento-grid', () => ({
  BentoGrid: ({ children }) => React.createElement('div', { 'data-testid': 'bento-grid' }, children),
  BentoCard: ({ children }) => React.createElement('div', { 'data-testid': 'bento-card' }, children),
  BentoActionCard: ({ children, title, onClick }) => React.createElement('div', { 'data-testid': 'bento-action-card', onClick }, title, children),
  BentoCardHeader: ({ children }) => React.createElement('div', { 'data-testid': 'bento-card-header' }, children),
  BentoCardTitle: ({ children }) => React.createElement('div', { 'data-testid': 'bento-card-title' }, children),
  BentoCardContent: ({ children }) => React.createElement('div', { 'data-testid': 'bento-card-content' }, children),
  BentoCardFooter: ({ children }) => React.createElement('div', { 'data-testid': 'bento-card-footer' }, children),
}));

jest.mock('@/components/ui/breadcrumb', () => ({
  Breadcrumb: ({ children }) => React.createElement('nav', { 'data-testid': 'breadcrumb' }, children),
  BreadcrumbList: ({ children }) => React.createElement('ol', {}, children),
  BreadcrumbItem: ({ children }) => React.createElement('li', {}, children),
  BreadcrumbLink: ({ children, asChild }) => React.createElement('a', {}, children),
  BreadcrumbPage: ({ children }) => React.createElement('span', {}, children),
  BreadcrumbSeparator: () => React.createElement('span', {}, '/'),
}));

jest.mock('@/components/head', () => ({
  __esModule: true,
  default: ({ title }) => React.createElement('title', {}, title),
}));

// Don't mock clsx or tailwind-merge - let them work normally
// Mock utils but keep cn function working
// Don't mock @/lib/utils - let it work normally
// Instead, mock sonner toast which is what toastError and toastSuccess use
// The cn function will work naturally since clsx and tailwind-merge are real dependencies

jest.mock('@/lib/settingsStorage', () => ({
  getUserSettings: jest.fn().mockReturnValue({
    requireWalletSignInForCliqs: false,
  }),
  updateUserSettings: jest.fn(),
}));

// Mock common form components
jest.mock('@/components/forms/FindMultisigForm', () => ({
  __esModule: true,
  default: () => React.createElement('div', { 'data-testid': 'find-multisig-form' }, 'Find Multisig Form'),
}));

jest.mock('@/components/forms/CreateCliqForm', () => ({
  __esModule: true,
  default: () => React.createElement('form', { 'data-testid': 'create-cliq-form' }, 'Create CLIQ Form'),
}));

jest.mock('@/components/forms/CreateTxForm', () => ({
  __esModule: true,
  default: () => React.createElement('form', { 'data-testid': 'create-tx-form' }, 'Create Transaction Form'),
}));

// Mock common data view components
jest.mock('@/components/dataViews/ListUserCliqs', () => ({
  __esModule: true,
  default: () => React.createElement('div', { 'data-testid': 'list-user-cliqs' }, 'My CLIQS'),
}));

jest.mock('@/components/dataViews/AccountView', () => ({
  __esModule: true,
  default: () => React.createElement('div', { 'data-testid': 'account-view' }, 'Account View'),
}));

jest.mock('@/components/dataViews/ValidatorDashboard', () => ({
  __esModule: true,
  default: () => React.createElement('div', { 'data-testid': 'validator-dashboard' }, 'Validator Dashboard'),
}));

jest.mock('@/components/dataViews/BalancesTable', () => ({
  __esModule: true,
  default: () => React.createElement('div', { 'data-testid': 'balances-table' }, 'Balances'),
}));

jest.mock('@/components/dataViews/ListMultisigTxs', () => ({
  __esModule: true,
  default: () => React.createElement('div', { 'data-testid': 'multisig-txs' }, 'Transactions'),
}));

// Suppress console errors/warnings in tests (comment out to debug)
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
  console.error = (...args) => {
    if (
      args[0]?.includes?.('Warning:') ||
      args[0]?.includes?.('act(') ||
      args[0]?.includes?.('ReactDOMTestUtils.act')
    ) {
      return;
    }
    originalError.apply(console, args);
  };
  console.warn = (...args) => {
    if (args[0]?.includes?.('Warning:')) {
      return;
    }
    originalWarn.apply(console, args);
  };
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});

// Setup test environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.NEXT_PUBLIC_GRAPHQL_URL = 'https://test.graphql.co';

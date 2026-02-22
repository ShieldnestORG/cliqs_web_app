/**
 * Test Helper Functions
 * 
 * File: __tests__/helpers.ts
 * 
 * Utility functions for testing API routes and components
 */

import React from 'react';
import { render, RenderOptions } from '@testing-library/react';

/**
 * Safely parse response data from node-mocks-http
 * Handles both string and object responses
 */
export function parseResponseData(data: any): any {
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch {
      return data;
    }
  }
  return data;
}

/**
 * Providers for testing
 * Can be extended with additional providers as needed
 */
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return React.createElement(React.Fragment, null, children);
};

/**
 * Custom render function with providers
 * Use this instead of the default render from @testing-library/react
 * if you need to wrap components with providers
 */
export const customRender = (
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options });

// Re-export everything from @testing-library/react
export * from '@testing-library/react';

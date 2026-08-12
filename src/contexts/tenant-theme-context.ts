/**
 * TenantThemeContext and its hook.
 *
 * Separate from the provider component so the provider file exports nothing but
 * a component. React Fast Refresh can only preserve state across an edit when a
 * module's exports are all components, so mixing the hook in here used to break
 * hot reload for every consumer.
 */

import { createContext, useContext } from 'react';

export interface TenantThemeContextType {
  primaryColor: string;
  accentColor: string;
  logo?: string;
  favicon?: string;
  tenantName: string;
  applyTheme: () => void;
  isLoading: boolean;
}

export const TenantThemeContext = createContext<TenantThemeContextType | undefined>(undefined);

export function useTenantTheme() {
  const context = useContext(TenantThemeContext);
  if (context === undefined) {
    throw new Error('useTenantTheme must be used within a TenantThemeProvider');
  }
  return context;
}

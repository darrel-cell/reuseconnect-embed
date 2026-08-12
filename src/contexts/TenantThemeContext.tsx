// Tenant Theme Context - Single Brand Platform
import { useEffect, ReactNode } from 'react';
import { TenantThemeContext, type TenantThemeContextType } from './tenant-theme-context';



// Single brand configuration - Reuse Connect ITAD Platform
const DEFAULT_THEME = {
  primaryColor: '168, 70%, 35%',
  accentColor: '168, 60%, 45%',
  logo: '/logo.avif',
  favicon: '/favicon.avif',
  tenantName: 'Reuse Connect ITAD Platform',
};

export function TenantThemeProvider({ children }: { children: ReactNode }) {
  // Apply default theme on mount
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--primary', DEFAULT_THEME.primaryColor);
    root.style.setProperty('--accent', DEFAULT_THEME.accentColor);
    
    // Set default favicon
    const updateFavicon = () => {
      const existingLinks = document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]');
      existingLinks.forEach(link => link.remove());
      
      const link = document.createElement('link');
      link.rel = 'icon';
      link.type = 'image/avif';
      link.href = DEFAULT_THEME.favicon;
      document.head.appendChild(link);
    };
    
    updateFavicon();
  }, []);

  return (
    <TenantThemeContext.Provider
      value={{
        primaryColor: DEFAULT_THEME.primaryColor,
        accentColor: DEFAULT_THEME.accentColor,
        logo: DEFAULT_THEME.logo,
        favicon: DEFAULT_THEME.favicon,
        tenantName: DEFAULT_THEME.tenantName,
        applyTheme: () => {
          const root = document.documentElement;
          root.style.setProperty('--primary', DEFAULT_THEME.primaryColor);
          root.style.setProperty('--accent', DEFAULT_THEME.accentColor);
        },
        isLoading: false,
      }}
    >
      {children}
    </TenantThemeContext.Provider>
  );
}



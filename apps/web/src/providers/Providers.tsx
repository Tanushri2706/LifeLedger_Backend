'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from 'next-themes';
import React, { useState } from 'react';

// Extend ThemeProviderProps to explicitly support children in React 19 type checking
interface ExtendedThemeProviderProps extends ThemeProviderProps {
  children?: React.ReactNode;
}

const ThemeProvider = NextThemesProvider as React.ComponentType<ExtendedThemeProviderProps>;

export function Providers({ children }: { children: React.ReactNode }) {
  // Create a QueryClient instance per session to avoid state sharing
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
}

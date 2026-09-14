"use client";
import { ThemeProvider } from "next-themes";
import React, { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Only import devtools in development to avoid bloating the production bundle
const ReactQueryDevtools =
  process.env.NODE_ENV === "development"
    ? React.lazy(() =>
        import("@tanstack/react-query-devtools").then((m) => ({
          default: m.ReactQueryDevtools,
        }))
      )
    : null;

export const AppProviders = ({ children }: { children: React.ReactNode }) => {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Don't refetch on window focus in production — reduces noise
            refetchOnWindowFocus: process.env.NODE_ENV !== "production",
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute='class' defaultTheme='light' enableSystem>
        {children}
      </ThemeProvider>
      {ReactQueryDevtools && (
        <React.Suspense fallback={null}>
          <ReactQueryDevtools />
        </React.Suspense>
      )}
    </QueryClientProvider>
  );
};

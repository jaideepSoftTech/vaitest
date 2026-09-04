// apps/web/src/shared/providers/query-provider.tsx
//
// Client component wrapping the Next.js App Router app in QueryClientProvider.
// Created fresh via useState() on each render to avoid sharing state across
// server requests (standard App Router pattern).

"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

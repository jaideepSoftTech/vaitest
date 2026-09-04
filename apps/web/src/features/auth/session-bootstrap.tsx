// apps/web/src/features/auth/session-bootstrap.tsx
//
// Client component that calls useBootstrapSession() to restore session on
// hard page reload, then renders children. Acts as a wrapper around the
// entire app tree.

"use client";

import { useBootstrapSession } from "./use-bootstrap-session";

export function SessionBootstrap({ children }: { children: React.ReactNode }) {
  const { isBootstrapped } = useBootstrapSession();

  if (!isBootstrapped) {
    return null; // or a loading spinner if you prefer
  }

  return children;
}

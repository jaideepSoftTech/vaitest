// apps/web/src/features/auth/use-bootstrap-session.ts
//
// On hard page reload, attempt to restore session by calling:
// 1. POST /auth/refresh (cookie-based refresh token)
// 2. GET /auth/me (with the new access token)
//
// If either fails, the session is cleared and user is redirected to /login
// (unless already on an auth route like /login or /signup).

"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { apiClient } from "@/shared/api/client";
import { useSessionStore } from "./session-store";

export function useBootstrapSession() {
  const [isBootstrapped, setIsBootstrapped] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const setSession = useSessionStore((s) => s.setSession);
  const clear = useSessionStore((s) => s.clear);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      try {
        // Try to refresh the access token using the httpOnly refresh cookie
        const refreshResult = await apiClient.refresh();

        if (!isMounted) return;

        // Now fetch current user with the new token
        const meResult = await apiClient.me(refreshResult.accessToken);

        if (!isMounted) return;

        // Session restored
        setSession({
          accessToken: refreshResult.accessToken,
          user: meResult.user,
          orgs: meResult.orgs,
          activeOrgId: meResult.activeOrgId,
        });
        setIsBootstrapped(true);
      } catch (err) {
        if (!isMounted) return;

        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);

        // If refresh/me fails, clear session
        clear();

        // Redirect to login unless already on an auth page
        const authPages = ["/login", "/signup", "/verify", "/invite"];
        const isAuthPage = authPages.some((p) => pathname.startsWith(p));

        if (!isAuthPage) {
          router.push("/login");
        }

        setIsBootstrapped(true);
      }
    }

    bootstrap();

    return () => {
      isMounted = false;
    };
  }, [setSession, clear, router, pathname]);

  return { isBootstrapped, error };
}

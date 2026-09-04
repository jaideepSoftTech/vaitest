// apps/web/src/features/auth/hooks.ts
//
// TanStack Query hooks for auth mutations. Each hook wraps a POST endpoint,
// handles the session store on success, and propagates errors to the caller.
// Queries (like `useMe`) use `useQuery` for caching.

"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import {
  apiClient,
  type SignupRequest,
  type LoginRequest,
  type VerifyEmailRequest,
  type ResendVerificationRequest,
  type AcceptInviteRequest,
  type CreateOrgRequest,
} from "@/shared/api/client";
import { useSessionStore } from "./session-store";

// ============================================================================
// Mutations
// ============================================================================

export function useSignup() {
  return useMutation({
    mutationFn: async (data: SignupRequest & { idempotencyKey: string }) => {
      const { idempotencyKey, ...body } = data;
      return apiClient.signup(body, idempotencyKey);
    },
  });
}

export function useLogin() {
  const setSession = useSessionStore((s) => s.setSession);

  return useMutation({
    mutationFn: (data: LoginRequest) => apiClient.login(data),
    onSuccess: (result) => {
      setSession({
        accessToken: result.accessToken,
        user: result.user,
        orgs: result.orgs,
      });
    },
  });
}

export function useLogout() {
  const clear = useSessionStore((s) => s.clear);

  return useMutation({
    mutationFn: () => apiClient.logout(),
    onSuccess: () => {
      clear();
    },
  });
}

export function useVerifyEmail() {
  const setSession = useSessionStore((s) => s.setSession);

  return useMutation({
    mutationFn: (data: VerifyEmailRequest) => apiClient.verifyEmail(data),
    onSuccess: (result) => {
      setSession({
        accessToken: result.accessToken,
        user: result.user,
        orgs: result.orgs,
      });
    },
  });
}

export function useResendVerification() {
  return useMutation({
    mutationFn: (data: ResendVerificationRequest) =>
      apiClient.resendVerification(data),
  });
}

export function useAcceptInvite() {
  const setSession = useSessionStore((s) => s.setSession);

  return useMutation({
    mutationFn: (data: AcceptInviteRequest) => apiClient.acceptInvite(data),
    onSuccess: (result) => {
      setSession({
        accessToken: result.accessToken,
        user: result.user,
        orgs: result.orgs,
      });
    },
  });
}

export function useCreateOrg() {
  return useMutation({
    mutationFn: (data: CreateOrgRequest) => {
      const accessToken = useSessionStore.getState().accessToken;
      if (!accessToken) throw new Error("Not authenticated");
      return apiClient.createOrg(data, accessToken);
    },
  });
}

// ============================================================================
// Queries
// ============================================================================

export function useDiscover(email: string) {
  return useQuery({
    queryKey: ["auth", "discover", email],
    queryFn: () => apiClient.discover(email),
    enabled: !!email, // only run when email is provided
  });
}

export function useMe(accessToken: string | null) {
  return useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => {
      if (!accessToken) throw new Error("No access token");
      return apiClient.me(accessToken);
    },
    enabled: !!accessToken,
  });
}

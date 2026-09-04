// apps/web/src/features/auth/session-store.ts
//
// Client-side session state using Zustand. Holds the access token (short-lived,
// not persisted) and current user/orgs. The refresh token is httpOnly and
// handled by the server only (never touched from JS).
//
// On hard page reload, the app bootstraps by calling POST /auth/refresh
// (cookie-based) to mint a new access token, then GET /auth/me.

import { create } from "zustand";
import { User, Org } from "@/shared/api/client";

export interface SessionState {
  accessToken: string | null;
  user: User | null;
  orgs: Org[] | null;
  activeOrgId: string | null;

  setSession: (session: {
    accessToken: string;
    user: User;
    orgs: Org[];
    activeOrgId?: string;
  }) => void;

  setActiveOrgId: (orgId: string) => void;

  clear: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  accessToken: null,
  user: null,
  orgs: null,
  activeOrgId: null,

  setSession: (session) =>
    set({
      accessToken: session.accessToken,
      user: session.user,
      orgs: session.orgs,
      activeOrgId: session.activeOrgId || session.orgs?.[0]?.id || null,
    }),

  setActiveOrgId: (orgId) => set({ activeOrgId: orgId }),

  clear: () =>
    set({
      accessToken: null,
      user: null,
      orgs: null,
      activeOrgId: null,
    }),
}));

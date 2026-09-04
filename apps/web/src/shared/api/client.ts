// apps/web/src/shared/api/client.ts
//
// Typed API client covering the Week 2 auth contract (04-API-CONTRACTS.md §Auth).
// This is a hand-written client as a deliberate Week-2 stopgap: it will be
// replaced by the generated `@qa/types`-based `openapi-fetch` client once the
// backend publishes its OpenAPI spec at the end of Week 3. See the roadmap
// (06-TEAM-FRONTEND.md §1.2).
//
// All `fetch` calls in the app flow through here (layering rule #4). The client
// attaches the access token automatically for authenticated endpoints and sets
// credentials: 'include' on every request for refresh-cookie handling.
//
// Mock API: Set `NEXT_PUBLIC_USE_MOCK_API=true` in .env.local to point at the
// Prism mock server instead of the real backend. The mock runs on port 4010
// (see mocks/auth-openapi.yaml and pnpm dev script in package.json).

// ============================================================================
// Types (matching 04-API-CONTRACTS.md exactly)
// ============================================================================

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  status: "active" | "inactive";
  lastLoginAt: string | null;
}

export interface Org {
  id: string;
  name: string;
  slug: string;
  role: "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";
  status: "active" | "inactive";
  planKey: string;
  dataRegion: "US" | "EU";
  permissions: string[];
  entitlements: Record<string, unknown>;
  budgetState: "OK" | "WARNING" | "EXCEEDED";
}

export interface SignupRequest {
  email: string;
  password: string;
  name: string;
  orgName: string;
  orgSlug?: string;
  dataRegion: "US" | "EU";
}

export interface SignupResponse {
  emailVerificationRequired: true;
}

export interface DiscoverResponse {
  domainClaimed: boolean;
  orgSlug?: string;
  orgName?: string;
  mode: "PASSWORD" | "SSO_REQUIRED" | "SSO_OPTIONAL";
  protocol?: "SAML" | "OIDC";
  startUrl?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  user: User;
  orgs: Org[];
}

export interface RefreshResponse {
  accessToken: string;
}

export interface MeResponse {
  user: User;
  activeOrgId: string;
  orgs: Org[];
}

export interface VerifyEmailRequest {
  token: string;
}

export type VerifyEmailResponse = LoginResponse;

export interface ResendVerificationRequest {
  email: string;
}

export interface ResendVerificationResponse {
  ok: boolean;
}

export interface AcceptInviteRequest {
  token: string;
  password?: string;
  name?: string;
}

export type AcceptInviteResponse = LoginResponse;

export interface CreateOrgRequest {
  orgName: string;
  orgSlug?: string;
  dataRegion: "US" | "EU";
}

export type CreateOrgResponse = Org;

export interface ApiErrorResponse {
  error: string;
  message?: string;
}

// ============================================================================
// Client setup
// ============================================================================

const API_BASE_URL =
  process.env.NEXT_PUBLIC_USE_MOCK_API === "true"
    ? `http://localhost:4010/api/v1`
    : process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001/api/v1";

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: ApiErrorResponse | string,
  ) {
    const message =
      typeof body === "string"
        ? body
        : body.message || body.error || "Unknown error";
    super(message);
    this.name = "ApiError";
  }
}

interface RequestOptions extends RequestInit {
  accessToken?: string;
}

async function request<T>(
  path: string,
  init?: RequestOptions,
): Promise<T> {
  const { accessToken, ...rest } = init || {};

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(rest.headers as Record<string, string> | undefined),
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...rest,
      headers,
      credentials: "include", // for refresh token cookie
    });

    if (!res.ok) {
      let errorBody: ApiErrorResponse | string;
      try {
        errorBody = await res.json();
      } catch {
        errorBody = await res.text();
      }
      throw new ApiError(res.status, errorBody);
    }

    if (res.status === 204) {
      return undefined as T;
    }

    return res.json() as Promise<T>;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new Error(`Network error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ============================================================================
// Public API client
// ============================================================================

export const apiClient = {
  health: () =>
    request<{ status: string; service: string; region: string }>("/health"),

  // Auth endpoints
  signup: (body: SignupRequest, idempotencyKey: string) =>
    request<SignupResponse>("/auth/signup", {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        "Idempotency-Key": idempotencyKey,
      },
    }),

  discover: (email: string) =>
    request<DiscoverResponse>(`/auth/discover?email=${encodeURIComponent(email)}`),

  login: (body: LoginRequest) =>
    request<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  refresh: () =>
    request<RefreshResponse>("/auth/refresh", {
      method: "POST",
    }),

  logout: () =>
    request<void>("/auth/logout", {
      method: "POST",
    }),

  me: (accessToken: string) =>
    request<MeResponse>("/auth/me", {
      method: "GET",
      accessToken,
    }),

  verifyEmail: (body: VerifyEmailRequest) =>
    request<VerifyEmailResponse>("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  resendVerification: (body: ResendVerificationRequest) =>
    request<ResendVerificationResponse>("/auth/verify-email/resend", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  acceptInvite: (body: AcceptInviteRequest) =>
    request<AcceptInviteResponse>("/invitations/accept", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  createOrg: (body: CreateOrgRequest, accessToken: string) =>
    request<CreateOrgResponse>("/auth/orgs", {
      method: "POST",
      body: JSON.stringify(body),
      accessToken,
    }),
};

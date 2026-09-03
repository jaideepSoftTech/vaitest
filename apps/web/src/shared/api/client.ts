// apps/web/src/shared/api/client.ts
//
// shared/api/** is the only place `fetch` appears — no component calls
// `fetch` directly, ever (06-TEAM-FRONTEND.md §1.1, layering rule #4). Real
// typed methods are generated from packages/types once the OpenAPI contract
// freezes at the end of Week 3 (04-API-CONTRACTS.md); this is the request
// primitive everything else is built on, plus a placeholder health check so
// the app shell has something real to call against apps/api.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) throw new ApiError(res.status, await res.text());
  return res.json() as Promise<T>;
}

export const apiClient = {
  health: () => request<{ status: string; service: string; region: string }>("/health"),
};

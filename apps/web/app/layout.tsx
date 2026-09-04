import type { Metadata } from "next";
import "./globals.css";
import { QueryProvider } from "@/shared/providers/query-provider";
import { SessionBootstrap } from "@/features/auth/session-bootstrap";

export const metadata: Metadata = {
  title: "qa-platform",
  description: "Autonomous AI testing platform — local development shell.",
};

// Server components render chrome and route structure only. Every byte of
// API data is fetched client-side through TanStack Query — see
// 06-TEAM-FRONTEND.md §1.2. This root layout is chrome; it owns no data.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <QueryProvider>
          <SessionBootstrap>{children}</SessionBootstrap>
        </QueryProvider>
      </body>
    </html>
  );
}

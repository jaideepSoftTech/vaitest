// apps/web/app/(app)/layout.tsx
//
// Authenticated app layout (minimal for Week 2). Used for routes like /orgs/new.
// In future weeks, this will be extended with org switching, sidebar nav, etc.

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // TODO: Add route guard here once useBootstrapSession() is available client-side.
  // For now, client components will handle redirects individually.

  return (
    <main className="min-h-screen bg-background">
      {children}
    </main>
  );
}

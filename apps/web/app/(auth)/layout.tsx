// apps/web/app/(auth)/layout.tsx
//
// Auth route group layout. Minimal centered card design, no app chrome or nav.
// All auth pages (signup, login, verify, invite) render within this layout.

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted px-4 py-8">
      <div className="w-full max-w-md rounded-lg border border-border bg-background p-8 shadow-sm">
        {children}
      </div>
    </main>
  );
}

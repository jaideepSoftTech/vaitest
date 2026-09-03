import { Button } from "@/shared/ui/button";

// Placeholder landing route. Real routes land Week 2 onward per
// 06-TEAM-FRONTEND.md §14: auth screens against Prism first, then
// app/o/[org]/** for the tenant plane once the org-switch sequence (§2.4)
// exists. This page exists only to prove the app boots and shared/ui
// resolves.
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold">qa-platform</h1>
      <p className="max-w-md text-center text-muted-foreground">
        M0 scaffold. This app shell boots; the tenant plane (
        <code className="rounded bg-muted px-1 py-0.5">app/o/[org]/**</code>)
        and the operator plane land starting Week 2 per the roadmap.
      </p>
      <Button>Design-token check</Button>
    </main>
  );
}

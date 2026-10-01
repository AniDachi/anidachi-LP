export default function AccountLoading() {
  return <div role="status" aria-label="Loading account section" className="space-y-8 py-2 motion-safe:animate-pulse">
    <div className="h-9 w-52 rounded bg-foreground/10" />
    <div className="h-4 w-72 max-w-full rounded bg-foreground/5" />
    <div className="space-y-5 border-t border-foreground/10 pt-6">
      {[0, 1, 2].map(row => <div key={row} className="h-14 rounded bg-foreground/5" />)}
    </div>
    <span className="sr-only">Loading your account…</span>
  </div>;
}

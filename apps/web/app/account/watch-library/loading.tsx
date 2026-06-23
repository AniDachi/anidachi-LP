// Instant skeleton for the watch library route segment. The page is a
// force-dynamic server component that awaits the full watch-library query
// chain before rendering; without this fallback the account section stays
// blank until every query resolves. Next.js streams this skeleton immediately
// and swaps in the real page once the data is ready.
export default function WatchLibraryLoading() {
  return (
    <div className="flex animate-pulse flex-col gap-6" aria-hidden>
      <section className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="h-24 rounded-lg border border-white/10 bg-white/[0.04]"
          />
        ))}
      </section>

      <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="space-y-2">
            <div className="h-5 w-40 rounded bg-white/10" />
            <div className="h-4 w-64 rounded bg-white/[0.07]" />
          </div>
          <div className="h-11 w-28 rounded-lg bg-white/10" />
        </div>
      </section>

      <div className="grid gap-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <section
            key={index}
            className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.04]"
          >
            <div className="flex items-center gap-4 border-b border-white/10 p-4">
              <div className="h-16 w-11 shrink-0 rounded-md bg-white/10" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-3 w-28 rounded bg-white/[0.07]" />
                <div className="h-5 w-48 rounded bg-white/10" />
                <div className="h-3 w-32 rounded bg-white/[0.07]" />
              </div>
            </div>
            <div className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
              <div className="space-y-2">
                <div className="h-4 w-56 rounded bg-white/10" />
                <div className="h-2 w-full rounded-full bg-white/10" />
                <div className="h-3 w-40 rounded bg-white/[0.07]" />
              </div>
              <div className="h-11 w-32 rounded-lg bg-white/10" />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

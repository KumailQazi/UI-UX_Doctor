export default function ResultsSkeleton() {
  return (
    <div className="mx-auto flex h-full max-w-6xl animate-pulse flex-col gap-4">
      <header className="shrink-0">
        <div className="h-8 w-1/3 rounded-lg bg-zinc-200" />
        <div className="mt-2 h-5 w-1/2 rounded-lg bg-zinc-200" />
      </header>

      <div className="shrink-0 rounded-lg border border-zinc-200 bg-white p-3">
        <div className="h-4 w-1/4 rounded-lg bg-zinc-200" />
        <div className="relative mt-2 h-9 rounded bg-zinc-100" />
      </div>

      <div className="min-h-0 flex-1">
        <div className="grid h-full gap-6 lg:grid-cols-[320px_1fr]">
          <aside className="h-full space-y-3 overflow-y-auto pr-1">
            <div className="h-24 w-full rounded-lg border border-zinc-200 bg-white" />
            <div className="h-24 w-full rounded-lg border border-zinc-200 bg-zinc-50" />
            <div className="h-24 w-full rounded-lg border border-zinc-200 bg-zinc-50" />
          </aside>
          <section className="h-full space-y-4 overflow-y-auto pr-1">
            <div className="aspect-video w-full rounded-lg border border-zinc-200 bg-white" />
            <div className="h-28 w-full rounded-lg border border-zinc-200 bg-white" />
          </section>
        </div>
      </div>
    </div>
  );
}

export default function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse space-y-4">
      <header className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="h-4 w-1/4 rounded-lg bg-zinc-200" />
        <div className="mt-2 h-8 w-1/3 rounded-lg bg-zinc-200" />
      </header>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="h-20 rounded-lg border border-zinc-200 bg-white" />
        <div className="h-20 rounded-lg border border-zinc-200 bg-zinc-50" />
        <div className="h-20 rounded-lg border border-zinc-200 bg-zinc-50" />
        <div className="h-20 rounded-lg border border-zinc-200 bg-zinc-50" />
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="h-48 rounded-xl border border-zinc-200 bg-white" />
        <div className="h-48 rounded-xl border border-zinc-200 bg-white" />
      </section>
      <section className="h-64 rounded-xl border border-zinc-200 bg-white" />
    </div>
  );
}

import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-100 px-6 py-14">
      <div className="mx-auto max-w-4xl">
        <p className="text-sm font-semibold text-indigo-700">UI/UX Doctor</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-zinc-900">
          Visual UI Debugger for Fast-Moving Product Teams
        </h1>
        <p className="mt-4 max-w-2xl text-zinc-600">
          Analyze session recordings, detect high-friction UI patterns, and generate accessible React/Tailwind fixes.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/upload"
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            Start analysis
          </Link>
          <Link
            href="/dashboard?projectId=demo-project"
            className="rounded-md border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100"
          >
            Open dashboard
          </Link>
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            View code
          </a>
        </div>

        <section className="mt-10 grid gap-4 md:grid-cols-3">
          <article className="rounded-xl border border-zinc-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-zinc-900">1) Detect friction</h2>
            <p className="mt-2 text-sm text-zinc-600">Flags dead clicks and hidden mobile CTAs with evidence.</p>
          </article>
          <article className="rounded-xl border border-zinc-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-zinc-900">2) Generate patch</h2>
            <p className="mt-2 text-sm text-zinc-600">Creates production-ready React and Tailwind fixes instantly.</p>
          </article>
          <article className="rounded-xl border border-zinc-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-zinc-900">3) Learn preferences</h2>
            <p className="mt-2 text-sm text-zinc-600">Accepted fixes train team-specific recommendations over time.</p>
          </article>
        </section>
      </div>
    </main>
  );
}

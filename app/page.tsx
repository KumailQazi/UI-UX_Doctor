import Link from "next/link";
import { Github } from "lucide-react";
import { APP_NAME, DEFAULT_PROJECT_ID } from "@/lib/constants";

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-100 px-6 py-14">
      <div className="mx-auto max-w-4xl">
        <p className="text-sm font-semibold text-indigo-700">{APP_NAME}</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-zinc-900">
          Visual UI Debugger for Fast-Moving Product Teams
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-zinc-600">
          Stop guessing. Analyze session recordings, detect high-friction UI patterns, and generate accessible React/Tailwind fixes your team can ship instantly.
        </p>

        {/* TODO: Add product demo video or screenshots */}
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/upload"
            className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            Start analysis
          </Link>
          <Link
            href={`/dashboard?projectId=${encodeURIComponent(DEFAULT_PROJECT_ID)}`}
            className="inline-flex items-center justify-center rounded-md border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100"
          >
            Open dashboard
          </Link>
          <a
            href="https://github.com/sylphai/adal-component-doctor-hackathon"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50"
          >
            <Github className="mr-2 h-4 w-4" />
            View code
          </a>
        </div>

        <section className="mt-12 grid gap-6 md:grid-cols-3">
          <article className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-zinc-900">1) Detect Friction Points</h2>
            <p className="mt-2 text-sm text-zinc-600">
              Pinpoint issues like dead clicks, rage clicks, and hidden mobile CTAs with visual evidence and heatmaps.
            </p>
          </article>
          <article className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-zinc-900">2) Generate Production-Ready Fixes</h2>
            <p className="mt-2 text-sm text-zinc-600">
              Receive accessible React and Tailwind patches, complete with risk notes and a clear diagnosis.
            </p>
          </article>
          <article className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-zinc-900">3) Learn Your Team&apos;s Preferences</h2>
            <p className="mt-2 text-sm text-zinc-600">
              Accepted fixes train a team-specific memory, ensuring future recommendations align with your coding style.
            </p>
          </article>
        </section>
      </div>
    </main>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface SessionEvent {
  eventType?: string;
  elementId?: string;
  x?: number;
  y?: number;
  result?: string;
  scrollY?: number;
}

interface SessionData {
  userContext?: {
    viewport?: {
      width?: number;
      height?: number;
    };
  };
  events?: SessionEvent[];
}

export default function UploadPanel() {
  const router = useRouter();
  const [projectId, setProjectId] = useState("demo-project");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [sessionFile, setSessionFile] = useState<File | null>(null);

  const runAnalysis = async () => {
    setLoading(true);
    setMessage("Analyzing session...");

    try {
      let sessionData: SessionData | undefined;

      if (sessionFile) {
        const isJson =
          sessionFile.type === "application/json" ||
          sessionFile.name.toLowerCase().endsWith(".json");

        if (isJson) {
          const raw = await sessionFile.text();
          sessionData = JSON.parse(raw) as SessionData;
        }
      }

      if (sessionData) {
        sessionStorage.setItem(
          `componentDoctorSessionData:${projectId}`,
          JSON.stringify(sessionData)
        );
      }

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, sessionData }),
      });

      if (!response.ok) {
        throw new Error("Failed to analyze session");
      }

      const data = (await response.json()) as { jobId: string };
      router.push(`/results/${data.jobId}?projectId=${encodeURIComponent(projectId)}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-zinc-900">Upload Session</h2>
      <p className="mt-2 text-sm text-zinc-600">
        Upload a session JSON file (preferred) or skip upload to run seeded demo analysis.
      </p>

      <div className="mt-4 space-y-3">
        <label className="block text-sm font-medium text-zinc-700" htmlFor="projectId">
          Project ID
        </label>
        <input
          id="projectId"
          value={projectId}
          onChange={(event) => setProjectId(event.target.value)}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
          placeholder="demo-project"
        />
      </div>

      <div className="mt-4 space-y-3">
        <label className="block text-sm font-medium text-zinc-700" htmlFor="sessionVideo">
          Session file (JSON for heatmap coordinates, video optional)
        </label>
        <input
          id="sessionVideo"
          type="file"
          accept="video/*,.json,application/json"
          onChange={(event) => setSessionFile(event.target.files?.[0] ?? null)}
          className="block w-full rounded-md border border-zinc-300 p-2 text-sm text-zinc-700 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-900 file:px-3 file:py-1.5 file:text-white"
        />
      </div>

      <button
        type="button"
        onClick={runAnalysis}
        disabled={loading}
        className="mt-6 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
      >
        {loading ? "Running..." : "Run Analysis"}
      </button>

      {message ? <p className="mt-3 text-sm text-zinc-600">{message}</p> : null}
    </section>
  );
}

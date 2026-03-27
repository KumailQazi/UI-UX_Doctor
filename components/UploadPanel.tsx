"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { DEFAULT_PROJECT_ID, getSessionStorageKey } from "@/lib/constants";
import type { SessionData } from "@/lib/sessionSchema";
import FileUploader from "./FileUploader";

export default function UploadPanel() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [projectId, setProjectId] = useState(DEFAULT_PROJECT_ID);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [sessionFile, setSessionFile] = useState<File | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const runAnalysis = async () => {
    setLoading(true);
    setMessage("Analyzing session...");

    try {
      let sessionData: SessionData | undefined;

      if (sessionFile) {
        const raw = await sessionFile.text();
        sessionData = JSON.parse(raw) as SessionData;
      }

      if (sessionData) {
        sessionStorage.setItem(getSessionStorageKey(projectId), JSON.stringify(sessionData));
      }

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, sessionData }),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as { message?: string };
        throw new Error(errorData.message || "Failed to analyze session");
      }

      const data = (await response.json()) as { jobId: string };
      router.push(`/results/${data.jobId}?projectId=${encodeURIComponent(projectId)}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = useCallback((file: File | null) => {
    setSessionFile(file);
    if (file) {
      setMessage(""); // Clear any previous error messages
    }
  }, []);

  if (!mounted) {
    return (
      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm animate-pulse">
        <div className="h-6 w-1/2 rounded bg-zinc-200" />
        <div className="mt-3 h-4 w-3/4 rounded bg-zinc-200" />
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-zinc-900">Upload Session</h2>
      <p className="mt-2 text-sm text-zinc-600">
        Upload a session JSON file or run the seeded demo analysis.
      </p>

      <div className="mt-4 space-y-3">
        <label htmlFor="projectId" className="block text-sm font-medium text-zinc-700">
          Project ID
        </label>
        <input
          id="projectId"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="w-full rounded-md border-zinc-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          placeholder={DEFAULT_PROJECT_ID}
        />
      </div>

      <div className="mt-5">
        <label className="mb-1 block text-sm font-medium text-zinc-700">
          Session Recording
        </label>
        <FileUploader file={sessionFile} onFileSelect={handleFileSelect} />
      </div>

      <button
        type="button"
        onClick={runAnalysis}
        disabled={loading}
        className="mt-6 inline-flex w-full justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
      >
        {loading ? "Analyzing..." : "Run Analysis"}
      </button>

      {message && <p className="mt-3 text-sm text-red-600">{message}</p>}
    </section>
  );
}

import UploadPanel from "@/components/UploadPanel";

export default function UploadPage() {
  return (
    <main className="min-h-screen bg-zinc-100 px-6 py-10">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">UI/UX Doctor</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Upload a session recording (or run demo mode) to detect high-friction UI issues.
        </p>
        <div className="mt-6">
          <UploadPanel />
        </div>
      </div>
    </main>
  );
}

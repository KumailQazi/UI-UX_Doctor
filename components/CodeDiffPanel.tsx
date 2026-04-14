import type { GenerateFixResponse } from "@/lib/issueSchema";
import CopyButton from "@/components/CopyButton";

interface CodeDiffPanelProps {
  fix: GenerateFixResponse;
}

export default function CodeDiffPanel({ fix }: CodeDiffPanelProps) {
  return (
    <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4">
      <div>
        <h3 className="text-sm font-semibold text-zinc-900">Diagnosis</h3>
        <p className="mt-1 text-sm text-zinc-700">{fix.diagnosis}</p>
        {fix.personalizedNote ? (
          <p className="mt-2 text-xs font-medium text-indigo-700">{fix.personalizedNote}</p>
        ) : null}
      </div>

      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">React Patch</h4>
        <div className="mt-2 flex justify-end">
          <CopyButton value={fix.patchedCode.react} />
        </div>
        <pre className="mt-2 overflow-x-auto rounded-md bg-zinc-950 p-3 text-xs text-zinc-100">
          <code>{fix.patchedCode.react}</code>
        </pre>
      </div>

      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">CSS / Tailwind Notes</h4>
        <div className="mt-2 flex justify-end">
          <CopyButton value={fix.patchedCode.cssOrTailwind} />
        </div>
        <pre className="mt-2 overflow-x-auto rounded-md bg-zinc-950 p-3 text-xs text-zinc-100">
          <code>{fix.patchedCode.cssOrTailwind}</code>
        </pre>
      </div>

      <ul className="list-disc space-y-1 pl-5 text-xs text-zinc-600">
        {fix.riskNotes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </section>
  );
}

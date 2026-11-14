"use client";
import { attentionReasons, missingRequiredFields, patient, transferStatusLabel } from "@/core/selectors";
import type { DemoState, TransferEpisode } from "@/core/types";
import { SCENARIO_LABELS } from "@/scenarios/seed";
import { TransferStatusBadge } from "./ui";

export function TransferList({
  state,
  transfers,
  selectedId,
  onSelect,
  label,
}: {
  state: DemoState;
  transfers: TransferEpisode[];
  selectedId?: string;
  onSelect: (id: string) => void;
  label: string;
}) {
  return (
    <nav aria-label={label}>
      <h2 className="font-semibold mb-2">{label}</h2>
      <ul className="space-y-2">
        {transfers.map((t) => {
          const p = patient(state, t.patientId);
          const flags = state.tasks
            .filter((k) => k.transferId === t.id)
            .filter((k) => attentionReasons(k, state.now).some((r) => r !== "unassigned")).length;
          const missing = missingRequiredFields(t).length;
          return (
            <li key={t.id}>
              <button
                onClick={() => onSelect(t.id)}
                aria-current={selectedId === t.id ? "true" : undefined}
                className={`w-full text-left card hover:border-blue-400 ${selectedId === t.id ? "ring-2 ring-blue-600" : ""}`}
              >
                <div className="text-xs text-slate-600">{SCENARIO_LABELS[t.id] ?? t.id}</div>
                <div className="font-medium">
                  {p?.displayName} <span className="font-mono text-xs text-slate-600">{p?.syntheticId}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  <TransferStatusBadge status={t.status} label={transferStatusLabel(t)} />
                  {flags > 0 && (
                    <span className="rounded bg-red-700 px-1.5 py-0.5 text-xs font-semibold text-white">
                      ⚠ {flags} need{flags === 1 ? "s" : ""} action
                    </span>
                  )}
                  {missing > 0 && (
                    <span className="rounded bg-amber-200 px-1.5 py-0.5 text-xs font-semibold text-amber-950">
                      {missing} required field{missing === 1 ? "" : "s"} missing
                    </span>
                  )}
                </div>
              </button>
            </li>
          );
        })}
        {transfers.length === 0 && <li className="text-sm text-slate-600">Nothing here.</li>}
      </ul>
    </nav>
  );
}

"use client";
import { useId, useState } from "react";
import { handoverValidation, practitioner } from "@/core/selectors";
import type { FieldValidation } from "@/core/validation";
import type { DemoState, TransferEpisode } from "@/core/types";
import { FIELD_BY_KEY, fieldLabel } from "@/packs/fields";
import { formatProblem, hasConflict } from "@/core/validation";
import { getReceiverProfile } from "@/packs/receivers";
import { TRANSFER_KIND_CONFIG } from "@/packs/transferKinds";
import { useCommand } from "@/state/store";
import { ErrorAlert, fmt, TextAction } from "./ui";

const RAG_STYLE: Record<FieldValidation["status"], { cls: string; text: string }> = {
  green: { cls: "bg-green-700 text-white", text: "✓ GREEN" },
  amber: { cls: "bg-amber-400 text-amber-950", text: "! AMBER" },
  red: { cls: "bg-red-700 text-white", text: "✕ RED" },
  "absent-optional": { cls: "bg-slate-200 text-slate-800", text: "– optional" },
};

export function RagChip({ status }: { status: FieldValidation["status"] }) {
  const s = RAG_STYLE[status];
  return <span className={`inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-bold ${s.cls}`}>{s.text}</span>;
}

/**
 * Fixed, reviewable handover panel. Shows receiver requirements, values, verbatim source evidence,
 * entry method, confirmation and identity. Sender mode adds confirm / correct actions.
 * It never decides anything clinical — it reports presence and confirmation state.
 */
export function HandoverPanel({
  state,
  transfer,
  mode,
  actorId,
}: {
  state: DemoState;
  transfer: TransferEpisode;
  mode: "sender" | "receiver";
  actorId: string;
}) {
  const h = transfer.handover!;
  const profile = getReceiverProfile(h.receiverProfileId);
  const kind = TRANSFER_KIND_CONFIG[h.transferKind];
  const v = handoverValidation(state, transfer)!;
  const { run, error } = useCommand();
  const editable = mode === "sender" && ["draft", "info-confirmed", "clarification-requested"].includes(transfer.status);
  const docs = h.documentIds.map((id) => state.documents.find((d) => d.id === id)).filter(Boolean);
  const counts = { green: 0, amber: 0, red: 0 };
  for (const f of v.fields) if (f.status in counts && f.required) counts[f.status as keyof typeof counts]++;

  return (
    <section className="card space-y-3" aria-label="Handover review">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">
            {kind.documentNoun} → {profile.name}
          </h2>
          <p className="text-xs text-slate-600">
            Profile {profile.id} v{profile.version} (review date {profile.reviewDate}) · intended receiving role: {profile.owningRole}
          </p>
          <p className="text-xs text-amber-900">{profile.disclaimer}</p>
          {profile.capabilities && (
            <ul className="mt-1 ml-5 list-disc text-xs text-slate-700" aria-label="Simulated service capability statements">
              {profile.capabilities.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="text-sm" aria-label="Required field summary">
          <span className="mr-2">Required:</span>
          <span className="mr-2">{counts.green} green</span>
          <span className="mr-2">{counts.amber} amber</span>
          <span>{counts.red} red</span>
        </div>
      </div>

      <IdentityBox state={state} transfer={transfer} editable={editable} actorId={actorId} />

      {v.questions.length > 0 && (
        <div role="status" className="rounded border border-amber-400 bg-amber-50 p-2 text-sm">
          <strong>{mode === "sender" ? "Questions to resolve before sending" : "Outstanding questions"}:</strong>
          <ol className="ml-5 list-decimal">
            {v.questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ol>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Receiver-required information with validation results</caption>
          <thead>
            <tr className="border-b text-left text-slate-600">
              <th scope="col" className="py-1 pr-2">Status</th>
              <th scope="col" className="py-1 pr-2">Field</th>
              <th scope="col" className="py-1 pr-2">Value</th>
              <th scope="col" className="py-1 pr-2">Source evidence</th>
              <th scope="col" className="py-1 pr-2">Confirmation</th>
              {editable && <th scope="col" className="py-1">Action</th>}
            </tr>
          </thead>
          <tbody>
            {v.fields.map((fv) => (
              <FieldRow key={fv.key} fv={fv} state={state} transfer={transfer} editable={editable} actorId={actorId} run={run} />
            ))}
          </tbody>
        </table>
      </div>
      <ErrorAlert error={error} />
      {editable && <BulkConfirm state={state} transfer={transfer} actorId={actorId} />}

      {h.extractionWarnings.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer">Extraction warnings ({h.extractionWarnings.length})</summary>
          <ul className="ml-5 list-disc text-slate-700">
            {h.extractionWarnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </details>
      )}
      <details className="text-sm">
        <summary className="cursor-pointer">Source documents ({docs.length})</summary>
        {docs.map((d) => (
          <div key={d!.id} className="mt-2">
            <div className="font-medium">
              {d!.title} <span className="font-mono text-xs text-slate-500">{d!.id}</span>
            </div>
            <pre className="whitespace-pre-wrap rounded bg-slate-100 p-2 text-xs">{d!.text}</pre>
          </div>
        ))}
      </details>
    </section>
  );
}

function IdentityBox({ state, transfer, editable, actorId }: { state: DemoState; transfer: TransferEpisode; editable: boolean; actorId: string }) {
  const v = handoverValidation(state, transfer)!;
  const { run, error } = useCommand();
  const p = state.patients.find((x) => x.id === transfer.patientId);
  const tone =
    v.identity.status === "match" || v.identity.status === "manually-checked"
      ? "border-green-400 bg-green-50"
      : "border-red-400 bg-red-50";
  return (
    <div className={`rounded border p-2 text-sm ${tone}`}>
      <strong>Patient identity: {v.identity.status.replace("-", " ")}</strong>{" "}
      <span className="text-slate-700">
        (record: {p?.displayName}, NHS {p?.nhsNumber ?? "—"}, DOB {p?.birthDate ?? "—"}; synthetic)
      </span>
      <ul className="ml-5 list-disc">
        {v.identity.reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      {editable && v.identity.status === "unverified" && (
        <div className="mt-2">
          <TextAction
            label="Record manual identity check"
            fieldLabel="How was identity checked? (named professional, recorded in history)"
            onSubmit={(note) => run({ type: "recordIdentityCheck", actorId, transferId: transfer.id, note })}
          />
        </div>
      )}
      <ErrorAlert error={error} />
    </div>
  );
}

function FieldRow({
  fv,
  state,
  transfer,
  editable,
  actorId,
  run,
}: {
  fv: FieldValidation;
  state: DemoState;
  transfer: TransferEpisode;
  editable: boolean;
  actorId: string;
  run: ReturnType<typeof useCommand>["run"];
}) {
  const f = transfer.handover!.fields[fv.key];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(f?.value ?? "");
  const inputId = useId();
  const def = FIELD_BY_KEY[fv.key];
  const docTitle = (id: string) => state.documents.find((d) => d.id === id)?.title ?? id;

  return (
    <tr className="border-b border-slate-100 align-top">
      <td className="py-1.5 pr-2">
        <RagChip status={fv.status} />
      </td>
      <td className="py-1.5 pr-2">
        <div className="font-medium">{fv.label}</div>
        <div className="text-xs text-slate-600">
          {fv.required ? "Required" : "Optional"}
          {fv.rule.includes("required-when") && " (conditional)"}
        </div>
        <ul className="text-xs text-slate-700">
          {fv.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <div className="text-[10px] text-slate-400 font-mono">{fv.rule}</div>
      </td>
      <td className="py-1.5 pr-2 max-w-xs">
        {editing ? (
          <form
            className="space-y-1"
            onSubmit={(e) => {
              e.preventDefault();
              if (run({ type: "updateHandoverField", actorId, transferId: transfer.id, key: fv.key, value: draft })) setEditing(false);
            }}
          >
            <label htmlFor={inputId} className="sr-only">
              {fv.label}
            </label>
            {def?.long ? (
              <textarea id={inputId} className="input" rows={2} value={draft} onChange={(e) => setDraft(e.target.value)} />
            ) : (
              <input id={inputId} className="input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={def?.format === "date" ? "YYYY-MM-DD" : undefined} />
            )}
            <div className="flex gap-1">
              <button type="submit" className="btn-primary">Save (manual)</button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  if (run({ type: "updateHandoverField", actorId, transferId: transfer.id, key: fv.key, value: draft }) && draft.trim()) {
                    run({ type: "confirmHandoverField", actorId, transferId: transfer.id, key: fv.key });
                    setEditing(false);
                  }
                }}
              >
                Save & confirm
              </button>
              <button type="button" className="btn-secondary" onClick={() => setEditing(false)}>
                Cancel
              </button>
            </div>
          </form>
        ) : f?.value ? (
          <span>{f.value}</span>
        ) : (
          <em className="text-red-800">{fv.required ? "Missing" : "Not supplied"}</em>
        )}
      </td>
      <td className="py-1.5 pr-2 max-w-sm">
        {!f ? (
          "—"
        ) : f.entryMethod === "manual" ? (
          <span className="text-xs text-slate-700">Entered manually by {practitioner(state, f.updatedBy)?.name} — no source document</span>
        ) : (
          <ul className="space-y-1">
            {f.evidence.map((e, i) => (
              <li key={i} className="text-xs">
                <q className="rounded bg-yellow-50 px-1 font-mono">{e.quote}</q>
                <div className="text-slate-500">
                  {docTitle(e.documentId)} · chars {e.start}–{e.end} · {f.entryMethod}
                </div>
              </li>
            ))}
          </ul>
        )}
      </td>
      <td className="py-1.5 pr-2 text-xs">
        {f?.confirmedBy ? (
          <>
            ✓ {practitioner(state, f.confirmedBy)?.name} ({f.confirmedRole})
            <div className="text-slate-500">{fmt(f.confirmedAt)}</div>
          </>
        ) : f ? (
          <span className="font-semibold text-amber-900">Not confirmed</span>
        ) : (
          "—"
        )}
      </td>
      {editable && (
        <td className="py-1.5">
          {!editing && (
            <div className="flex flex-col gap-1">
              {f && !f.confirmedBy && transfer.status !== "info-confirmed" && (
                <button className="btn-primary" onClick={() => run({ type: "confirmHandoverField", actorId, transferId: transfer.id, key: fv.key })}>
                  Confirm
                </button>
              )}
              <button
                className="btn-secondary"
                onClick={() => {
                  setDraft(f?.value ?? "");
                  setEditing(true);
                }}
              >
                {f ? "Correct" : "Add"}
              </button>
            </div>
          )}
        </td>
      )}
    </tr>
  );
}

/**
 * Explicit, named bulk confirmation of UNFLAGGED values the acting professional is permitted to
 * confirm. Ambiguous, conflicting, malformed or role-restricted fields are skipped and must be
 * handled one by one. Each confirmation is its own audit event.
 */
function BulkConfirm({ state, transfer, actorId }: { state: DemoState; transfer: TransferEpisode; actorId: string }) {
  const { run, error } = useCommand();
  const h = transfer.handover!;
  const profile = getReceiverProfile(h.receiverProfileId);
  const me = practitioner(state, actorId);
  if (transfer.status === "info-confirmed") return null;
  const eligible = Object.values(h.fields).filter((f) => {
    const rule = profile.fields.find((r) => r.key === f.key);
    return (
      !f.confirmedBy &&
      f.value.trim() &&
      !f.ambiguity &&
      !hasConflict(f) &&
      !formatProblem(f.key, f.value) &&
      (!rule?.confirmRoles || (me && rule.confirmRoles.includes(me.role)))
    );
  });
  if (!eligible.length) return null;
  return (
    <div className="rounded border border-slate-300 bg-slate-50 p-2 text-sm">
      <button
        className="btn-secondary"
        onClick={() => {
          for (const f of eligible) if (!run({ type: "confirmHandoverField", actorId, transferId: transfer.id, key: f.key })) break;
        }}
      >
        I have reviewed these against the source — confirm {eligible.length} unflagged value{eligible.length === 1 ? "" : "s"} as {me?.name}
      </button>
      <p className="mt-1 text-xs text-slate-600">
        Skips anything flagged, conflicting, malformed or needing another role: {eligible.map((f) => fieldLabel(f.key)).join(", ")}.
      </p>
      <ErrorAlert error={error} />
    </div>
  );
}

export function SignOffSummary({ state, transfer }: { state: DemoState; transfer: TransferEpisode }) {
  if (!transfer.senderConfirmedBy) return <p className="text-sm text-amber-900">Not yet signed off by the sender.</p>;
  return (
    <p className="text-sm">
      Signed off by <strong>{practitioner(state, transfer.senderConfirmedBy)?.name}</strong> ({transfer.senderConfirmedRole}) at{" "}
      {fmt(transfer.senderConfirmedAt)}
    </p>
  );
}

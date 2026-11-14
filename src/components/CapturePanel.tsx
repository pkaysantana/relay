"use client";
import { useEffect, useId, useState } from "react";
import type { DemoState, TransferKind } from "@/core/types";
import { TRANSFER_KINDS } from "@/core/types";
import { PREPARED_DOCUMENTS } from "@/data/documents";
import { parseLabelledDocument } from "@/extraction/labelledParser";
import { listReceiverProfiles, RECEIVER_PROFILES } from "@/packs/receivers";
import { TRANSFER_KIND_CONFIG } from "@/packs/transferKinds";
import { getDemoState, useCommand } from "@/state/store";
import { ErrorAlert, Select } from "./ui";

/**
 * Handover capture: choose source document(s) (prepared or pasted), patient, transfer kind,
 * receiver profile and responsible sender. Runs the deterministic labelled parser and creates
 * a DRAFT. Nothing is confirmed or sent here.
 */
export function CapturePanel({ state, onCreated }: { state: DemoState; onCreated: (transferId: string) => void }) {
  const { run, error } = useCommand();
  const [open, setOpen] = useState(false);
  // Defaults point at the live-demo document of whichever demo set is loaded.
  const cataract = state.patients.some((p) => p.id === "pat-c5");
  const d = cataract
    ? { doc: "cdoc-E", patient: "pat-c5", kind: "provider-move" as TransferKind, profile: "independent-ophthalmology", sender: "prac-eye-1", by: "prac-eye-2" }
    : { doc: "doc-5", patient: "pat-5", kind: "discharge" as TransferKind, profile: "community-care", sender: "prac-ward-1", by: "prac-ward-1" };
  const docs = PREPARED_DOCUMENTS.filter((x) => state.patients.some((p) => p.id === x.intendedPatientId));
  const [docIds, setDocIds] = useState<string[]>([d.doc]);
  const [pasted, setPasted] = useState("");
  const [patientId, setPatientId] = useState(d.patient);
  const [kind, setKind] = useState<TransferKind>(d.kind);
  const profiles = listReceiverProfiles(kind, state.organizations.map((o) => o.id));
  const [profileChoice, setProfileChoice] = useState(d.profile);
  const profileId = profiles.some((p) => p.id === profileChoice) ? profileChoice : profiles[0]?.id ?? "";
  const profile = profiles.find((p) => p.id === profileId);
  const senders = state.practitioners.filter((p) => !profile || p.orgId !== profile.orgId);
  const [senderChoice, setSenderChoice] = useState(d.sender);
  const senderId = senders.some((p) => p.id === senderChoice) ? senderChoice : senders[0]?.id ?? "";
  const senderOrg = state.practitioners.find((p) => p.id === senderId)?.orgId;
  const capturers = state.practitioners.filter((p) => p.orgId === senderOrg);
  const [byChoice, setByChoice] = useState(d.by);
  const capturedBy = capturers.some((p) => p.id === byChoice) ? byChoice : senderId;
  const pasteId = useId();
  // Arriving from "Compare providers": open with the proposed provider pre-selected. Nothing is created
  // until the coordinator presses "Extract and create draft"; agreement and confirmation still follow.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("capture") !== "1") return;
    setOpen(true);
    const patient = q.get("patient");
    if (patient && state.patients.some((p) => p.id === patient)) {
      setPatientId(patient);
      const own = docs.filter((x) => x.intendedPatientId === patient).map((x) => x.id);
      if (own.length) setDocIds(own);
    }
    const prof = RECEIVER_PROFILES[q.get("profile") ?? ""];
    if (prof && state.organizations.some((o) => o.id === prof.orgId)) {
      setKind(prof.transferKinds.includes("provider-move") ? "provider-move" : prof.transferKinds[0]);
      setProfileChoice(prof.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!open)
    return (
      <button className="btn-primary" onClick={() => setOpen(true)}>
        + Capture a new handover
      </button>
    );

  const create = () => {
    const documents = docs.filter((x) => docIds.includes(x.id)).map((x) => ({ id: x.id, title: x.title, text: x.text }));
    if (pasted.trim()) documents.push({ id: `doc-pasted-${state.nextId}`, title: `Pasted document ${state.nextId}`, text: pasted });
    const parsed = documents.map((d) => parseLabelledDocument({ ...d, addedAt: "" }));
    const before = new Set(getDemoState().transfers.map((t) => t.id));
    const ok = run({
      type: "createHandover",
      actorId: capturedBy,
      patientId,
      sendingPractitionerId: senderId,
      transferKind: kind,
      receiverProfileId: profileId,
      documents,
      extracted: parsed.flatMap((p) => p.fields),
      warnings: parsed.flatMap((p) => p.warnings),
    });
    if (ok) {
      const created = getDemoState().transfers.find((t) => !before.has(t.id));
      if (created) onCreated(created.id);
      setOpen(false);
      setPasted("");
    }
  };

  return (
    <section className="card space-y-3" aria-label="Capture a new handover">
      <h2 className="font-semibold">Capture a new handover</h2>
      <fieldset>
        <legend className="label">1. Source documents (synthetic)</legend>
        <ul className="space-y-1">
          {docs.map((d) => (
            <li key={d.id}>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={docIds.includes(d.id)}
                  onChange={(e) => setDocIds(e.target.checked ? [...docIds, d.id] : docIds.filter((x) => x !== d.id))}
                />
                <span>
                  <strong>{d.title}</strong> <span className="text-slate-600">— {d.purpose}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        <label htmlFor={pasteId} className="label mt-2">
          …or paste a synthetic document (labelled lines, e.g. &quot;Patient ID: 999 000 0005&quot;)
        </label>
        <textarea id={pasteId} className="input font-mono" rows={4} value={pasted} onChange={(e) => setPasted(e.target.value)} />
      </fieldset>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Select
          label="2. Patient (synthetic record)"
          value={patientId}
          onChange={setPatientId}
          options={state.patients.map((p) => ({ value: p.id, label: `${p.displayName} · NHS ${p.nhsNumber ?? "—"}` }))}
        />
        <Select
          label="3. Transfer kind (context only)"
          value={kind}
          onChange={(v) => setKind(v as TransferKind)}
          options={TRANSFER_KINDS.map((k) => ({ value: k, label: TRANSFER_KIND_CONFIG[k].label }))}
        />
        <Select
          label="4. Receiving-service profile (chosen by you)"
          value={profileId}
          onChange={setProfileChoice}
          options={profiles.map((p) => ({ value: p.id, label: `${p.name} (v${p.version}, synthetic)` }))}
        />
        <Select
          label={`5. Responsible sending professional (${TRANSFER_KIND_CONFIG[kind].senderNoun.toLowerCase()})`}
          value={senderId}
          onChange={setSenderChoice}
          options={senders.map((p) => ({ value: p.id, label: `${p.name} — ${p.role}` }))}
        />
        <Select
          label="6. Captured by (you — recorded in the audit history)"
          value={capturedBy}
          onChange={setByChoice}
          options={capturers.map((p) => ({ value: p.id, label: `${p.name} — ${p.role}` }))}
        />
      </div>
      <p className="text-xs text-slate-600">
        The deterministic parser reads only explicitly labelled lines and keeps the exact source line as evidence. Nothing is confirmed
        automatically.
      </p>
      <ErrorAlert error={error} />
      <div className="flex gap-2">
        <button className="btn-primary" onClick={create}>
          Extract and create draft
        </button>
        <button className="btn-secondary" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </section>
  );
}

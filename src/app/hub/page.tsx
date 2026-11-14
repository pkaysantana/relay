"use client";
import { useId, useState } from "react";
import {
  missingRequiredFields,
  organization,
  patient,
  practitioner,
  tasksForTransfer,
  transferStatusLabel,
} from "@/core/selectors";
import type { DemoState, TransferEpisode } from "@/core/types";
import { toFhirBundle } from "@/fhir/toFhir";
import { getPack } from "@/packs";
import { useCommand, useDemoState } from "@/state/store";
import { EventLog } from "@/components/EventLog";
import { TaskCard } from "@/components/TaskCard";
import { TransferList } from "@/components/TransferList";
import { ErrorAlert, fmt, fromInput, Select, TextAction, toInput, TransferStatusBadge } from "@/components/ui";
import { CapturePanel } from "@/components/CapturePanel";
import { HandoverPanel, SignOffSummary } from "@/components/HandoverPanel";
import { handoverValidation } from "@/core/selectors";
import { getReceiverProfile } from "@/packs/receivers";
import { TRANSFER_KIND_CONFIG } from "@/packs/transferKinds";

function SignOffStep({ state, transfer, actorId }: { state: DemoState; transfer: TransferEpisode; actorId: string }) {
  const { run, error } = useCommand();
  const v = handoverValidation(state, transfer)!;
  const a = practitioner(state, actorId);
  const kind = TRANSFER_KIND_CONFIG[transfer.handover!.transferKind];
  return (
    <section className="card">
      <h2 className="font-semibold">Sign off the handover</h2>
      {v.blocking ? (
        <div role="status" className="mt-1 text-sm text-red-900">
          <strong>Awaiting sender confirmation — cannot be sent yet.</strong> Every required field must be GREEN and identity resolved:
          <ul className="ml-5 list-disc">
            {v.blockingReasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-1 text-sm text-green-900">All receiver-required information is present and confirmed. Ready for sign-off.</p>
      )}
      <p className="mt-2 text-sm">
        Signing as <strong>{a?.name}</strong> ({a?.role}). Allowed roles for a {kind.label.toLowerCase()}: {kind.signOffRoles.join(", ")}. An
        information-complete handover is not clinical acceptance by the receiver.
      </p>
      <button className="btn-primary mt-2" onClick={() => run({ type: "confirmSenderInfo", actorId, transferId: transfer.id, fields: {} })}>
        Sign off handover
      </button>
      <div className="mt-2">
        <ErrorAlert error={error} />
      </div>
    </section>
  );
}

function ClarifyStep({ transfer, actorId }: { transfer: TransferEpisode; actorId: string }) {
  const { run, error } = useCommand();
  return (
    <section className="card">
      <h2 className="font-semibold">Return the clarified handover</h2>
      <p className="text-sm">Receiver asked: “{transfer.clarificationQuestion}”. Correct or confirm fields above, then return it.</p>
      <div className="mt-2">
        <TextAction
          label="Send clarification"
          fieldLabel="Note to the receiving team"
          variant="primary"
          onSubmit={(note) => run({ type: "provideClarification", actorId, transferId: transfer.id, fields: {}, note })}
        />
      </div>
      <div className="mt-2">
        <ErrorAlert error={error} />
      </div>
    </section>
  );
}

export default function SendingHub() {
  const state = useDemoState();
  const [selected, setSelected] = useState("tr-D");
  const transfer = state.transfers.find((t) => t.id === selected);

  return (
    <div className="space-y-4">
      <CapturePanel state={state} onCreated={setSelected} />
      <div className="grid grid-cols-1 lg:grid-cols-[18rem_1fr] gap-6">
        <TransferList state={state} transfers={state.transfers} selectedId={selected} onSelect={setSelected} label="Outgoing transfers (sender view)" />
        {transfer ? <SenderDetail key={transfer.id} state={state} transfer={transfer} /> : <p>Select a transfer.</p>}
      </div>
    </div>
  );
}

function SenderDetail({ state, transfer }: { state: DemoState; transfer: TransferEpisode }) {
  const p = patient(state, transfer.patientId)!;
  const pack = getPack(transfer.packId);
  const actorId = transfer.sendingPractitionerId;
  const tasks = tasksForTransfer(state, transfer.id);
  const missing = transfer.handover ? [] : missingRequiredFields(transfer);
  const isHandover = !!transfer.handover;

  return (
    <div className="space-y-4">
      <section className="card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-semibold">
            {p.displayName} <span className="font-mono text-sm text-slate-600">{p.syntheticId}</span>
          </h1>
          <TransferStatusBadge status={transfer.status} label={transferStatusLabel(transfer)} />
        </div>
        <dl className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
          {transfer.handover && (
            <>
              <dt className="text-slate-600">Transfer kind</dt>
              <dd>{TRANSFER_KIND_CONFIG[transfer.handover.transferKind].label}</dd>
            </>
          )}
          <dt className="text-slate-600">Pathway pack (tasks)</dt>
          <dd>{pack.name}</dd>
          <dt className="text-slate-600">Sending (original responsibility)</dt>
          <dd>
            {practitioner(state, transfer.sendingPractitionerId)?.name} · {organization(state, transfer.sendingOrgId)?.name}
          </dd>
          <dt className="text-slate-600">Receiving</dt>
          <dd>
            {organization(state, transfer.receivingOrgId)?.name ?? "Not chosen"}
            {transfer.receivingPractitionerId
              ? ` · responsible: ${practitioner(state, transfer.receivingPractitionerId)?.name}`
              : transfer.receivingOrgId
                ? " · no named responsible professional yet"
                : ""}
          </dd>
          <dt className="text-slate-600">Planned discharge</dt>
          <dd>{fmt(transfer.plannedDischargeAt)}</dd>
          <dt className="text-slate-600">Initiated / acknowledged / accepted</dt>
          <dd>
            {fmt(transfer.initiatedAt)} / {fmt(transfer.acknowledgedAt)} / {fmt(transfer.acceptedAt)}
          </dd>
        </dl>
        {transfer.decisions.filter((d) => d.reason).map((d, i) => (
          <p key={i} className={`mt-2 rounded px-2 py-1 text-sm ${d.outcome === "rejected" ? "bg-red-50 text-red-950" : "bg-amber-50 text-amber-950"}`}>
            <strong>{d.outcome === "rejected" ? "Rejected" : "Clarification requested"}</strong> by {practitioner(state, d.by)?.name}, {fmt(d.at)}: {d.reason}
          </p>
        ))}
      </section>

      {isHandover && (
        <>
          <HandoverPanel state={state} transfer={transfer} mode="sender" actorId={actorId} />
          {transfer.status === "draft" && <SignOffStep state={state} transfer={transfer} actorId={actorId} />}
          {transfer.status === "clarification-requested" && <ClarifyStep transfer={transfer} actorId={actorId} />}
          {transfer.status !== "draft" && (
            <section className="card">
              <SignOffSummary state={state} transfer={transfer} />
            </section>
          )}
        </>
      )}
      {!isHandover && ["draft", "info-confirmed", "clarification-requested"].includes(transfer.status) && (
        <FieldsStep state={state} transfer={transfer} actorId={actorId} />
      )}
      {!isHandover && !["draft", "info-confirmed", "clarification-requested"].includes(transfer.status) && (
        <section className="card">
          <h2 className="font-semibold mb-2">Transfer information</h2>
          {missing.length > 0 && (
            <p role="status" className="mb-2 rounded bg-amber-100 px-2 py-1 text-sm text-amber-950">
              ⚠ Missing required information: {missing.map((k) => pack.requiredFields.find((f) => f.key === k)?.label).join("; ")}. The receiving service cannot accept until it is supplied.
            </p>
          )}
          <dl className="grid grid-cols-1 sm:grid-cols-[14rem_1fr] gap-x-4 gap-y-1 text-sm">
            {[...pack.requiredFields, ...pack.extraFields].map((f) => (
              <div key={f.key} className="contents">
                <dt className="text-slate-600">{f.label}</dt>
                <dd>{transfer.fields[f.key]?.trim() || <em className="text-red-800">Not provided</em>}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {transfer.status === "info-confirmed" && <GenerateStep transfer={transfer} actorId={actorId} />}
      {transfer.status === "handover-ready" && <SendStep state={state} transfer={transfer} actorId={actorId} />}
      {transfer.status === "rejected" && <RedirectStep state={state} transfer={transfer} actorId={actorId} />}

      {tasks.length > 0 && transfer.status !== "handover-ready" && (
        <section>
          <h2 className="font-semibold mb-2">Required actions</h2>
          <ul className="space-y-3">
            {tasks.map((k) => (
              <TaskCard key={k.id} task={k} state={state} side="sender" actorId={actorId} />
            ))}
          </ul>
        </section>
      )}

      {transfer.initiatedAt && <FhirExport state={state} transferId={transfer.id} />}
      <EventLog state={state} transferId={transfer.id} title="History of this transfer" />
    </div>
  );
}

function FieldsStep({ state, transfer, actorId }: { state: DemoState; transfer: TransferEpisode; actorId: string }) {
  const pack = getPack(transfer.packId);
  const { run, error } = useCommand();
  const [fields, setFields] = useState<Record<string, string>>({ ...transfer.fields });
  const [note, setNote] = useState("");
  const noteId = useId();
  const clarifying = transfer.status === "clarification-requested";
  const missingNow = pack.requiredFields.filter((f) => !(fields[f.key] ?? "").trim());

  return (
    <section className="card">
      <h2 className="font-semibold">{clarifying ? "Respond to clarification request" : "1. Review and confirm the sending team's information"}</h2>
      {clarifying && (
        <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-sm">
          <strong>Question:</strong> {transfer.clarificationQuestion}
        </p>
      )}
      <form
        className="mt-3 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (clarifying) run({ type: "provideClarification", actorId, transferId: transfer.id, fields, note });
          else run({ type: "confirmSenderInfo", actorId, transferId: transfer.id, fields });
        }}
      >
        {[...pack.requiredFields.map((f) => ({ ...f, required: true })), ...pack.extraFields.map((f) => ({ ...f, required: false }))].map((f) => {
          const empty = f.required && !(fields[f.key] ?? "").trim();
          const Input = f.long ? "textarea" : "input";
          return (
            <div key={f.key}>
              <label htmlFor={`f-${f.key}`} className="label">
                {f.label} {f.required ? <span className="text-red-800">(required)</span> : <span className="text-slate-500">(optional)</span>}
              </label>
              <Input
                id={`f-${f.key}`}
                className={`input ${empty ? "border-amber-500 bg-amber-50" : ""}`}
                aria-invalid={empty || undefined}
                value={fields[f.key] ?? ""}
                onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setFields({ ...fields, [f.key]: e.target.value })}
                {...(f.long ? { rows: 2 } : {})}
              />
            </div>
          );
        })}
        {clarifying && (
          <div>
            <label htmlFor={noteId} className="label">
              Clarification note to receiving team
            </label>
            <textarea id={noteId} className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        )}
        {missingNow.length > 0 && (
          <p role="status" className="text-sm text-amber-900">
            ⚠ {missingNow.length} required field(s) empty. You can still confirm, but the gap will be visible and the receiving service cannot accept until it is filled.
          </p>
        )}
        <ErrorAlert error={error} />
        <button type="submit" className="btn-primary">
          {clarifying ? "Send clarification" : transfer.status === "info-confirmed" ? "Re-confirm information" : "I confirm this information"}
        </button>
        {transfer.senderConfirmedBy && !clarifying && (
          <span className="ml-2 text-sm text-slate-600">
            Confirmed by {practitioner(state, transfer.senderConfirmedBy)?.name}, {fmt(transfer.senderConfirmedAt)}
          </span>
        )}
      </form>
    </section>
  );
}

function GenerateStep({ transfer, actorId }: { transfer: TransferEpisode; actorId: string }) {
  const { run, error } = useCommand();
  const pack = getPack(transfer.packId);
  return (
    <section className="card">
      <h2 className="font-semibold">2. Generate the structured handover</h2>
      <p className="text-sm text-slate-700 mt-1">
        The <strong>{pack.name}</strong> pack will create {pack.taskTemplates.length} required actions: {pack.taskTemplates.map((t) => t.label).join("; ")}.
      </p>
      <div className="mt-3 flex gap-2">
        <button className="btn-primary" onClick={() => run({ type: "generateHandover", actorId, transferId: transfer.id })}>
          Generate handover
        </button>
      </div>
      <div className="mt-2">
        <ErrorAlert error={error} />
      </div>
    </section>
  );
}

function SendStep({ state, transfer, actorId }: { state: DemoState; transfer: TransferEpisode; actorId: string }) {
  const { run, error } = useCommand();
  const pack = getPack(transfer.packId);
  const drafts = tasksForTransfer(state, transfer.id).filter((k) => k.status === "draft");
  const [org, setOrg] = useState(transfer.handover ? getReceiverProfile(transfer.handover.receiverProfileId).orgId : "");
  const [confirmed, setConfirmed] = useState(false);
  const [deadlines, setDeadlines] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      drafts.map((k) => {
        const h = pack.taskTemplates.find((t) => t.id === k.templateId)?.suggestedDueHours;
        return [k.id, h ? toInput(new Date(Date.parse(state.now) + h * 3_600_000).toISOString()) : ""];
      }),
    ),
  );
  const confirmId = useId();

  return (
    <section className="card">
      <h2 className="font-semibold">3. Confirm deadlines and send</h2>
      <p className="text-sm text-slate-700 mt-1">Suggested deadlines are placeholders from the pathway pack. A clinician must confirm or change each one.</p>
      <ul className="mt-3 space-y-3">
        {drafts.map((k) => (
          <li key={k.id} className="rounded border border-slate-200 p-3">
            <div className="font-medium">{k.description}</div>
            <div className="text-xs text-slate-600">Owner role: {pack.roles.find((r) => r.code === k.ownerRole)?.label ?? k.ownerRole}</div>
            <label htmlFor={`due-${k.id}`} className="label mt-2">
              Deadline (UTC)
            </label>
            <input
              id={`due-${k.id}`}
              type="datetime-local"
              className="input max-w-xs"
              value={deadlines[k.id] ?? ""}
              onChange={(e) => setDeadlines({ ...deadlines, [k.id]: e.target.value })}
            />
            <p className="text-xs text-slate-500 mt-1">{k.timingNote}</p>
          </li>
        ))}
      </ul>
      <div className="mt-3 max-w-sm">
        <Select
          label="Receiving organisation"
          value={org}
          onChange={setOrg}
          placeholder="— choose —"
          options={state.organizations.filter((o) => o.id !== transfer.sendingOrgId).map((o) => ({ value: o.id, label: o.name }))}
        />
      </div>
      <div className="mt-3 flex items-start gap-2">
        <input id={confirmId} type="checkbox" className="mt-1" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
        <label htmlFor={confirmId} className="text-sm">
          I, {practitioner(state, actorId)?.name}, confirm these deadlines are clinically appropriate for this patient.
        </label>
      </div>
      <div className="mt-3">
        <button
          className="btn-primary"
          disabled={!confirmed}
          onClick={() =>
            run({
              type: "sendTransfer",
              actorId,
              transferId: transfer.id,
              receivingOrgId: org,
              deadlines: Object.fromEntries(Object.entries(deadlines).map(([id, v]) => [id, fromInput(v)])),
            })
          }
        >
          Send transfer
        </button>
      </div>
      <div className="mt-2">
        <ErrorAlert error={error} />
      </div>
    </section>
  );
}

function RedirectStep({ state, transfer, actorId }: { state: DemoState; transfer: TransferEpisode; actorId: string }) {
  const { run, error } = useCommand();
  const [org, setOrg] = useState("");
  return (
    <section className="card border-red-300">
      <h2 className="font-semibold text-red-900">Unresolved: the receiving service rejected this transfer</h2>
      <p className="text-sm mt-1">Responsibility stays with the sending team until another service accepts it.</p>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <Select
          label="Redirect to"
          value={org}
          onChange={setOrg}
          placeholder="— choose organisation —"
          options={state.organizations
            .filter((o) => o.id !== transfer.sendingOrgId && o.id !== transfer.receivingOrgId)
            .map((o) => ({ value: o.id, label: o.name }))}
        />
        {org && (
          <TextAction
            label="Redirect transfer"
            fieldLabel="Note to the new receiving service"
            variant="primary"
            onSubmit={(note) => run({ type: "redirectTransfer", actorId, transferId: transfer.id, receivingOrgId: org, note })}
          />
        )}
      </div>
      <div className="mt-2">
        <ErrorAlert error={error} />
      </div>
    </section>
  );
}

function FhirExport({ state, transferId }: { state: DemoState; transferId: string }) {
  const json = JSON.stringify(toFhirBundle(state, transferId), null, 2);
  return (
    <details className="card">
      <summary className="cursor-pointer font-semibold">FHIR R4-shaped export (unvalidated)</summary>
      <p className="mt-2 text-xs text-slate-600">
        Illustrative mapping only. Not validated against FHIR R4 or UK Core profiles. No NHS system is claimed to consume this.
      </p>
      <button
        className="btn-secondary mt-2"
        onClick={() => {
          const url = URL.createObjectURL(new Blob([json], { type: "application/fhir+json" }));
          const a = document.createElement("a");
          a.href = url;
          a.download = `${transferId}-bundle.json`;
          a.click();
          URL.revokeObjectURL(url);
        }}
      >
        Download JSON
      </button>
      <pre className="mt-2 max-h-80 overflow-auto rounded bg-slate-900 p-3 text-xs text-slate-100">{json}</pre>
    </details>
  );
}

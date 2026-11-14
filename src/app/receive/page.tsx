"use client";
import { useState } from "react";
import {
  transferBlockers,
  organization,
  patient,
  practitioner,
  transferStatusLabel,
} from "@/core/selectors";
import type { DemoState, TransferEpisode } from "@/core/types";
import { getPack } from "@/packs";
import { useCommand, useDemoState } from "@/state/store";
import { TaskCard } from "@/components/TaskCard";
import { EventLog } from "@/components/EventLog";
import { HandoverPanel, SignOffSummary } from "@/components/HandoverPanel";
import { TRANSFER_KIND_CONFIG } from "@/packs/transferKinds";
import { listReceiverProfiles } from "@/packs/receivers";
import { TransferList } from "@/components/TransferList";
import { ErrorAlert, fmt, Select, TextAction, TransferStatusBadge } from "@/components/ui";

export default function ReceivingView() {
  const state = useDemoState();
  // Receiving organisations = those with a registered receiver profile or an incoming transfer.
  const receivingOrgs = state.organizations.filter(
    (o) => listReceiverProfiles(undefined, [o.id]).length > 0 || state.transfers.some((t) => t.receivingOrgId === o.id),
  );
  const [orgChoice, setOrgId] = useState<string | undefined>();
  const orgId =
    orgChoice && receivingOrgs.some((o) => o.id === orgChoice)
      ? orgChoice
      : (receivingOrgs.find((o) => state.transfers.some((t) => t.receivingOrgId === o.id)) ?? receivingOrgs[0])?.id ?? "";
  const staff = state.practitioners.filter((p) => p.orgId === orgId);
  const [actorChoice, setActorChoice] = useState("");
  const actorId = staff.some((p) => p.id === actorChoice) ? actorChoice : staff[0]?.id ?? "";
  const [selected, setSelected] = useState<string | undefined>();

  const inbox = state.transfers.filter(
    (t) => t.receivingOrgId === orgId || state.tasks.some((k) => k.transferId === t.id && k.ownerOrgId === orgId),
  );
  const transfer = inbox.find((t) => t.id === selected) ?? inbox[0];

  return (
    <div className="space-y-4">
      <section className="card flex flex-wrap gap-4 items-end">
        <div className="min-w-64">
          <Select
            label="Receiving organisation"
            value={orgId}
            onChange={(v) => {
              setOrgId(v);
              setSelected(undefined);
            }}
            options={receivingOrgs.map((o) => ({ value: o.id, label: o.name }))}
          />
        </div>
        <div className="min-w-64">
          <Select label="Acting as" value={actorId} onChange={setActorChoice} options={staff.map((p) => ({ value: p.id, label: p.name }))} />
        </div>
        <p className="text-sm text-slate-600">Simulated receiving organisation. All staff are fictional.</p>
      </section>
      <div className="grid grid-cols-1 lg:grid-cols-[18rem_1fr] gap-6">
        <TransferList state={state} transfers={inbox} selectedId={transfer?.id} onSelect={setSelected} label="Inbox" />
        {transfer ? (
          <ReceiverDetail key={`${transfer.id}-${orgId}`} state={state} transfer={transfer} orgId={orgId} actorId={actorId} />
        ) : (
          <p className="text-sm text-slate-600">No transfers have been sent to this organisation.</p>
        )}
      </div>
    </div>
  );
}

function ReceiverDetail({
  state,
  transfer,
  orgId,
  actorId,
}: {
  state: DemoState;
  transfer: TransferEpisode;
  orgId: string;
  actorId: string;
}) {
  const { run, error } = useCommand();
  const [responsible, setResponsible] = useState("");
  const pack = getPack(transfer.packId);
  const p = patient(state, transfer.patientId)!;
  const blockers = transferBlockers(state, transfer);
  const isReceiver = transfer.receivingOrgId === orgId;
  const tasks = state.tasks.filter((k) => k.transferId === transfer.id && k.ownerOrgId === orgId);
  const staff = state.practitioners.filter((x) => x.orgId === orgId);

  return (
    <div className="space-y-4">
      <section className="card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-semibold">
            {p.displayName} <span className="font-mono text-sm text-slate-600">{p.syntheticId}</span>
          </h1>
          <TransferStatusBadge status={transfer.status} label={transferStatusLabel(transfer)} />
        </div>
        <p className="text-sm mt-1">
          {transfer.handover ? `${TRANSFER_KIND_CONFIG[transfer.handover.transferKind].label} · ` : ""}
          From {practitioner(state, transfer.sendingPractitionerId)?.name}, {organization(state, transfer.sendingOrgId)?.name} · sent {fmt(transfer.initiatedAt)}
        </p>
        {transfer.handover && <SignOffSummary state={state} transfer={transfer} />}
        {transfer.handover && transfer.status === "accepted" && (
          <p className="mt-1 text-xs text-slate-600">{TRANSFER_KIND_CONFIG[transfer.handover.transferKind].simulatedNextStep}</p>
        )}
        {blockers.length > 0 && (
          <div role="status" className="mt-2 rounded bg-amber-100 px-2 py-1 text-sm text-amber-950">
            ⚠ Acceptance is blocked: {blockers.join("; ")}. Request clarification or reject.
          </div>
        )}
        {!transfer.handover && (
          <dl className="mt-3 grid grid-cols-1 sm:grid-cols-[14rem_1fr] gap-x-4 gap-y-1 text-sm">
            {[...pack.requiredFields, ...pack.extraFields].map((f) => (
              <div key={f.key} className="contents">
                <dt className="text-slate-600">{f.label}</dt>
                <dd>{transfer.fields[f.key]?.trim() || <em className="text-red-800">Not provided</em>}</dd>
              </div>
            ))}
          </dl>
        )}
        {transfer.status === "received" && (
          <p className="mt-2 text-xs text-slate-700">
            Complete information is not clinical acceptance. Accepting means a named professional here takes responsibility.
          </p>
        )}
      </section>
      {transfer.decisions.length > 0 && (
        <section className="card" aria-label="Decisions">
          <h2 className="font-semibold mb-1">Decisions on responsibility</h2>
          <ul className="space-y-1 text-sm">
            {transfer.decisions.map((d, i) => {
              const who = practitioner(state, d.by);
              return (
                <li key={i}>
                  <strong>{d.outcome}</strong> by {who?.name} ({who?.role}), {fmt(d.at)}
                  {d.reason ? `: ${d.reason}` : ""}
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {transfer.handover && <HandoverPanel state={state} transfer={transfer} mode="receiver" actorId={actorId} />}

      {isReceiver && ["sent", "received", "clarification-requested"].includes(transfer.status) && (
        <section className="card space-y-3" aria-label="Decision on responsibility">
          <h2 className="font-semibold">Responsibility decision</h2>
          {transfer.status === "sent" && (
            <div>
              <button className="btn-secondary" onClick={() => run({ type: "acknowledgeTransfer", actorId, transferId: transfer.id })}>
                Acknowledge receipt
              </button>
              <p className="text-xs text-slate-600 mt-1">Acknowledging receipt does not accept responsibility.</p>
            </div>
          )}
          {transfer.status === "received" && (
            <div className="flex flex-wrap items-end gap-2">
              <Select
                label="Named responsible professional (required)"
                value={responsible}
                onChange={setResponsible}
                placeholder="— choose —"
                options={staff.map((x) => ({ value: x.id, label: x.name }))}
              />
              <button
                className="btn-primary"
                onClick={() =>
                  run({ type: "acceptTransfer", actorId, transferId: transfer.id, responsiblePractitionerId: responsible || undefined })
                }
              >
                Accept responsibility
              </button>
            </div>
          )}
          {transfer.status === "clarification-requested" && (
            <p className="text-sm">Waiting for the sending team to answer: “{transfer.clarificationQuestion}”</p>
          )}
          <div className="flex flex-wrap gap-2">
            {["sent", "received"].includes(transfer.status) && (
              <TextAction
                label="Request clarification"
                fieldLabel="What do you need from the sending team?"
                onSubmit={(question) => run({ type: "requestClarification", actorId, transferId: transfer.id, question })}
              />
            )}
            <TextAction
              label="Reject transfer"
              fieldLabel="Why can this service not accept responsibility?"
              variant="danger"
              onSubmit={(reason) => run({ type: "rejectTransfer", actorId, transferId: transfer.id, reason })}
            />
          </div>
          <ErrorAlert error={error} />
        </section>
      )}

      <section>
        <h2 className="font-semibold mb-2">Actions assigned to this organisation</h2>
        <ul className="space-y-3">
          {tasks.map((k) => (
            <TaskCard key={k.id} task={k} state={state} side="receiver" actorId={actorId} />
          ))}
          {tasks.length === 0 && <li className="text-sm text-slate-600">None.</li>}
        </ul>
      </section>
      <EventLog state={state} transferId={transfer.id} title="History of this transfer" />
    </div>
  );
}

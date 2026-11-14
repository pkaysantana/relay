/**
 * Minimal adapter: Doorstep domain -> FHIR R4-shaped JSON (Bundle of Patient, Organization,
 * PractitionerRole, ServiceRequest, Task).
 *
 * NOT VALIDATED against the FHIR R4 specification or any NHS / UK Core profile. Do not claim
 * conformance, and do not claim any NHS system can consume this output.
 * Domain types never import from here — serialisation is one-way.
 */
import { isOverdue } from "@/core/selectors";
import type { CareTask, DemoState, TransferEpisode } from "@/core/types";

type Json = Record<string, unknown>;
const SYS = "urn:doorstep:synthetic";
const ref = (type: string, id: string) => ({ reference: `${type}/${id}` });

function serviceRequestStatus(t: TransferEpisode): string {
  switch (t.status) {
    case "draft":
    case "info-confirmed":
    case "handover-ready":
      return "draft";
    case "rejected":
      return "revoked";
    default:
      return "active";
  }
}

function taskResource(task: CareTask, state: DemoState): Json {
  const businessStatus = isOverdue(task, state.now)
    ? "overdue"
    : task.scheduledFor && task.status !== "completed"
      ? "scheduled"
      : undefined;
  return {
    resourceType: "Task",
    id: task.id,
    status: task.status,
    ...(task.statusReason ? { statusReason: { text: task.statusReason } } : {}),
    ...(businessStatus ? { businessStatus: { text: businessStatus } } : {}),
    intent: "order",
    code: { text: task.templateId },
    description: task.description,
    basedOn: [ref("ServiceRequest", task.transferId)],
    focus: ref("ServiceRequest", task.transferId),
    for: ref("Patient", state.transfers.find((t) => t.id === task.transferId)!.patientId),
    authoredOn: state.events.find((e) => e.taskId === task.id)?.at,
    lastModified: [...state.events].reverse().find((e) => e.taskId === task.id)?.at,
    requester: ref("PractitionerRole", task.requesterPractitionerId),
    ...(task.ownerPractitionerId
      ? { owner: ref("PractitionerRole", task.ownerPractitionerId) }
      : task.ownerOrgId
        ? { owner: ref("Organization", task.ownerOrgId) }
        : {}),
    ...(task.dueAt ? { restriction: { period: { end: task.dueAt } } } : {}),
    ...(task.scheduledFor ? { executionPeriod: { start: task.scheduledFor } } : {}),
    note: [
      ...task.escalations.map((e) => ({ time: e.at, text: `Escalation: ${e.note}` })),
      ...task.blockers.map((b) => ({ time: b.raisedAt, text: `Blocker${b.resolvedAt ? " (resolved)" : ""}: ${b.note}` })),
    ],
    ...(task.evidence
      ? {
          output: [
            {
              type: { text: `evidence:${task.evidence.kind}` },
              valueString: task.evidence.summary,
            },
          ],
        }
      : {}),
  };
}

export function toFhirBundle(state: DemoState, transferId: string): Json {
  const t = state.transfers.find((x) => x.id === transferId);
  if (!t) throw new Error(`Transfer ${transferId} not found`);
  const patient = state.patients.find((p) => p.id === t.patientId)!;
  const tasks = state.tasks.filter((k) => k.transferId === t.id);
  const orgIds = new Set([t.sendingOrgId, t.receivingOrgId, ...tasks.map((k) => k.ownerOrgId)].filter(Boolean) as string[]);
  const pracIds = new Set(
    [t.sendingPractitionerId, t.receivingPractitionerId, ...tasks.flatMap((k) => [k.ownerPractitionerId, k.requesterPractitionerId])].filter(Boolean) as string[],
  );

  const resources: Json[] = [
    {
      resourceType: "Patient",
      id: patient.id,
      meta: { tag: [{ system: SYS, code: "synthetic", display: "Synthetic test data" }] },
      identifier: [{ system: `${SYS}:patient`, value: patient.syntheticId }],
      name: [{ text: patient.displayName }],
    },
    ...[...orgIds].map((id) => {
      const o = state.organizations.find((x) => x.id === id)!;
      return { resourceType: "Organization", id: o.id, name: o.name };
    }),
    ...[...pracIds].map((id) => {
      const p = state.practitioners.find((x) => x.id === id)!;
      return {
        resourceType: "PractitionerRole",
        id: p.id,
        organization: ref("Organization", p.orgId),
        code: [{ text: p.role }],
        practitioner: { display: p.name },
      };
    }),
    {
      resourceType: "ServiceRequest",
      id: t.id,
      status: serviceRequestStatus(t),
      intent: "order",
      code: { text: `Transfer of care (${t.packId} pathway pack)` },
      subject: ref("Patient", patient.id),
      requester: ref("PractitionerRole", t.sendingPractitionerId),
      ...(t.receivingOrgId ? { performer: [ref("Organization", t.receivingOrgId)] } : {}),
      ...(t.initiatedAt ? { authoredOn: t.initiatedAt } : {}),
      note: Object.entries(t.fields)
        .filter(([, v]) => v.trim())
        .map(([k, v]) => ({ text: `${k}: ${v}` })),
    },
    ...tasks.map((k) => taskResource(k, state)),
  ];

  return {
    resourceType: "Bundle",
    type: "collection",
    timestamp: state.now,
    meta: {
      tag: [
        { system: SYS, code: "synthetic", display: "Synthetic demonstration data" },
        { system: SYS, code: "unvalidated", display: "FHIR R4-shaped; not validated against any profile" },
      ],
    },
    entry: resources.map((r) => ({ fullUrl: `${SYS}:${r.resourceType}/${r.id}`, resource: r })),
  };
}

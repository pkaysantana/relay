/**
 * Neutral, disease-agnostic pack used to demonstrate the framework.
 * Contains no clinical decision logic. All timings are placeholders pending clinician sign-off.
 */
import type { PathwayPack } from "./types";

const PLACEHOLDER =
  "Placeholder timing — not clinically validated. The sending clinician must confirm or change it.";

export const generalPack: PathwayPack = {
  id: "general",
  name: "General transfer of care",
  description:
    "Generic hospital-to-community handover. Demonstrates required information, explicit acceptance, task ownership, deadlines and evidence of completion without assuming a condition.",
  requiredFields: [
    { key: "episodeSummary", label: "Episode summary", long: true },
    { key: "currentStatus", label: "Current status at transfer", long: true },
    {
      key: "actionsRequested",
      label: "Actions requested of the receiving service",
      long: true,
    },
    { key: "patientInformed", label: "Patient / carer informed of handover (yes/no)" },
    { key: "queryContact", label: "Sending team contact for queries" },
  ],
  extraFields: [{ key: "accessNotes", label: "Access / home visit notes", long: true }],
  roles: [
    { code: "discharging-clinician", label: "Discharging clinician" },
    { code: "receiving-clinician", label: "Receiving clinician" },
    { code: "care-coordinator", label: "Care coordinator" },
    { code: "gp", label: "General practitioner" },
  ],
  taskTemplates: [
    {
      id: "first-contact",
      label: "First care contact by the receiving service",
      ownerRole: "receiving-clinician",
      suggestedDueHours: 48,
      timingNote: PLACEHOLDER,
      marksFirstCareContact: true,
    },
    {
      id: "review-handover-actions",
      label: "Review and action the requests in the handover",
      ownerRole: "receiving-clinician",
      suggestedDueHours: 72,
      timingNote: PLACEHOLDER,
    },
    {
      id: "agree-plan",
      label: "Agree the ongoing care plan with the patient / carer",
      ownerRole: "care-coordinator",
      suggestedDueHours: 120,
      timingNote: PLACEHOLDER,
    },
  ],
  references: [
    {
      label:
        "NICE NG27 — Transition between inpatient hospital settings and community or care home settings for adults with social care needs (2015)",
      note: "Context only. This prototype does not implement or assert compliance with any guideline.",
    },
  ],
  qualityMeasures: [
    {
      id: "complete-at-send",
      label: "Transfers sent with all required information",
      description:
        "Share of initiated transfers whose required fields were all present when they were sent.",
      evaluate: ({ transfers, state }) => {
        const sent = transfers.filter((t) => t.initiatedAt);
        const complete = sent.filter((t) =>
          state.events.some(
            (e) =>
              e.transferId === t.id &&
              e.type === "sendTransfer" &&
              Array.isArray(e.data?.missingFields) &&
              (e.data.missingFields as unknown[]).length === 0,
          ),
        );
        return { numerator: complete.length, denominator: sent.length };
      },
    },
  ],
};

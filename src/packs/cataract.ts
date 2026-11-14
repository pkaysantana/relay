/**
 * Cataract pathway pack — NHS hospital eye service → NHS-funded independent-sector provider
 * (transfer kind "provider-move"). WORKING DEMONSTRATION NICHE.
 *
 * Illustrative — pending clinician sign-off. Configuration only: no suitability rules, no
 * clinical decision logic, no capacity or waiting-time data. The sending team has already made
 * the decision to offer surgery; this pack only defines the follow-up actions to track.
 * Pathway context: NICE NG77 (Cataracts in adults: management). No claim of NICE or RCOphth compliance.
 */
import type { PathwayPack } from "./types";

const ILLUSTRATIVE = "Illustrative — pending clinician sign-off.";

export const cataractPack: PathwayPack = {
  id: "cataract-provider-move",
  name: "Cataract surgery — transfer to an alternative NHS-funded provider (illustrative)",
  description:
    "Tracks the handover of an already-assessed elective cataract patient from an NHS hospital eye service to another provider until the receiving provider has accepted, booked and recorded the outcome. Booking is a milestone, not treatment.",
  // Legacy fallback only (handover transfers are validated by the receiver profile).
  requiredFields: [
    { key: "treatmentPlan", label: "Documented treatment plan", long: true },
    { key: "laterality", label: "Eye (laterality) for the proposed procedure" },
    { key: "providerTransferAgreement", label: "Patient agreement to the alternative provider" },
  ],
  extraFields: [],
  roles: [
    { code: "ophthalmologist", label: "Sending ophthalmologist (responsible clinician)" },
    { code: "pathway-coordinator", label: "Sending elective pathway coordinator (monitor / escalation contact)" },
    { code: "ophthalmic-surgeon", label: "Receiving ophthalmic surgeon" },
    { code: "receiving-coordinator", label: "Receiving provider pathway coordinator" },
  ],
  escalationRole: "pathway-coordinator",
  taskTemplates: [
    {
      id: "book-first-appointment",
      label: "Record booking of the first appointment at the receiving provider (booking is not treatment)",
      ownerRole: "receiving-coordinator",
      suggestedDueHours: 96,
      timingNote: `Synthetic administrative review deadline (4 days) — NOT a national NHS standard. ${ILLUSTRATIVE}`,
      marksAppointmentBooked: true,
    },
    {
      id: "preop-assessment",
      label: "Pre-operative assessment attended at the receiving provider",
      ownerRole: "ophthalmic-surgeon",
      suggestedDueHours: 21 * 24,
      timingNote: `Placeholder timing. ${ILLUSTRATIVE}`,
      evidenceRef: "NICE NG77 (context only)",
      marksFirstCareContact: true,
    },
    {
      id: "surgery-outcome",
      label: "Record whether surgery took place and its outcome; return the discharge summary to the sending service",
      ownerRole: "ophthalmic-surgeon",
      suggestedDueHours: 56 * 24,
      timingNote: `Placeholder timing. ${ILLUSTRATIVE}`,
    },
  ],
  references: [
    {
      label: "NICE NG77 — Cataracts in adults: management (2017)",
      note: "Pathway context only. This prototype does not implement or claim compliance with NICE or RCOphth guidance.",
    },
  ],
  qualityMeasures: [
    {
      id: "booking-recorded",
      label: "Accepted cataract transfers with a recorded first-appointment booking",
      description: "Synthetic: accepted transfers whose booking task has been completed with evidence. Booking is not treatment.",
      evaluate: ({ transfers, tasks }) => {
        const accepted = transfers.filter((t) => t.acceptedAt);
        const booked = accepted.filter((t) =>
          tasks.some((k) => k.transferId === t.id && k.templateId === "book-first-appointment" && k.status === "completed"),
        );
        return { numerator: booked.length, denominator: accepted.length };
      },
    },
  ],
};

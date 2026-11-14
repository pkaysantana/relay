/**
 * FICTIONAL provider catalogue, patient preferences and documented requirements for the
 * provider-comparison demonstration. Every wait, distance, capability and availability value is
 * SIMULATED. No real providers, CQC ratings, waiting times, outcomes or capacity data.
 *
 * Documented clinical requirements are quoted verbatim from the synthetic source documents
 * (tests check the quotes). Nothing here derives clinical risk from age, falls, medicines, etc.
 */
import type { DocumentedRequirement, PatientPreferences, ProviderEntry } from "./shortlist";

export const SIMULATED_NOTE =
  "All waits, distances, capabilities and availability shown here are simulated for demonstration. They are not real provider data.";

export const PROVIDER_CATALOGUE: ProviderEntry[] = [
  {
    id: "northgate",
    name: "Northgate Hospital Eye Service (NHS) — current provider",
    sector: "NHS",
    orgId: "org-eye",
    isCurrentProvider: true,
    estimatedWaitWeeks: 22,
    distanceKm: { "pat-c5": 8, "pat-c4": 6, "pat-c2": 10 },
    availability: "confirmed",
    capabilities: { generalAnaesthesia: "yes", localAnaesthesia: "yes", complexCases: "yes", additionalPreopAssessment: "yes" },
    transport: "yes",
    access: { stepFreeAccess: "yes", writtenCommunication: "yes", interpreter: "yes" },
  },
  {
    id: "brookfield",
    name: "Brookfield Eye Centre (independent sector, NHS-funded)",
    sector: "Independent (NHS-funded)",
    orgId: "org-isp",
    receiverProfileId: "independent-ophthalmology",
    estimatedWaitWeeks: 6,
    distanceKm: { "pat-c5": 32, "pat-c4": 22, "pat-c2": 18 },
    availability: "unconfirmed",
    capabilities: { generalAnaesthesia: "no", localAnaesthesia: "yes", complexCases: "unknown", additionalPreopAssessment: "yes" },
    transport: "no",
    access: { stepFreeAccess: "yes", writtenCommunication: "yes", interpreter: "unknown" },
  },
  {
    id: "westmoor",
    name: "Westmoor Hospital Ophthalmology (NHS)",
    sector: "NHS",
    orgId: "org-westmoor",
    receiverProfileId: "nhs-ophthalmology",
    estimatedWaitWeeks: 14,
    distanceKm: { "pat-c5": 12, "pat-c4": 9, "pat-c2": 25 },
    availability: "unconfirmed",
    capabilities: { generalAnaesthesia: "yes", localAnaesthesia: "yes", complexCases: "yes", additionalPreopAssessment: "yes" },
    transport: "yes",
    access: { stepFreeAccess: "yes", writtenCommunication: "yes", interpreter: "yes" },
  },
  {
    id: "ashdown",
    name: "Ashdown Eye Clinic (fictional independent provider)",
    sector: "Independent (NHS-funded)",
    estimatedWaitWeeks: 4,
    distanceKm: { "pat-c5": 55, "pat-c4": 40, "pat-c2": null },
    availability: "unconfirmed",
    capabilities: { generalAnaesthesia: "unknown", localAnaesthesia: "yes", complexCases: "unknown", additionalPreopAssessment: "unknown" },
    transport: "unknown",
    access: { stepFreeAccess: "unknown", writtenCommunication: "unknown", interpreter: "unknown" },
  },
  {
    id: "lakeside",
    name: "Lakeside Treatment Centre (fictional NHS provider)",
    sector: "NHS",
    estimatedWaitWeeks: null,
    distanceKm: { "pat-c5": 20, "pat-c4": 18, "pat-c2": 30 },
    availability: "unavailable",
    capabilities: { generalAnaesthesia: "unknown", localAnaesthesia: "unknown", complexCases: "unknown", additionalPreopAssessment: "unknown" },
    transport: "unknown",
    access: { stepFreeAccess: "unknown", writtenCommunication: "unknown", interpreter: "unknown" },
  },
];

/** Synthetic preferences as a coordinator might record them. `confirmed` = confirmed with the patient. */
export const PATIENT_PREFERENCES: PatientPreferences[] = [
  {
    // Case 1 — wait versus distance
    patientId: "pat-c5",
    caseLabel: "Case 1 — wait versus distance",
    maxTravelKm: 40,
    priority: "shorter-wait",
    needsTransport: "no",
    accessNeeds: ["writtenCommunication"],
    preferredProviderIds: [],
    confirmed: true,
    recordedBy: "Priya Shah (elective pathway coordinator), synthetic record",
  },
  {
    // Case 2 — access requirements
    patientId: "pat-c4",
    caseLabel: "Case 2 — access requirements",
    maxTravelKm: 15,
    priority: "closer",
    needsTransport: "yes",
    accessNeeds: ["stepFreeAccess"],
    preferredProviderIds: [],
    confirmed: true,
    recordedBy: "Priya Shah (elective pathway coordinator), synthetic record",
  },
  {
    // Case 3 — clinical uncertainty (and preferences not yet confirmed)
    patientId: "pat-c2",
    caseLabel: "Case 3 — clinical uncertainty",
    maxTravelKm: null,
    priority: null,
    needsTransport: "yes",
    accessNeeds: ["stepFreeAccess"],
    preferredProviderIds: [],
    confirmed: false,
    recordedBy: "From the transfer document only — not yet confirmed with the patient (synthetic)",
  },
];

/** Clinician-documented requirements, quoted verbatim from the synthetic record. Never inferred. */
export const DOCUMENTED_REQUIREMENTS: DocumentedRequirement[] = [
  {
    patientId: "pat-c2",
    capability: "generalAnaesthesia",
    label: "General anaesthesia",
    documentId: "cdoc-B",
    quote: "Anaesthetic considerations: General anaesthesia required, documented by the consultant (synthetic)",
  },
];

export const preferencesFor = (patientId: string) => PATIENT_PREFERENCES.find((p) => p.patientId === patientId);
export const requirementsFor = (patientId: string) => DOCUMENTED_REQUIREMENTS.filter((r) => r.patientId === patientId);

/**
 * Multiparametric provider comparison — deterministic ADMINISTRATIVE decision support.
 * Pure functions: no state changes, no engine commands, no machine learning.
 *
 * Layer A (constraints and uncertainty) is worked out first and is never traded off in a score:
 *   - conflicts with known patient preferences
 *   - missing provider information (unknown is kept as unknown — never read as "no" or zero)
 *   - "Capability requires clinical review" flags, raised ONLY from clinician-documented
 *     requirements; a flagged provider is not positioned and is not excluded — a clinician decides
 *   - unknown / unavailable capacity, and whether the patient's preferences are confirmed
 * Layer B (illustrative administrative ranking) applies only to providers that can be compared:
 *   score = w_wait × waitScore + w_distance × distanceScore + w_pref × preferenceScore
 *   waitScore / distanceScore are min–max normalised over the comparable providers (shorter = 1),
 *   preferenceScore = satisfied ÷ (satisfied + conflicting) known non-clinical preferences.
 *   The weights are DEMONSTRATION ASSUMPTIONS, not validated NHS prioritisation weights.
 *
 * This module never says a patient is clinically suitable, never chooses a provider, and never
 * records patient agreement. Selecting a provider only produces a link into the existing handover
 * workflow, where the engine's guards (transferBlockers) still apply.
 */
import type { DemoState } from "@/core/types";

export type Tri = "yes" | "no" | "unknown";
export type CapabilityKey = "generalAnaesthesia" | "localAnaesthesia" | "complexCases" | "additionalPreopAssessment";
export type AccessKey = "stepFreeAccess" | "writtenCommunication" | "interpreter";
export type Priority = "shorter-wait" | "closer" | "balanced";
export type SortMode = "score" | "soonest" | "nearest";

export interface ProviderEntry {
  id: string;
  name: string;
  sector: "NHS" | "Independent (NHS-funded)";
  /** Organisation in the demo state, if this provider can receive a Relay handover. */
  orgId?: string;
  /** Receiver profile, if registered. Without one the comparison is informational only. */
  receiverProfileId?: string;
  isCurrentProvider?: boolean;
  /** Simulated. null = not known. */
  estimatedWaitWeeks: number | null;
  /** Simulated travel distance by patient id. null / absent = not known. */
  distanceKm: Record<string, number | null>;
  availability: "confirmed" | "unconfirmed" | "unavailable";
  capabilities: Record<CapabilityKey, Tri>;
  transport: Tri;
  access: Record<AccessKey, Tri>;
}

export interface PatientPreferences {
  patientId: string;
  caseLabel?: string;
  maxTravelKm: number | null;
  /** null = wait-versus-distance preference not recorded. */
  priority: Priority | null;
  needsTransport: Tri;
  accessNeeds: AccessKey[];
  preferredProviderIds: string[];
  /** Confirmed with the patient. Unconfirmed preferences make the whole comparison provisional. */
  confirmed: boolean;
  recordedBy: string;
}

export interface DocumentedRequirement {
  patientId: string;
  capability: CapabilityKey;
  label: string;
  documentId: string;
  /** Verbatim quote from the synthetic source document. */
  quote: string;
}

export interface Weights {
  wait: number;
  distance: number;
  preferences: number;
}

export interface ShortlistConfig {
  weights: Record<Priority, Weights>;
}

/** Demonstration assumptions — not validated NHS prioritisation weights. Each row sums to 1. */
export const DEFAULT_SHORTLIST_CONFIG: ShortlistConfig = {
  weights: {
    "shorter-wait": { wait: 0.5, distance: 0.2, preferences: 0.3 },
    closer: { wait: 0.2, distance: 0.5, preferences: 0.3 },
    balanced: { wait: 0.35, distance: 0.35, preferences: 0.3 },
  },
};

export type ShortlistGroup = "compared" | "clinical-review" | "not-compared";

export interface ShortlistEntry {
  provider: ProviderEntry;
  group: ShortlistGroup;
  /** 1-based position among compared providers; null when not positioned. */
  position: number | null;
  estimatedWaitWeeks: number | null;
  distanceKm: number | null;
  /** Illustrative preference score 0–1 (3 d.p.); null when wait or distance is unknown or unavailable. */
  score: number | null;
  components: Weights | null;
  factors: string[];
  satisfied: string[];
  conflicts: string[];
  missing: string[];
  clinicalReview: string[];
  availability: ProviderEntry["availability"];
  capacityUnconfirmed: boolean;
  explanation: string;
}

export interface Shortlist {
  patientId: string;
  sort: SortMode;
  priorityUsed: Priority;
  weights: Weights;
  preferencesConfirmed: boolean;
  notes: string[];
  entries: ShortlistEntry[];
}

const ACCESS_LABEL: Record<AccessKey, string> = {
  stepFreeAccess: "step-free access",
  writtenCommunication: "written communication",
  interpreter: "interpreter",
};

const round3 = (n: number) => Math.round(n * 1000) / 1000;
const ordinal = (n: number) => (n === 1 ? "first" : n === 2 ? "second" : n === 3 ? "third" : `${n}th`);

/** Shorter is better: min → 1, max → 0. All equal → 1. */
function normaliseLowerBetter(value: number, all: number[]): number {
  const min = Math.min(...all);
  const max = Math.max(...all);
  return max === min ? 1 : (max - value) / (max - min);
}

export function compareProviders(input: {
  patientId: string;
  preferences: PatientPreferences;
  requirements: DocumentedRequirement[];
  providers: ProviderEntry[];
  sort?: SortMode;
  config?: ShortlistConfig;
}): Shortlist {
  const { patientId, preferences: pref, requirements, providers } = input;
  const sort = input.sort ?? "score";
  const config = input.config ?? DEFAULT_SHORTLIST_CONFIG;
  const priorityUsed: Priority = pref.priority ?? "balanced";
  const weights = config.weights[priorityUsed];

  const notes: string[] = [];
  if (!pref.confirmed) notes.push("Patient preferences are not yet confirmed with the patient — this comparison is provisional.");
  if (pref.priority === null) notes.push("Wait-versus-distance preference not recorded — balanced demonstration weights used.");
  if (pref.maxTravelKm === null) notes.push("Maximum travel distance not recorded — no travel limit applied.");
  if (pref.needsTransport === "unknown") notes.push("Transport need not recorded.");

  // ---------- Layer A: constraints and uncertainty (per provider)
  const drafts = providers.map((provider) => {
    const wait = provider.estimatedWaitWeeks;
    const distance = provider.distanceKm[patientId] ?? null;
    const satisfied: string[] = [];
    const conflicts: string[] = [];
    const missing: string[] = [];

    if (wait === null) missing.push("Estimated wait not available");
    if (distance === null) missing.push("Travel distance not available");

    if (pref.maxTravelKm !== null && distance !== null) {
      if (distance <= pref.maxTravelKm) satisfied.push(`Within the stated travel limit (${distance} km ≤ ${pref.maxTravelKm} km)`);
      else conflicts.push(`Beyond the stated travel limit (${distance} km > ${pref.maxTravelKm} km)`);
    }
    if (pref.needsTransport === "yes") {
      if (provider.transport === "yes") satisfied.push("Transport provision declared");
      else if (provider.transport === "no") conflicts.push("Patient needs transport; provider declares none");
      else missing.push("Transport provision not declared");
    }
    for (const need of pref.accessNeeds) {
      const v = provider.access[need];
      if (v === "yes") satisfied.push(`Declares ${ACCESS_LABEL[need]}`);
      else if (v === "no") conflicts.push(`Patient needs ${ACCESS_LABEL[need]}; provider declares none`);
      else missing.push(`${ACCESS_LABEL[need][0].toUpperCase()}${ACCESS_LABEL[need].slice(1)} arrangements not declared`);
    }
    if (pref.preferredProviderIds.includes(provider.id)) satisfied.push("Patient stated a preference for this provider");

    // Clinical: only from clinician-documented requirements. Never scored, never auto-resolved.
    const clinicalReview = requirements.flatMap((r) => {
      const v = provider.capabilities[r.capability];
      if (v === "yes") return [];
      return [
        v === "no"
          ? `Capability requires clinical review: ${r.label} is documented for this patient; this provider declares it is not available on site.`
          : `Capability requires clinical review: ${r.label} is documented for this patient; this provider has not declared this capability.`,
      ];
    });

    const scoreable = provider.availability !== "unavailable" && wait !== null && distance !== null;
    const group: ShortlistGroup = !scoreable ? "not-compared" : clinicalReview.length ? "clinical-review" : "compared";
    return { provider, wait, distance, satisfied, conflicts, missing, clinicalReview, scoreable, group };
  });

  // ---------- Layer B: illustrative administrative score for scoreable providers
  const scoreable = drafts.filter((d) => d.scoreable);
  const waits = scoreable.map((d) => d.wait!);
  const distances = scoreable.map((d) => d.distance!);

  const entries: ShortlistEntry[] = drafts.map((d) => {
    let components: Weights | null = null;
    let score: number | null = null;
    const factors: string[] = [];
    if (d.scoreable) {
      const known = d.satisfied.length + d.conflicts.length;
      components = {
        wait: round3(normaliseLowerBetter(d.wait!, waits)),
        distance: round3(normaliseLowerBetter(d.distance!, distances)),
        // No known preference items → neutral 0.5 (unknowns are reported as missing, not scored as failures).
        preferences: round3(known === 0 ? 0.5 : d.satisfied.length / known),
      };
      score = round3(weights.wait * components.wait + weights.distance * components.distance + weights.preferences * components.preferences);
      const minW = Math.min(...waits);
      const maxW = Math.max(...waits);
      const minD = Math.min(...distances);
      const maxD = Math.max(...distances);
      factors.push(
        d.wait === minW && minW !== maxW
          ? `shortest simulated estimated wait (${d.wait} weeks)`
          : d.wait === maxW && minW !== maxW
            ? `longest simulated estimated wait (${d.wait} weeks)`
            : `simulated estimated wait of ${d.wait} weeks`,
      );
      factors.push(
        d.distance === minD && minD !== maxD
          ? `shortest simulated travel distance (${d.distance} km)`
          : d.distance === maxD && minD !== maxD
            ? `longest simulated travel distance (${d.distance} km)`
            : `simulated travel distance of ${d.distance} km`,
      );
      if (known > 0) factors.push(`${d.satisfied.length} of ${known} known non-clinical preferences met`);
    }
    return {
      provider: d.provider,
      group: d.group,
      position: null,
      estimatedWaitWeeks: d.wait,
      distanceKm: d.distance,
      score,
      components,
      factors,
      satisfied: d.satisfied,
      conflicts: d.conflicts,
      missing: d.missing,
      clinicalReview: d.clinicalReview,
      availability: d.provider.availability,
      capacityUnconfirmed: d.provider.availability !== "confirmed",
      explanation: "",
    };
  });

  // ---------- Deterministic ordering: chosen sort, then wait, distance, id
  const byId = (a: ShortlistEntry, b: ShortlistEntry) => a.provider.id.localeCompare(b.provider.id);
  const cmp = (a: ShortlistEntry, b: ShortlistEntry) => {
    const w = a.estimatedWaitWeeks! - b.estimatedWaitWeeks!;
    const dist = a.distanceKm! - b.distanceKm!;
    if (sort === "soonest") return w || dist || byId(a, b);
    if (sort === "nearest") return dist || w || byId(a, b);
    return b.score! - a.score! || w || dist || byId(a, b);
  };
  const compared = entries.filter((e) => e.group === "compared").sort(cmp);
  const review = entries.filter((e) => e.group === "clinical-review").sort(cmp);
  const rest = entries.filter((e) => e.group === "not-compared").sort(byId);
  compared.forEach((e, i) => (e.position = i + 1));

  const sortPhrase = sort === "soonest" ? "sorted by soonest simulated wait" : sort === "nearest" ? "sorted by shortest simulated distance" : "illustrative comparison";
  for (const e of [...compared, ...review, ...rest]) {
    const tail = [
      e.conflicts.length ? ` Conflicts with a stated preference: ${e.conflicts.join("; ")}.` : "",
      e.missing.length ? ` Information missing: ${e.missing.join("; ")}.` : "",
      e.availability === "unavailable" ? " Declared as not currently available (simulated)." : e.capacityUnconfirmed ? " Actual capacity is unconfirmed." : "",
    ].join("");
    if (e.group === "compared")
      e.explanation = `Appears ${ordinal(e.position!)} in this ${sortPhrase}: ${e.factors.join(", ")}.${tail}`;
    else if (e.group === "clinical-review")
      e.explanation = `Not positioned. ${e.clinicalReview.join(" ")} A clinician must review this before the provider is considered further; it has not been excluded.${tail}`;
    else
      e.explanation = `Not compared.${tail || " Required information is missing."}${e.clinicalReview.length ? ` ${e.clinicalReview.join(" ")}` : ""}`;
  }

  return { patientId, sort, priorityUsed, weights, preferencesConfirmed: pref.confirmed, notes, entries: [...compared, ...review, ...rest] };
}

// ------------------------------------------------------------------ link into the handover workflow

export interface DestinationProposal {
  kind: "capture" | "open-existing" | "redirect-existing" | "informational" | "current";
  /** Link into the existing handover workflow. Following it changes nothing by itself. */
  href?: string;
  label: string;
  note: string;
}

/**
 * Where a coordinator can take a proposed destination next. READ-ONLY: returns a link and wording.
 * It never creates, redirects or alters a transfer and never records patient agreement — those
 * remain explicit, named actions in the handover workflow, checked by the engine.
 */
export function proposeDestination(state: DemoState, patientId: string, provider: ProviderEntry): DestinationProposal {
  const reminder =
    "Selecting a provider here is not patient agreement. Agreement, clinical confirmation and sign-off are still recorded and checked in the handover.";
  if (provider.isCurrentProvider)
    return { kind: "current", label: "Current provider", note: "This is the patient's current provider — no handover is needed to stay." };
  if (!provider.receiverProfileId || !state.organizations.some((o) => o.id === provider.orgId))
    return {
      kind: "informational",
      label: "Informational only",
      note: "No receiver profile is registered for this fictional provider, so a Relay handover cannot be prepared. Use this row for discussion only.",
    };
  const existing = state.transfers.filter((t) => t.patientId === patientId).at(-1);
  if (!existing)
    return {
      kind: "capture",
      href: `/hub?capture=1&patient=${encodeURIComponent(patientId)}&profile=${encodeURIComponent(provider.receiverProfileId)}`,
      label: "Start a handover to this provider",
      note: `Opens handover capture with this provider pre-selected. Nothing is created until you choose to. ${reminder}`,
    };
  const sameProfile = existing.handover?.receiverProfileId === provider.receiverProfileId;
  if (existing.status === "rejected" && !sameProfile)
    return {
      kind: "redirect-existing",
      href: `/hub?t=${encodeURIComponent(existing.id)}&profile=${encodeURIComponent(provider.receiverProfileId)}`,
      label: "Open the returned handover",
      note: `The earlier handover was returned by the receiver. Redirecting it is an explicit step by the sending team in the handover screen; Relay never re-sends automatically. ${reminder}`,
    };
  if (existing.status === "rejected")
    return {
      kind: "open-existing",
      href: `/hub?t=${encodeURIComponent(existing.id)}`,
      label: "Open the returned handover",
      note: `This provider already returned this patient's handover: ${existing.decisions.at(-1)?.reason ?? "no reason recorded"}`,
    };
  return {
    kind: "open-existing",
    href: `/hub?t=${encodeURIComponent(existing.id)}`,
    label: "Open the existing handover",
    note: sameProfile
      ? `A handover to this provider already exists (status: ${existing.status}). ${reminder}`
      : `A handover to a different provider already exists (status: ${existing.status}). Its destination cannot be changed from this screen.`,
  };
}

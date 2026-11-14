/**
 * Transfer-kind configuration. Kinds change terminology, available profiles (via
 * ReceiverProfile.transferKinds), required sign-off and the label of a SIMULATED next step.
 * They do not create separate workflows — all kinds run through the same engine.
 */
import type { TransferKind } from "@/core/types";

export interface TransferKindConfig {
  id: TransferKind;
  label: string;
  senderNoun: string;
  documentNoun: string;
  /** Roles allowed to sign off (confirm) the handover before sending. */
  signOffRoles: string[];
  /** Mock only — no live integration exists. */
  simulatedNextStep: string;
}

export const TRANSFER_KIND_CONFIG: Record<TransferKind, TransferKindConfig> = {
  discharge: {
    id: "discharge",
    label: "Discharge to another service",
    senderNoun: "Discharging team",
    documentNoun: "Discharge handover",
    signOffRoles: ["discharging-clinician"],
    simulatedNextStep: "Simulated: receiving team plans first contact (mock — no booking or Heim integration)",
  },
  referral: {
    id: "referral",
    label: "Referral",
    senderNoun: "Referrer",
    documentNoun: "Referral",
    signOffRoles: ["gp", "discharging-clinician", "specialist-clinician"],
    simulatedNextStep: "Simulated: receiving service reviews the referral (mock — no e-RS integration)",
  },
  "provider-move": {
    id: "provider-move",
    label: "Treatment transfer between providers",
    senderNoun: "Transferring provider",
    documentNoun: "Treatment transfer",
    signOffRoles: ["discharging-clinician", "specialist-clinician", "gp"],
    simulatedNextStep: "Simulated: receiving provider takes over the episode (mock — no PTL/DMAS integration)",
  },
};

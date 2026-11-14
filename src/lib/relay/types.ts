export type Status = "Complete" | "Unclear" | "Missing";
export type FieldKey =
  | "eye" | "acuity" | "impact" | "otherEye" | "bloodThinner" | "tamsulosin"
  | "biometry" | "consent" | "transport" | "interpreter" | "otherEyePlan";

export interface ChecklistItem {
  key: FieldKey;
  label: string;
  value: string;
  status: Status;
  question: string;
  quote?: string | undefined;
  note?: string | undefined;
}

export interface Patient {
  id: string;
  name: string;
  age: number;
  nhs: string;
  postcode: string;
  eye: "Right" | "Left";
  weeksWaited: number;
  providerId: string;
  step: number; // 0 Referred .. 4 Post-op check
  owner: string;
  onlyOneGoodEye: boolean;
  needsTransport: boolean;
  needsGeneralAnaesthetic: boolean;
  flags: string[];
  checklist: ChecklistItem[];
  letter: string;
  events: { day: string; text: string; owner: string }[];
}

export type ProviderType = "NHS" | "Independent" | "Insourced list";
export interface Provider {
  id: string;
  name: string;
  type: ProviderType;
  weeks: number;
  miles: number;
  acceptsComplex: boolean;
  transport: boolean;
  generalAnaesthetic: boolean;
  postOp: string;
}

export type TaskType = "longWait" | "handover" | "missed" | "returned";
export interface Task {
  id: string;
  type: TaskType;
  patientId: string;
  dueIn: number; // days; negative = overdue
  detail: string;
  done: boolean;
  doneToday: boolean;
  handoverId?: string | undefined;
}

export interface Handover {
  id: string;
  patientId: string;
  providerId: string;
  status: "Sent" | "Accepted" | "Returned";
  sentDaysAgo: number;
  owner: string;
  signedBy: string;
  reason?: string | undefined;
}

export type Role = "Coordinator" | "Receiving provider" | "Patient";

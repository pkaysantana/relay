import type { ChecklistItem, Handover, Patient, Provider, Task } from "./types";

const POST_OP = "Community optometrist near home, about 4 weeks after surgery";
const p = (
  id: string, name: string, type: Provider["type"], weeks: number, miles: number,
  acceptsComplex: boolean, transport: boolean, generalAnaesthetic: boolean,
): Provider => ({ id, name, type, weeks, miles, acceptsComplex, transport, generalAnaesthetic, postOp: POST_OP });

export const providers: Provider[] = [
  p("northfield", "Northfield Royal Eye Unit", "NHS", 31, 3, true, true, true),
  p("saturday", "Northfield Saturday List (insourced team)", "Insourced list", 5, 3, true, true, false),
  p("staldans", "St Aldan's Hospital", "NHS", 14, 9, true, true, true),
  p("clearsight", "ClearSight Eye Centre", "Independent", 4, 6, false, true, false),
  p("brightwater", "Brightwater Eye Clinic", "Independent", 6, 18, true, false, false),
  p("meadowbank", "Meadowbank Vision", "Independent", 3, 11, false, false, false),
  p("riverside", "Riverside Treatment Centre", "Independent", 8, 7, true, true, false),
];

export const HERO_ID = "p17";

const heroLetter =
  "Dear colleague, I would be grateful if you could see Mrs Ellis, aged 80, for cataract surgery to her right eye. Vision is 6/24 right. Her left eye has poor vision from long-standing macular degeneration, so the right is her only useful eye. She has fallen twice this year and has stopped going out alone. She takes apixaban for atrial fibrillation. She does not take tamsulosin. Biometry was done at her last visit. She wishes to go ahead with surgery and will need transport. No interpreter needed. Second eye surgery is not planned.";

const c = (key: ChecklistItem["key"], label: string, value: string, question: string, quote?: string, status: ChecklistItem["status"] = "Complete", note?: string): ChecklistItem =>
  ({ key, label, value, status, question, quote, note });

const heroChecklist: ChecklistItem[] = [
  c("eye", "Which eye", "Right", "Which eye is being operated on?", "cataract surgery to her right eye"),
  c("acuity", "Visual acuity", "6/24 right", "What is the visual acuity?", "Vision is 6/24 right."),
  c("impact", "Impact on daily life", "Two falls this year; stopped going out alone", "How does it affect daily life?", "She has fallen twice this year and has stopped going out alone."),
  c("otherEye", "Other eye conditions", "Left eye: long-standing macular degeneration (only one good eye)", "Any other eye conditions?", "Her left eye has poor vision from long-standing macular degeneration, so the right is her only useful eye."),
  c("bloodThinner", "Blood thinner and plan", "Apixaban – no plan stated", "What is the plan for the blood thinner around surgery?", "She takes apixaban for atrial fibrillation.", "Missing", "Drug named, but no plan for surgery."),
  c("tamsulosin", "Tamsulosin (yes/no)", "No", "Does the patient take tamsulosin?", "She does not take tamsulosin."),
  c("biometry", "Biometry", "Done – date not stated", "What date was biometry done?", "Biometry was done at her last visit.", "Unclear", "Date not stated."),
  c("consent", "Consent discussed", "Wishes to go ahead", "Has consent been discussed?", "She wishes to go ahead with surgery"),
  c("transport", "Transport", "Needs transport", "Does the patient need transport?", "will need transport"),
  c("interpreter", "Interpreter", "Not needed", "Is an interpreter needed?", "No interpreter needed."),
  c("otherEyePlan", "Plan for the other eye", "Not planned", "What is the plan for the other eye?", "Second eye surgery is not planned."),
];

function genericChecklist(eye: string): ChecklistItem[] {
  return heroChecklist.map((i) => ({
    ...i,
    status: "Complete",
    note: undefined,
    quote: undefined,
    value:
      ({ eye, acuity: `6/18 ${eye.toLowerCase()}`, impact: "Difficulty reading and driving", otherEye: "None",
        bloodThinner: "None", tamsulosin: "No", biometry: "Done 3 months ago", consent: "Discussed",
        transport: "Not needed", interpreter: "Not needed", otherEyePlan: "Review after first eye" } as Record<string, string>)[i.key] ?? "",
  }));
}

const hero: Patient = {
  id: HERO_ID, name: "Margaret Ellis", age: 80, nhs: "999 000 0017", postcode: "M21", eye: "Right",
  weeksWaited: 31, providerId: "northfield", step: 1, owner: "Northfield Royal Eye Unit",
  onlyOneGoodEye: true, needsTransport: true, needsGeneralAnaesthetic: false,
  flags: ["Only one good eye", "On a blood thinner (apixaban)", "2 falls this year", "Needs transport"],
  checklist: heroChecklist, letter: heroLetter,
  events: [
    { day: "31 weeks ago", text: "Referred by GP for right cataract", owner: "GP" },
    { day: "30 weeks ago", text: "Added to waiting list", owner: "Northfield Royal Eye Unit" },
  ],
};

type O = [id: string, name: string, age: number, eye: "Right" | "Left", weeks: number, provider: string, step: number, flags: string[], extra?: Partial<Patient>];
const others: O[] = [
  ["p21", "Arthur Bennett", 74, "Left", 28, "northfield", 1, ["Needs transport"], { needsTransport: true }],
  ["p22", "Doreen Shah", 68, "Right", 9, "staldans", 2, []],
  ["p23", "Frank O'Neill", 85, "Left", 22, "northfield", 1, ["On a blood thinner"]],
  ["p24", "Grace Adeyemi", 71, "Right", 6, "riverside", 3, ["Needs interpreter"]],
  ["p25", "Harold Price", 91, "Right", 33, "northfield", 1, ["Only one good eye", "Needs general anaesthetic"], { onlyOneGoodEye: true, needsGeneralAnaesthetic: true }],
  ["p26", "Irene Kowalski", 62, "Left", 4, "clearsight", 2, []],
  ["p27", "James Whitfield", 77, "Right", 12, "staldans", 1, ["2 falls this year"]],
  ["p28", "Kathleen Murphy", 83, "Left", 17, "brightwater", 2, ["Needs transport"], { needsTransport: true }],
  ["p29", "Leonard Hughes", 66, "Right", 2, "saturday", 4, []],
  ["p30", "Mary Okafor", 79, "Left", 11, "riverside", 1, []],
  ["p31", "Norman Clarke", 88, "Right", 26, "northfield", 1, ["Only one good eye"], { onlyOneGoodEye: true }],
];

const pname = (id: string) => providers.find((x) => x.id === id)!.name;

export function seedPatients(): Patient[] {
  return [
    hero,
    ...others.map(([id, name, age, eye, weeks, providerId, step, flags, extra], i): Patient => ({
      id, name, age, eye, weeksWaited: weeks, providerId, step, flags,
      nhs: `999 000 00${id.slice(1)}`, postcode: ["M20", "M14", "M22", "M19", "M23", "M16", "M21", "M33", "M15", "M13", "M90"][i] ?? "M21",
      owner: pname(providerId), onlyOneGoodEye: false, needsTransport: false, needsGeneralAnaesthetic: false,
      checklist: genericChecklist(eye),
      letter: `Dear colleague, please see this patient, aged ${age}, for cataract surgery to the ${eye.toLowerCase()} eye.`,
      events: [{ day: `${weeks} weeks ago`, text: "Referred by GP", owner: "GP" }, { day: `${Math.max(weeks - 1, 1)} weeks ago`, text: `Added to list at ${pname(providerId)}`, owner: pname(providerId) }],
      ...extra,
    })),
  ];
}

export function seedHandovers(): Handover[] {
  return [{ id: "h1", patientId: "p27", providerId: "riverside", status: "Sent", sentDaysAgo: 2, owner: "Sender until accepted", signedBy: "A. Patel, Referral coordinator" }];
}

export function seedTasks(): Task[] {
  const t = (id: string, type: Task["type"], patientId: string, dueIn: number, detail: string, handoverId?: string): Task =>
    ({ id, type, patientId, dueIn, detail, done: false, doneToday: false, handoverId });
  return [
    t("t1", "longWait", HERO_ID, -5, "Waiting 31 weeks at Northfield Royal Eye Unit. Faster suitable provider available."),
    t("t2", "missed", "p23", -2, "Did not attend pre-op assessment at Northfield Royal Eye Unit."),
    t("t3", "longWait", "p25", -1, "Waiting 33 weeks at Northfield Royal Eye Unit. Faster suitable provider available."),
    t("t4", "handover", "p27", 0, "Sent 2 days ago to Riverside Treatment Centre, accept within 2 working days.", "h1"),
    t("t5", "longWait", "p21", 0, "Waiting 28 weeks at Northfield Royal Eye Unit. Faster suitable provider available."),
    t("t6", "returned", "p28", 0, "Returned by Brightwater Eye Clinic. Reason: No capacity."),
    t("t7", "longWait", "p31", 0, "Waiting 26 weeks at Northfield Royal Eye Unit. Faster suitable provider available."),
    t("t8", "missed", "p30", 2, "Did not attend biometry appointment at Riverside Treatment Centre."),
  ];
}

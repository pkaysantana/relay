/**
 * Deterministic parser for EXPLICITLY LABELLED synthetic documents ("Label: value" lines).
 * It never guesses, infers or invents: unlabelled prose is ignored, every value keeps the exact
 * line it came from (verbatim quote + offsets), and odd values are flagged, not fixed.
 * Extracted values are never confirmed here — a named professional confirms them.
 */
import { FIELD_CATALOGUE, type FieldDefinition } from "@/packs/fields";
import type { FieldEvidence, SourceDocument } from "@/core/types";
import type { TransferExtractor } from "@/extensions";

export interface ExtractedField {
  key: string;
  value: string;
  evidence: FieldEvidence;
  ambiguity?: string;
}

const normLabel = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();

const ALIAS: Map<string, FieldDefinition> = new Map(
  FIELD_CATALOGUE.flatMap((f) => f.aliases.map((a) => [normLabel(a), f] as const)),
);

const AMBIGUOUS = /\b(tbc|tbd|unknown|unsure|unclear|not known|to be confirmed|query|possibly|maybe)\b/i;

function normaliseValue(def: FieldDefinition, raw: string): { value: string; ambiguity?: string } {
  const v = raw.trim();
  if (def.format === "nhs-number") {
    const d = v.replace(/[\s-]/g, "");
    return /^\d{10}$/.test(d)
      ? { value: `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` }
      : { value: v, ambiguity: "not a 10-digit NHS number" };
  }
  if (def.format === "date") {
    let m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
    let iso: string | undefined;
    if (m) iso = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) iso = v;
    if (iso) {
      const d = new Date(`${iso}T00:00:00Z`);
      if (!Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso) return { value: iso };
    }
    return { value: v, ambiguity: "date not in a recognised format (DD/MM/YYYY or YYYY-MM-DD)" };
  }
  if (def.format === "yes-no") {
    const l = v.toLowerCase();
    if (["yes", "y"].includes(l)) return { value: "yes" };
    if (["no", "n"].includes(l)) return { value: "no" };
    return { value: v, ambiguity: "expected yes or no" };
  }
  if (def.format === "agreement") {
    // Only an explicit statement maps to a state; anything else stays unresolved for a human.
    const l = v.toLowerCase();
    if (/^(yes|agreed|patient agreed|patient agrees)\b/.test(l)) return { value: "agreed" };
    if (/^(no|declined|refused|patient declined|patient refused|patient does not agree)\b/.test(l)) return { value: "declined" };
    return { value: v, ambiguity: `not an explicit agreement ("${v}")` };
  }
  if (def.format === "laterality") {
    const l = v.toLowerCase().replace(/[^a-z ]/g, "").trim();
    if (["right", "r", "re", "right eye"].includes(l)) return { value: "right" };
    if (["left", "l", "le", "left eye"].includes(l)) return { value: "left" };
    return { value: v, ambiguity: "laterality must name a single eye (right or left)" };
  }
  const amb = AMBIGUOUS.exec(v)?.[0] ?? (v.includes("?") ? "?" : undefined);
  return { value: v, ambiguity: amb ? `contains "${amb}"` : undefined };
}

export function parseLabelledDocument(doc: SourceDocument): { fields: ExtractedField[]; warnings: string[] } {
  const fields: ExtractedField[] = [];
  const warnings: string[] = [];
  const text = doc.text ?? "";
  let offset = 0;
  for (const rawLine of text.split("\n")) {
    const lineStart = offset;
    offset += rawLine.length + 1;
    const line = rawLine.replace(/\r$/, "");
    const m = line.match(/^(\s*)([A-Za-z][A-Za-z /()'-]{0,59}?)\s*:(.*)$/);
    if (!m) continue;
    const def = ALIAS.get(normLabel(m[2]));
    if (!def) {
      warnings.push(`${doc.title}: label "${m[2].trim()}" not recognised — ignored`);
      continue;
    }
    const rawValue = m[3].trim();
    if (!rawValue) {
      warnings.push(`${doc.title}: "${m[2].trim()}" is present but empty`);
      continue;
    }
    // Quote = the whole labelled line without surrounding whitespace, verbatim from the source.
    const leading = m[1].length;
    const trimmed = line.slice(leading).trimEnd();
    const start = lineStart + leading;
    const end = start + trimmed.length;
    const { value, ambiguity } = normaliseValue(def, rawValue);
    fields.push({ key: def.key, value, ambiguity, evidence: { documentId: doc.id, quote: text.slice(start, end), start, end, value } });
  }
  if (fields.length === 0) warnings.push(`${doc.title}: no labelled fields found`);
  return { fields, warnings };
}

/** Deterministic implementation of the extraction extension interface. */
export const labelledParserExtractor: TransferExtractor = {
  id: "deterministic-labelled-parser",
  method: "deterministic-extraction",
  async extract(doc) {
    return parseLabelledDocument(doc);
  },
};

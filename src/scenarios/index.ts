/**
 * Demo sets. The product is niche-agnostic: the cataract set is the current working
 * demonstration; the generic set keeps the Prompt 1/2 scenarios runnable.
 */
import type { DemoState } from "@/core/types";
import { CATARACT_SCENARIO_LABELS, createCataractSeedState } from "./cataract";
import { createSeedState, SCENARIO_LABELS as GENERIC_LABELS } from "./seed";

export type DemoSetId = "cataract" | "generic";

export const DEMO_SETS: Record<DemoSetId, { label: string; create: () => DemoState; defaultTransferId: string }> = {
  cataract: { label: "Cataract: NHS eye service → independent provider", create: createCataractSeedState, defaultTransferId: "cat-D" },
  generic: { label: "Generic handovers (discharge / referral)", create: () => createSeedState(), defaultTransferId: "tr-D" },
};

export const DEFAULT_DEMO_SET: DemoSetId = "cataract";

export const SCENARIO_LABELS: Record<string, string> = { ...GENERIC_LABELS, ...CATARACT_SCENARIO_LABELS };

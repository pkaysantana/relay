/**
 * Pack registry. To add a niche (e.g. heart failure, COPD):
 *   1. create src/packs/<name>.ts exporting a PathwayPack
 *   2. add it to PACKS below
 * No engine changes required — tests/packs.test.ts runs every registered pack through the core engine.
 */
import { cataractPack } from "./cataract";
import { generalPack } from "./general";
import type { PathwayPack } from "./types";

export const PACKS: Record<string, PathwayPack> = {
  [generalPack.id]: generalPack,
  [cataractPack.id]: cataractPack,
};

export const DEFAULT_PACK_ID = generalPack.id;

export function getPack(id: string): PathwayPack {
  const pack = PACKS[id];
  if (!pack) throw new Error(`Unknown pathway pack: ${id}`);
  return pack;
}

export function listPacks(): PathwayPack[] {
  return Object.values(PACKS);
}

export type { PathwayPack } from "./types";

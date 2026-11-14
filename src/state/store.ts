"use client";
/**
 * Client-side store: engine state persisted to localStorage. No server, no database.
 * UI code dispatches Commands; it never mutates state directly.
 */
import { useCallback, useState, useSyncExternalStore } from "react";
import { apply, type Command } from "@/core/engine";
import type { DemoState } from "@/core/types";
import { DEFAULT_DEMO_SET, DEMO_SETS, type DemoSetId } from "@/scenarios";

const KEY = "doorstep:demo-state:v3"; // bumped: Prompt 3 cataract demo set
const SET_KEY = "doorstep:demo-set";
const listeners = new Set<() => void>();
let seed: DemoState | null = null;
let current: DemoState | null = null;
let currentSet: DemoSetId | null = null;

/** Server/hydration snapshot: always the default demo set. */
function getSeed(): DemoState {
  return (seed ??= DEMO_SETS[DEFAULT_DEMO_SET].create());
}

function loadSet(): DemoSetId {
  if (currentSet) return currentSet;
  try {
    const v = typeof window !== "undefined" ? window.localStorage.getItem(SET_KEY) : null;
    currentSet = v && v in DEMO_SETS ? (v as DemoSetId) : DEFAULT_DEMO_SET;
  } catch {
    currentSet = DEFAULT_DEMO_SET;
  }
  return currentSet;
}

function load(): DemoState {
  if (current) return current;
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(KEY) : null;
    const parsed = raw ? (JSON.parse(raw) as DemoState) : null;
    const set = loadSet();
    current = parsed && parsed.schemaVersion === 1 && Array.isArray(parsed.documents) ? parsed : set === DEFAULT_DEMO_SET ? getSeed() : DEMO_SETS[set].create();
  } catch {
    current = getSeed();
  }
  return current;
}

function save(state: DemoState) {
  current = state;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage full or disabled: keep in memory, demo still works for this session.
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      current = null;
      l();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

export function useDemoState(): DemoState {
  return useSyncExternalStore(subscribe, load, getSeed);
}

export function dispatch(cmd: Command): { ok: true } | { ok: false; error: string } {
  const r = apply(load(), cmd);
  if (!r.ok) return r;
  save(r.state);
  return { ok: true };
}

/** Restore the chosen demo set (default: the one currently loaded). */
export function resetDemo(set: DemoSetId = loadSet()) {
  currentSet = set;
  try {
    window.localStorage.setItem(SET_KEY, set);
  } catch {
    // in-memory only
  }
  save(DEMO_SETS[set].create());
}

export function useDemoSet(): DemoSetId {
  return useSyncExternalStore(subscribe, loadSet, () => DEFAULT_DEMO_SET);
}

/** Dispatch with a per-component error message for display in an alert region. */
export function useCommand() {
  const [error, setError] = useState<string | null>(null);
  const run = useCallback((cmd: Command) => {
    const r = dispatch(cmd);
    setError(r.ok ? null : r.error);
    return r.ok;
  }, []);
  return { run, error, clearError: () => setError(null) };
}

/** Current state outside React (tests, event handlers). */
export function getDemoState(): DemoState {
  return load();
}

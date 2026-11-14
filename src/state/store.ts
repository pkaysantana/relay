"use client";
/**
 * Client-side store: engine state persisted to localStorage. No server, no database.
 * UI code dispatches Commands; it never mutates state directly.
 */
import { useCallback, useState, useSyncExternalStore } from "react";
import { apply, type Command } from "@/core/engine";
import type { DemoState } from "@/core/types";
import { createSeedState } from "@/scenarios/seed";

const KEY = "doorstep:demo-state:v1";
const listeners = new Set<() => void>();
let seed: DemoState | null = null;
let current: DemoState | null = null;

function getSeed(): DemoState {
  return (seed ??= createSeedState());
}

function load(): DemoState {
  if (current) return current;
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(KEY) : null;
    const parsed = raw ? (JSON.parse(raw) as DemoState) : null;
    current = parsed && parsed.schemaVersion === 1 ? parsed : getSeed();
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

export function resetDemo() {
  save(createSeedState());
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

"use client";

import { useSyncExternalStore } from "react";

/**
 * A shared ticking clock.
 *
 * Time is external mutable state, so it is read through `useSyncExternalStore`
 * rather than mirrored into component state from an effect. Two payoffs beyond
 * correctness:
 *
 *   - one interval for the whole page instead of one per component, which
 *     matters on the lot map where forty-odd durations render at once;
 *   - the snapshot starts at 0 on both server and client, so hydration matches
 *     and the value fills in immediately after mount.
 */

const TICK_MS = 30_000;

/** 0 means "not started yet" — the value both server and first client render see. */
let currentTime = 0;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  if (timer === null) {
    currentTime = Date.now();
    timer = setInterval(() => {
      currentTime = Date.now();
      for (const notify of listeners) notify();
    }, TICK_MS);
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

function getSnapshot(): number {
  return currentTime;
}

function getServerSnapshot(): number {
  return 0;
}

/** Current time in ms, or `null` until the clock has started on the client. */
export function useNow(): number | null {
  const now = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return now === 0 ? null : now;
}

/** Minutes elapsed since `sinceMs`, or null before the clock is available. */
export function minutesSince(
  now: number | null,
  sinceMs: number,
): number | null {
  if (now === null) return null;
  return Math.max(0, Math.floor((now - sinceMs) / 60_000));
}

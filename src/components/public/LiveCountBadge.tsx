"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import { paths } from "@/lib/firebase/paths";
import { cn } from "@/lib/cn";
import { dtoFromRaw } from "@/lib/data/publicViewDto";

/**
 * The "Parking available" pill on the landing hero.
 *
 * Subscribes so a driver who leaves the page open sees it flip to full rather
 * than setting off on stale information — the count beside it is server
 * rendered, and this keeps the two honest with each other.
 */
export function LiveCountBadge({
  lotId,
  initialFree,
  labels,
}: {
  lotId: string;
  initialFree: number | null;
  labels: { available: string; full: string };
}) {
  const [free, setFree] = useState(initialFree);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, paths.publicView(lotId)),
      (snapshot) => {
        const next = dtoFromRaw(lotId, snapshot.data());
        if (next) setFree(next.freeByType.car + next.freeByType.motorcycle);
      },
      (error) => console.error("[landing] subscription failed", error),
    );
    return unsubscribe;
  }, [lotId]);

  const available = free === null || free > 0;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold",
        available
          ? "bg-accent text-accent-text"
          : "bg-occupied-surface text-occupied",
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {available ? labels.available : labels.full}
    </span>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";

import type { SessionStatus, SlotStatus, VehicleType } from "@/lib/types";
import { cancelAssignment, confirmParked } from "@/lib/actions/vehicles";
import { markOutOfService, returnToService } from "@/lib/actions/slots";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Card, SectionHeader } from "@/components/ui/Card";
import { LiveDuration } from "@/components/ui/LiveDuration";
import {
  LotAisle,
  ParkingSpace,
  SlotLegend,
} from "@/components/ui/ParkingSpace";

export interface MappedSlot {
  id: string;
  code: string;
  level: string;
  vehicleType: VehicleType;
  status: SlotStatus;
  outOfServiceReason: string | null;
  session: {
    id: string;
    plateLabel: string;
    entryAtMs: number;
    status: SessionStatus;
  } | null;
}

export function StaffLotMap({
  lotId,
  slots,
}: {
  lotId: string;
  slots: MappedSlot[];
}) {
  const t = useTranslations("staff");
  const to = useTranslations("owner");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const router = useRouter();

  const [selected, setSelected] = useState<MappedSlot | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const levels = [...new Set(slots.map((s) => s.level))];

  function act(run: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await run();
      if (!result.ok && result.error) {
        setError(te(result.error));
        return;
      }
      setSelected(null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {levels.map((level) => (
        <Card key={level}>
          <SectionHeader title={level} />
          <div className="rounded-tile overflow-hidden border border-black/15 shadow-sm">
            <div className="lot-asphalt grid grid-cols-3 border-t-2 border-white/55 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
              {slots
                .filter((s) => s.level === level)
                .map((slot) => (
                  <button
                    key={slot.id}
                    onClick={() => {
                      setSelected(slot);
                      setError(null);
                    }}
                    aria-label={`${slot.code}${slot.session ? `, ${slot.session.plateLabel}` : ""}`}
                    // Bays sit edge to edge, so the pressed state is drawn
                    // inside the cell — scaling one up would ride over its
                    // neighbours' painted lines.
                    className="relative text-left transition focus-visible:z-10 hover:z-10 hover:brightness-125 active:brightness-95"
                  >
                    <ParkingSpace
                      code={slot.code}
                      status={slot.status}
                      vehicleType={slot.vehicleType}
                      sublabel={slot.session?.plateLabel}
                    />
                  </button>
                ))}
            </div>
            <LotAisle />
          </div>

          <div className="border-border mt-4 border-t pt-3">
            <SlotLegend
              labels={{
                free: tc("free"),
                taken: tc("taken"),
                reserved: tc("assigned"),
                outOfService: tc("outOfService"),
              }}
            />
          </div>
        </Card>
      ))}

      {selected && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${tc("slot")} ${selected.code}`}
          className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-surface rounded-card w-full max-w-sm p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-text text-2xl font-bold">{selected.code}</p>
                <p className="text-muted text-sm">{selected.level}</p>
              </div>
              <button
                onClick={() => setSelected(null)}
                aria-label={tc("cancel")}
                className="text-muted hover:text-text"
              >
                <X className="size-5" />
              </button>
            </div>

            {selected.session && (
              <dl className="border-border mt-4 grid grid-cols-2 gap-y-1.5 border-t pt-4 text-sm">
                <dt className="text-muted">{tc("plate")}</dt>
                <dd className="text-text text-end font-medium">
                  {selected.session.plateLabel}
                </dd>
                <dt className="text-muted">{t("duration")}</dt>
                <dd className="text-text text-end">
                  <LiveDuration sinceMs={selected.session.entryAtMs} />
                </dd>
              </dl>
            )}

            {selected.outOfServiceReason && (
              <p className="text-muted border-border mt-4 border-t pt-4 text-sm">
                {tc("reason")}: {selected.outOfServiceReason}
              </p>
            )}

            {error && (
              <p role="alert" className="text-danger mt-3 text-sm">
                {error}
              </p>
            )}

            <div className="mt-5 flex flex-col gap-2">
              {selected.session?.status === "assigned" && (
                <>
                  <Button
                    fullWidth
                    disabled={pending}
                    onClick={() =>
                      act(() =>
                        confirmParked({
                          lotId,
                          sessionId: selected.session!.id,
                        }),
                      )
                    }
                  >
                    {t("confirmParked")}
                  </Button>
                  <Button
                    variant="ghost"
                    fullWidth
                    disabled={pending}
                    onClick={() =>
                      act(() =>
                        cancelAssignment({
                          lotId,
                          sessionId: selected.session!.id,
                          reason: "Driver left before parking",
                        }),
                      )
                    }
                  >
                    {t("cancelAssignment")}
                  </Button>
                </>
              )}

              {selected.status === "available" && (
                <Button
                  variant="secondary"
                  fullWidth
                  disabled={pending}
                  onClick={() => {
                    const reason = window.prompt(tc("reason"));
                    if (!reason?.trim()) return;
                    act(() =>
                      markOutOfService({
                        lotId,
                        slotId: selected.id,
                        reason,
                      }),
                    );
                  }}
                >
                  {to("markOutOfService")}
                </Button>
              )}

              {selected.status === "out_of_service" && (
                <Button
                  fullWidth
                  disabled={pending}
                  onClick={() =>
                    act(() => returnToService({ lotId, slotId: selected.id }))
                  }
                >
                  {to("returnToService")}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

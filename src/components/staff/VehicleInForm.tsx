"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Check, CircleAlert, LogIn } from "lucide-react";

import { cn } from "@/lib/cn";
import { EMIRATES, DEFAULT_EMIRATE } from "@/lib/emirates";
import { VEHICLE_TYPES, type Slot, type VehicleType } from "@/lib/types";
import {
  admitVehicle,
  cancelAssignment,
  confirmParked,
  recordTurnaway,
} from "@/lib/actions/vehicles";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Card, PageHeader, SectionHeader } from "@/components/ui/Card";
import { Field, Select, TextInput } from "@/components/ui/Field";
import { VehicleIcon } from "@/components/ui/VehicleIcon";
import {
  LotAisle,
  ParkingSpace,
  SlotLegend,
} from "@/components/ui/ParkingSpace";

type Stage =
  { kind: "form" } | { kind: "assigned"; sessionId: string; slotCode: string };

/**
 * §5 Step 2 — record an arriving vehicle and hand the driver a slot.
 *
 * Two stages rather than one: assigning the slot and confirming the driver
 * actually parked are separate real-world events, and the gap between them is
 * exactly what the `assigned` state exists to cover (§4).
 */
export function VehicleInForm({
  lotId,
  slots,
}: {
  lotId: string;
  slots: Slot[];
}) {
  const t = useTranslations("staff");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const router = useRouter();

  const [pending, startTransition] = useTransition();
  const [stage, setStage] = useState<Stage>({ kind: "form" });
  const [error, setError] = useState<string | null>(null);

  const [vehicleType, setVehicleType] = useState<VehicleType>("car");
  const [emirate, setEmirate] = useState<string>(DEFAULT_EMIRATE);
  const [code, setCode] = useState("");
  const [number, setNumber] = useState("");
  const [slotId, setSlotId] = useState<string | null>(null);

  const slotsOfType = useMemo(
    () => slots.filter((s) => s.vehicleType === vehicleType),
    [slots, vehicleType],
  );
  const freeCount = slotsOfType.filter((s) => s.status === "available").length;
  const levels = useMemo(
    () => [...new Set(slotsOfType.map((s) => s.level))],
    [slotsOfType],
  );

  const selectedSlot = slots.find((s) => s.id === slotId) ?? null;

  function handleAssign() {
    if (!number.trim()) {
      setError(te("plateRequired"));
      return;
    }
    if (!slotId) return;

    setError(null);
    startTransition(async () => {
      const result = await admitVehicle({
        lotId,
        plate: { emirate, code, number },
        vehicleType,
        slotId,
        captureMethod: "manual",
      });

      if (!result.ok) {
        setError(te(result.error));
        // A lost race means the picker is stale — refresh so the attendant
        // sees the slot as taken rather than trying it again.
        if (result.error === "slotTaken") router.refresh();
        return;
      }

      setStage({
        kind: "assigned",
        sessionId: result.data.sessionId,
        slotCode: result.data.slotCode,
      });
    });
  }

  function reset() {
    setStage({ kind: "form" });
    setCode("");
    setNumber("");
    setSlotId(null);
    setError(null);
    router.refresh();
  }

  /* ---- Stage 2: slot handed to the driver ------------------------- */
  if (stage.kind === "assigned") {
    return (
      <div className="mx-auto max-w-md">
        <Card>
          <div className="flex flex-col items-center py-4 text-center">
            <span className="bg-accent text-accent-text mb-4 flex size-14 items-center justify-center rounded-full">
              <Check className="size-7" strokeWidth={3} />
            </span>
            <p className="stat-label">{t("assigned")}</p>
            <p className="display-figure text-text my-2 text-6xl">
              {stage.slotCode}
            </p>
            <p className="text-muted text-sm">
              {t("assignedTo", { slot: stage.slotCode })}
            </p>

            {error && (
              <p role="alert" className="text-danger mt-4 text-sm">
                {error}
              </p>
            )}

            <div className="mt-6 flex w-full flex-col gap-2">
              <Button
                size="lg"
                fullWidth
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await confirmParked({
                      lotId,
                      sessionId: stage.sessionId,
                    });
                    if (!result.ok) setError(te(result.error));
                    else reset();
                  })
                }
              >
                {t("confirmParked")}
              </Button>
              <Button
                variant="ghost"
                fullWidth
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await cancelAssignment({
                      lotId,
                      sessionId: stage.sessionId,
                      reason: "Driver left before parking",
                    });
                    if (!result.ok) setError(te(result.error));
                    else reset();
                  })
                }
              >
                {t("cancelAssignment")}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  /* ---- Stage 1: the form ------------------------------------------ */
  return (
    <>
      <PageHeader title={t("vehicleIn")} subtitle={t("logAnIncomingVehicle")} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        {/* ---- Left: registration ----------------------------------- */}
        <div className="flex flex-col gap-4">
          <Card>
            <SectionHeader title={t("registrationDetails")} />

            <div
              role="radiogroup"
              aria-label={tc("vehicleType")}
              className="bg-surface-2 rounded-control mb-4 grid grid-cols-2 gap-1 p-1"
            >
              {VEHICLE_TYPES.map((type) => {
                const selected = type === vehicleType;
                return (
                  <button
                    key={type}
                    role="radio"
                    aria-checked={selected}
                    onClick={() => {
                      setVehicleType(type);
                      setSlotId(null);
                    }}
                    className={cn(
                      "rounded-control flex items-center justify-center gap-2 py-2 text-sm font-semibold transition",
                      selected
                        ? "bg-ink text-ink-text"
                        : "text-muted hover:text-text",
                    )}
                  >
                    <VehicleIcon type={type} className="w-5" />
                    {type === "car" ? tc("car") : tc("motorcycle")}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-3">
              <Field label={t("emirate")}>
                {(id) => (
                  <Select
                    id={id}
                    value={emirate}
                    onChange={(e) => setEmirate(e.target.value)}
                  >
                    {EMIRATES.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>

              <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3">
                <Field label={t("plateCode")}>
                  {(id) => (
                    <TextInput
                      id={id}
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      maxLength={5}
                      autoCapitalize="characters"
                      placeholder="A"
                    />
                  )}
                </Field>

                <Field label={t("plateNumber")}>
                  {(id) => (
                    <TextInput
                      id={id}
                      value={number}
                      onChange={(e) => setNumber(e.target.value)}
                      // A numeric keypad is materially faster at a gate, but
                      // the field stays text so leading zeros survive.
                      inputMode="numeric"
                      maxLength={10}
                      placeholder="12345"
                      required
                    />
                  )}
                </Field>
              </div>
            </div>

            {error && (
              <p
                role="alert"
                className="bg-danger-surface text-danger rounded-control mt-3 px-3 py-2 text-sm"
              >
                {error}
              </p>
            )}

            <div className="border-border mt-4 flex items-center justify-between gap-3 border-t pt-4">
              <span className="stat-label">Assigned slot</span>
              <span className="display-figure text-text text-xl">
                {selectedSlot?.code ?? "—"}
              </span>
            </div>

            <Button
              className="mt-3"
              size="lg"
              fullWidth
              disabled={pending || !slotId || !number.trim()}
              onClick={handleAssign}
            >
              <LogIn className="size-4" />
              {pending ? tc("loading") : t("assignSlot")}
            </Button>
          </Card>
        </div>

        {/* ---- Right: live floor plan -------------------------------- */}
        <Card>
          <SectionHeader
            title={t("liveFloorPlan")}
            hint={`${freeCount} ${tc("free").toLowerCase()}`}
          />

          {freeCount === 0 ? (
            <div className="py-10 text-center">
              <p className="text-danger flex items-center justify-center gap-2 text-sm font-semibold">
                <CircleAlert className="size-4" />
                {t("noSlotsAvailable")}
              </p>
              <p className="text-muted mt-1 text-sm">{t("lotFullTurnAway")}</p>
              <Button
                variant="secondary"
                className="mt-3"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await recordTurnaway({ lotId, vehicleType });
                    router.refresh();
                  })
                }
              >
                {t("recordTurnaway")}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {levels.map((level) => (
                <div key={level}>
                  <h3 className="text-muted mb-2 text-xs font-semibold">
                    {level}
                  </h3>
                  {/*
                    The same tarmac the lot map and the public board draw, so an
                    attendant picking a space is looking at the lot they will
                    point the driver into rather than at a second, different
                    diagram of it.
                  */}
                  <div className="rounded-tile overflow-hidden border border-black/15 shadow-sm">
                    <div className="lot-asphalt grid grid-cols-4 border-t-2 border-white/55 sm:grid-cols-6 lg:grid-cols-8">
                      {slotsOfType
                        .filter((s) => s.level === level)
                        .map((slot) => {
                          const free = slot.status === "available";
                          const selected = slot.id === slotId;
                          return (
                            <button
                              key={slot.id}
                              disabled={!free}
                              aria-pressed={selected}
                              aria-label={slot.code}
                              onClick={() => setSlotId(slot.id)}
                              className={cn(
                                "relative text-left transition",
                                free
                                  ? "hover:z-10 hover:brightness-125"
                                  : "cursor-not-allowed",
                              )}
                            >
                              <ParkingSpace
                                code={slot.code}
                                status={slot.status}
                                vehicleType={slot.vehicleType}
                                selected={selected}
                              />
                            </button>
                          );
                        })}
                    </div>
                    <LotAisle />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="border-border mt-5 border-t pt-4">
            <SlotLegend
              labels={{
                free: tc("free"),
                taken: tc("taken"),
                reserved: tc("assigned"),
                outOfService: tc("outOfService"),
                selected: t("yourPick"),
              }}
            />
          </div>
        </Card>
      </div>
    </>
  );
}

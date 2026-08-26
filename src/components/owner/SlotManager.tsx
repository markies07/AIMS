"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";

import { VEHICLE_TYPES, type Slot, type VehicleType } from "@/lib/types";
import { createSlotsBulk, retireSlot } from "@/lib/actions/slots";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Field, Select, TextInput } from "@/components/ui/Field";
import { ParkingSpace, SlotLegend } from "@/components/ui/ParkingSpace";

export function SlotManager({
  lotId,
  slots,
}: {
  lotId: string;
  slots: Slot[];
}) {
  const t = useTranslations("owner");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const router = useRouter();

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [level, setLevel] = useState("Ground");
  const [section, setSection] = useState("A");
  const [prefix, setPrefix] = useState("A");
  const [from, setFrom] = useState("1");
  const [to, setTo] = useState("12");
  const [vehicleType, setVehicleType] = useState<VehicleType>("car");

  const levels = [...new Set(slots.map((s) => s.level))];

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <SectionHeader
          title={t("bulkAddSlots")}
          hint="Creates a numbered range in one go. Existing codes are skipped."
        />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label={t("slotCode").replace("code", "level")}>
            {(id) => (
              <TextInput
                id={id}
                value={level}
                onChange={(e) => setLevel(e.target.value)}
              />
            )}
          </Field>
          <Field label={t("section")}>
            {(id) => (
              <TextInput
                id={id}
                value={section}
                onChange={(e) => setSection(e.target.value)}
              />
            )}
          </Field>
          <Field label={t("prefix")}>
            {(id) => (
              <TextInput
                id={id}
                value={prefix}
                onChange={(e) => setPrefix(e.target.value.toUpperCase())}
              />
            )}
          </Field>
          <Field label={t("fromNumber")}>
            {(id) => (
              <TextInput
                id={id}
                inputMode="numeric"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            )}
          </Field>
          <Field label={t("toNumber")}>
            {(id) => (
              <TextInput
                id={id}
                inputMode="numeric"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            )}
          </Field>
          <Field label={tc("vehicleType")}>
            {(id) => (
              <Select
                id={id}
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value as VehicleType)}
              >
                {VEHICLE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type === "car" ? tc("car") : tc("motorcycle")}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <p className="text-faint mt-3 text-xs">
          Will create {prefix}-{String(Number(from) || 0).padStart(2, "0")} …{" "}
          {prefix}-{String(Number(to) || 0).padStart(2, "0")}
        </p>

        {error && (
          <p role="alert" className="text-danger mt-3 text-sm">
            {error}
          </p>
        )}
        {message && <p className="text-accent mt-3 text-sm">{message}</p>}

        <Button
          className="mt-4"
          disabled={pending}
          onClick={() => {
            setError(null);
            setMessage(null);
            startTransition(async () => {
              const result = await createSlotsBulk({
                lotId,
                level,
                section,
                prefix,
                from: Number(from),
                to: Number(to),
                vehicleType,
              });
              if (!result.ok) setError(te(result.error));
              else {
                setMessage(`${result.data.created} slots created.`);
                router.refresh();
              }
            });
          }}
        >
          {t("bulkAddSlots")}
        </Button>
      </Card>

      {levels.map((lvl) => (
        <Card key={lvl}>
          <SectionHeader
            title={lvl}
            hint={`${slots.filter((s) => s.level === lvl).length} slots`}
          />
          <ul className="lot-asphalt rounded-tile grid grid-cols-4 overflow-hidden border-t-2 border-white/55 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
            {slots
              .filter((s) => s.level === lvl)
              .map((slot) => {
                const busy =
                  slot.status === "assigned" || slot.status === "occupied";
                return (
                  <li key={slot.id} className="group relative">
                    <ParkingSpace
                      code={slot.code}
                      status={slot.status}
                      vehicleType={slot.vehicleType}
                      size="sm"
                      sublabel={
                        slot.vehicleType === "car" ? tc("car") : tc("motorcycle")
                      }
                    />
                    <button
                      // A slot with a vehicle in it cannot be retired — doing so
                      // would strand a live session and lose the money owed.
                      disabled={busy || pending}
                      title={
                        busy ? "Occupied — cannot retire" : t("retireSlot")
                      }
                      aria-label={`${t("retireSlot")} ${slot.code}`}
                      onClick={() => {
                        if (!window.confirm(`${t("retireSlot")} ${slot.code}?`))
                          return;
                        startTransition(async () => {
                          const result = await retireSlot({
                            lotId,
                            slotId: slot.id,
                          });
                          if (!result.ok) setError(te(result.error));
                          else router.refresh();
                        });
                      }}
                      // Inside the bay, not hanging off its corner: with the
                      // bays edge to edge it would otherwise sit on top of the
                      // neighbouring space.
                      className="absolute top-0.5 end-0.5 rounded-full bg-black/55 p-1 text-white/80 shadow-sm transition hover:bg-black/75 hover:text-white disabled:opacity-0"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </li>
                );
              })}
          </ul>

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
    </div>
  );
}

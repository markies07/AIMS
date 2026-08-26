"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { aedToFils, filsToAed, formatAed } from "@/lib/money";
import type { VatConfig, VehicleRate } from "@/lib/types";
import { createRateVersion } from "@/lib/actions/rates";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Field, TextInput } from "@/components/ui/Field";

export interface RateSummary {
  id: string;
  effectiveFromMs: number;
  carFirstHourFils: number;
  carSubsequentFils: number;
  motorcycleFirstHourFils: number;
  motorcycleSubsequentFils: number;
  isActive: boolean;
}

interface Draft {
  firstHour: string;
  subsequent: string;
  grace: string;
  dailyMax: string;
}

function toDraft(rate: VehicleRate | undefined, fallback: Draft): Draft {
  if (!rate) return fallback;
  return {
    firstHour: String(filsToAed(rate.firstHourFils)),
    subsequent: String(filsToAed(rate.subsequentHourFils)),
    grace: String(rate.graceMinutes),
    dailyMax:
      rate.dailyMaxFils === null ? "" : String(filsToAed(rate.dailyMaxFils)),
  };
}

function fromDraft(draft: Draft): VehicleRate {
  const dailyMax = draft.dailyMax.trim();
  return {
    firstHourFils: aedToFils(Number(draft.firstHour) || 0),
    subsequentHourFils: aedToFils(Number(draft.subsequent) || 0),
    graceMinutes: Number(draft.grace) || 0,
    dailyMaxFils: dailyMax === "" ? null : aedToFils(Number(dailyMax) || 0),
  };
}

export function RateEditor({
  lotId,
  current,
  history,
}: {
  lotId: string;
  current: { car: VehicleRate; motorcycle: VehicleRate; vat: VatConfig } | null;
  history: RateSummary[];
}) {
  const t = useTranslations("owner");
  const tr = useTranslations("rates");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const router = useRouter();

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [car, setCar] = useState<Draft>(
    toDraft(current?.car, {
      firstHour: "5",
      subsequent: "3",
      grace: "15",
      dailyMax: "40",
    }),
  );
  const [motorcycle, setMotorcycle] = useState<Draft>(
    toDraft(current?.motorcycle, {
      firstHour: "3",
      subsequent: "2",
      grace: "15",
      dailyMax: "25",
    }),
  );

  const [vatRegistered, setVatRegistered] = useState(
    current?.vat.registered ?? false,
  );
  const [vatPercent, setVatPercent] = useState(
    String(current?.vat.ratePercent ?? 5),
  );
  const [vatInclusive, setVatInclusive] = useState(
    current?.vat.pricesIncludeVat ?? false,
  );

  const [effectiveFrom, setEffectiveFrom] = useState(() =>
    new Date().toISOString().slice(0, 16),
  );

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <SectionHeader title={t("newRate")} hint={t("rateVersionNote")} />

        <div className="grid gap-6 sm:grid-cols-2">
          <RateColumn
            title={tc("car")}
            draft={car}
            onChange={setCar}
            labels={{
              firstHour: tr("firstHour"),
              subsequent: tr("eachHourAfter"),
              grace: tr("gracePeriod"),
              dailyMax: tr("dailyMaximum"),
            }}
          />
          <RateColumn
            title={tc("motorcycle")}
            draft={motorcycle}
            onChange={setMotorcycle}
            labels={{
              firstHour: tr("firstHour"),
              subsequent: tr("eachHourAfter"),
              grace: tr("gracePeriod"),
              dailyMax: tr("dailyMaximum"),
            }}
          />
        </div>

        <div className="border-border mt-6 border-t pt-4">
          <h3 className="text-text text-sm font-semibold">VAT</h3>
          <p className="text-faint mt-0.5 text-xs">
            §9 — whether the business is VAT-registered and whether posted
            prices already include it changes how the receipt must be printed.
          </p>

          <div className="mt-3 flex flex-col gap-2">
            <label className="text-text flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={vatRegistered}
                onChange={(e) => setVatRegistered(e.target.checked)}
                className="accent-accent size-4"
              />
              Business is VAT-registered
            </label>

            {vatRegistered && (
              <>
                <label className="text-text flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={vatInclusive}
                    onChange={(e) => setVatInclusive(e.target.checked)}
                    className="accent-accent size-4"
                  />
                  Posted prices already include VAT
                </label>
                <Field label="VAT rate (%)" className="max-w-40">
                  {(id) => (
                    <TextInput
                      id={id}
                      inputMode="decimal"
                      value={vatPercent}
                      onChange={(e) => setVatPercent(e.target.value)}
                    />
                  )}
                </Field>
              </>
            )}
          </div>
        </div>

        <div className="border-border mt-6 border-t pt-4">
          <Field
            label={t("effectiveFrom")}
            hint="Vehicles already parked keep the rate they arrived on."
            className="max-w-64"
          >
            {(id) => (
              <TextInput
                id={id}
                type="datetime-local"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
              />
            )}
          </Field>
        </div>

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
              const result = await createRateVersion({
                lotId,
                effectiveFromMs: new Date(effectiveFrom).getTime(),
                car: fromDraft(car),
                motorcycle: fromDraft(motorcycle),
                vat: {
                  registered: vatRegistered,
                  ratePercent: Number(vatPercent) || 0,
                  pricesIncludeVat: vatInclusive,
                },
              });
              if (!result.ok) setError(te(result.error));
              else {
                setMessage("New rate version saved.");
                router.refresh();
              }
            });
          }}
        >
          {t("newRate")}
        </Button>
      </Card>

      <Card>
        <SectionHeader title={t("rateHistory")} />
        <ul className="flex flex-col gap-2">
          {history.map((rate) => (
            <li
              key={rate.id}
              className="border-border/60 flex items-center gap-3 border-b py-2 text-sm last:border-0"
            >
              <span className="text-text w-36 shrink-0 tabular-nums">
                {new Date(rate.effectiveFromMs).toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </span>
              <span className="text-muted min-w-0 flex-1 truncate">
                {tc("car")} {formatAed(rate.carFirstHourFils)} /{" "}
                {formatAed(rate.carSubsequentFils)} · {tc("motorcycle")}{" "}
                {formatAed(rate.motorcycleFirstHourFils)} /{" "}
                {formatAed(rate.motorcycleSubsequentFils)}
              </span>
              {rate.isActive && (
                <span className="bg-accent text-accent-text shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold">
                  {t("active")}
                </span>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function RateColumn({
  title,
  draft,
  onChange,
  labels,
}: {
  title: string;
  draft: Draft;
  onChange: (next: Draft) => void;
  labels: Record<keyof Draft, string>;
}) {
  return (
    <div>
      <h3 className="text-text mb-3 text-sm font-semibold">{title}</h3>
      <div className="flex flex-col gap-3">
        <Field label={`${labels.firstHour} (AED)`}>
          {(id) => (
            <TextInput
              id={id}
              inputMode="decimal"
              value={draft.firstHour}
              onChange={(e) =>
                onChange({ ...draft, firstHour: e.target.value })
              }
            />
          )}
        </Field>
        <Field label={`${labels.subsequent} (AED)`}>
          {(id) => (
            <TextInput
              id={id}
              inputMode="decimal"
              value={draft.subsequent}
              onChange={(e) =>
                onChange({ ...draft, subsequent: e.target.value })
              }
            />
          )}
        </Field>
        <Field label={`${labels.grace} (minutes)`}>
          {(id) => (
            <TextInput
              id={id}
              inputMode="numeric"
              value={draft.grace}
              onChange={(e) => onChange({ ...draft, grace: e.target.value })}
            />
          )}
        </Field>
        <Field label={`${labels.dailyMax} (AED)`} hint="Leave blank for none.">
          {(id) => (
            <TextInput
              id={id}
              inputMode="decimal"
              value={draft.dailyMax}
              onChange={(e) => onChange({ ...draft, dailyMax: e.target.value })}
            />
          )}
        </Field>
      </div>
    </div>
  );
}

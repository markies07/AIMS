"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Check, Printer, Search } from "lucide-react";

import { cn } from "@/lib/cn";
import { formatAed } from "@/lib/money";
import { formatDuration } from "@/lib/time";
import type { FeeBreakdown, SessionStatus, VehicleType } from "@/lib/types";
import { checkOutVehicle, quoteExitFee } from "@/lib/actions/vehicles";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Field, TextInput } from "@/components/ui/Field";
import { LiveDuration } from "@/components/ui/LiveDuration";
import { FeeBreakdownTable } from "./FeeBreakdownTable";

export interface SearchableSession {
  id: string;
  plateNormalized: string;
  plateLabel: string;
  slotCode: string;
  vehicleType: VehicleType;
  entryAtMs: number;
  status: SessionStatus;
}

interface Quote {
  fee: FeeBreakdown;
  asOfMs: number;
  entryAtMs: number;
}

type Stage =
  | { kind: "search" }
  | { kind: "quote"; session: SearchableSession; quote: Quote }
  | {
      kind: "paid";
      sessionId: string;
      receiptNo: string;
      fee: FeeBreakdown;
      slotCode: string;
    };

/** §5 Step 5 — search the plate, show the fee, take the cash, free the slot. */
export function VehicleOutForm({
  lotId,
  sessions,
}: {
  lotId: string;
  sessions: SearchableSession[];
}) {
  const t = useTranslations("staff");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const tr = useTranslations("receipt");
  const router = useRouter();

  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<Stage>({ kind: "search" });
  const [error, setError] = useState<string | null>(null);

  const matches = useMemo(() => {
    const needle = query.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!needle) return [];
    return sessions.filter((s) => s.plateNormalized.includes(needle));
  }, [query, sessions]);

  function selectSession(session: SearchableSession) {
    setError(null);
    startTransition(async () => {
      const result = await quoteExitFee({ lotId, sessionId: session.id });
      if (!result.ok) {
        setError(te(result.error));
        return;
      }
      setStage({ kind: "quote", session, quote: result.data });
    });
  }

  function reset() {
    setStage({ kind: "search" });
    setQuery("");
    setError(null);
    router.refresh();
  }

  /* ---- Stage 3: paid ---------------------------------------------- */
  if (stage.kind === "paid") {
    return (
      <Card>
        <div className="flex flex-col items-center py-4 text-center">
          <span className="bg-accent text-accent-text mb-4 flex size-14 items-center justify-center rounded-full">
            <Check className="size-7" strokeWidth={3} />
          </span>
          <p className="text-text text-lg font-semibold">
            {t("paidAndFreed", { slot: stage.slotCode })}
          </p>
          <p className="text-accent mt-2 text-4xl font-bold tabular-nums">
            {formatAed(stage.fee.totalFils)}
          </p>
          <p className="text-faint mt-1 text-sm">
            {tr("receiptNo")} {stage.receiptNo}
          </p>

          <div className="mt-6 flex w-full flex-col gap-2">
            <Link
              href={`/receipt/${stage.sessionId}`}
              target="_blank"
              className="bg-accent text-accent-text inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full font-semibold"
            >
              <Printer className="size-4" />
              {t("printReceipt")}
            </Link>
            <Button variant="ghost" fullWidth onClick={reset}>
              {t("outTitle")}
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  /* ---- Stage 2: the fee ------------------------------------------- */
  if (stage.kind === "quote") {
    const { session, quote } = stage;
    return (
      <div className="flex flex-col gap-4">
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-text text-lg font-bold">
                {session.plateLabel}
              </p>
              <p className="text-muted text-sm">
                {tc("slot")} {session.slotCode}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={reset}>
              {tc("back")}
            </Button>
          </div>

          <dl className="border-border mt-4 grid grid-cols-2 gap-y-2 border-t pt-4 text-sm">
            <dt className="text-muted">{t("timeIn")}</dt>
            <dd className="text-text text-end tabular-nums">
              {new Date(quote.entryAtMs).toLocaleString("en-GB", {
                timeZone: "Asia/Dubai",
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              })}
            </dd>
            <dt className="text-muted">{t("duration")}</dt>
            <dd className="text-text text-end tabular-nums">
              {formatDuration(quote.fee.durationMinutes)}
            </dd>
          </dl>
        </Card>

        <Card className="border-accent-ring/50">
          <p className="text-muted text-sm">{t("amountDue")}</p>
          <p className="text-accent mt-1 text-5xl font-bold tabular-nums">
            {formatAed(quote.fee.totalFils)}
          </p>

          <details className="mt-4">
            <summary className="text-muted hover:text-text cursor-pointer text-sm font-medium">
              {t("feeBreakdown")}
            </summary>
            <div className="mt-3">
              <FeeBreakdownTable fee={quote.fee} vatPercent={5} />
            </div>
          </details>
        </Card>

        {error && (
          <p
            role="alert"
            className="bg-danger-surface text-danger rounded-control px-3 py-2 text-sm"
          >
            {error}
          </p>
        )}

        <Button
          size="lg"
          fullWidth
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await checkOutVehicle({
                lotId,
                sessionId: session.id,
              });
              if (!result.ok) {
                setError(te(result.error));
                return;
              }
              // The binding total is the one returned here, recomputed at the
              // instant payment was recorded — not the quote above.
              setStage({
                kind: "paid",
                sessionId: session.id,
                receiptNo: result.data.receiptNo,
                fee: result.data.fee,
                slotCode: result.data.slotCode,
              });
            })
          }
        >
          {pending ? t("collecting") : t("collectCash")}
        </Button>
      </div>
    );
  }

  /* ---- Stage 1: search -------------------------------------------- */
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <SectionHeader title={t("outTitle")} />
        <Field label={t("searchPlate")} hint={t("searchHint")}>
          {(id) => (
            <div className="relative">
              <Search className="text-faint pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2" />
              <TextInput
                id={id}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="ps-9"
                autoFocus
                placeholder="12345"
              />
            </div>
          )}
        </Field>
      </Card>

      {error && (
        <p
          role="alert"
          className="bg-danger-surface text-danger rounded-control px-3 py-2 text-sm"
        >
          {error}
        </p>
      )}

      {query.trim() !== "" && (
        <Card>
          {matches.length === 0 ? (
            <div className="py-4 text-center">
              <p className="text-text text-sm font-medium">{t("noMatch")}</p>
              <p className="text-muted mt-1 text-sm">{t("noMatchHint")}</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {matches.map((session) => (
                <li key={session.id}>
                  <button
                    onClick={() => selectSession(session)}
                    disabled={pending}
                    className={cn(
                      "border-border bg-surface-2 hover:border-accent-ring rounded-control",
                      "flex w-full items-center justify-between gap-3 border p-3 text-start transition",
                      "disabled:opacity-50",
                    )}
                  >
                    <div className="min-w-0">
                      <p className="text-text truncate text-sm font-semibold">
                        {session.plateLabel}
                      </p>
                      <p className="text-faint text-xs">
                        <LiveDuration sinceMs={session.entryAtMs} />
                        {session.status === "assigned" && " · not yet parked"}
                      </p>
                    </div>
                    <span className="bg-surface-3 text-text rounded-full px-3 py-1 text-sm font-semibold">
                      {session.slotCode}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}

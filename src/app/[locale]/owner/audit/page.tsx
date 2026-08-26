import { getTranslations, setRequestLocale } from "next-intl/server";

import { DEFAULT_LOT_ID } from "@/lib/firebase/config";
import { getLotProfile, listAuditLog } from "@/lib/data/lot";
import { formatDateTimeInZone } from "@/lib/time";
import { Card, SectionHeader } from "@/components/ui/Card";

export const dynamic = "force-dynamic";

const ACTION_LABELS: Record<string, string> = {
  vehicle_in: "Vehicle admitted",
  vehicle_parked: "Confirmed parked",
  vehicle_out: "Vehicle checked out",
  assignment_cancelled: "Assignment cancelled",
  slot_reassigned: "Slot reassigned",
  plate_corrected: "Plate corrected",
  slot_out_of_service: "Slot closed",
  slot_returned_to_service: "Slot reopened",
  slot_created: "Slots created",
  slot_retired: "Slot retired",
  turnaway_recorded: "Turn-away recorded",
  manual_entry_created: "Record created manually",
  discount_applied: "Discount applied",
  rate_version_created: "Rates changed",
  staff_created: "Staff account created",
  staff_updated: "Staff account updated",
};

/** §7 — who changed what, and when. */
export default async function OwnerAuditPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("owner");
  const lot = await getLotProfile(DEFAULT_LOT_ID);
  const timeZone = lot?.timeZone ?? "Asia/Dubai";

  const entries = await listAuditLog(DEFAULT_LOT_ID, 200);

  return (
    <Card>
      <SectionHeader
        title={t("auditLog")}
        hint="The 200 most recent changes. Entries are written in the same transaction as the change itself."
      />

      {entries.length === 0 ? (
        <p className="text-faint py-8 text-center text-sm">{t("noResults")}</p>
      ) : (
        <ul className="flex flex-col">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="border-border/60 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b py-2.5 text-sm last:border-0"
            >
              <span className="text-faint w-36 shrink-0 tabular-nums">
                {formatDateTimeInZone(entry.at, timeZone)}
              </span>
              <span className="text-text font-medium">
                {ACTION_LABELS[entry.action] ?? entry.action}
              </span>
              <span className="text-muted">{entry.actorName}</span>
              <span className="text-faint w-full text-xs sm:w-auto">
                {formatDetails(entry.details)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function formatDetails(
  details: Record<string, string | number | boolean | null>,
): string {
  return Object.entries(details)
    .filter(([, value]) => value !== null && value !== "")
    .map(([key, value]) => `${key}: ${value}`)
    .join(" · ");
}

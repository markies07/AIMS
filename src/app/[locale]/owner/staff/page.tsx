import { setRequestLocale } from "next-intl/server";

import { DEFAULT_LOT_ID } from "@/lib/firebase/config";
import { listUsers } from "@/lib/data/lot";
import { StaffManager } from "@/components/owner/StaffManager";

export const dynamic = "force-dynamic";

export default async function OwnerStaffPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const users = await listUsers();
  return <StaffManager lotId={DEFAULT_LOT_ID} users={users} />;
}

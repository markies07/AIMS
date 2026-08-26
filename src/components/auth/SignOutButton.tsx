"use client";

import { useState } from "react";
import { signOut } from "firebase/auth";
import { useTranslations } from "next-intl";
import { LogOut } from "lucide-react";

import { auth } from "@/lib/firebase/client";
import { useRouter } from "@/i18n/navigation";

export function SignOutButton() {
  const t = useTranslations("common");
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleSignOut() {
    setBusy(true);
    // Clear the server cookie and revoke refresh tokens first; the local sign
    // out is cosmetic by comparison.
    await fetch("/api/auth/session", { method: "DELETE" }).catch(() => {});
    await signOut(auth).catch(() => {});
    router.replace("/admin");
    router.refresh();
  }

  return (
    <button
      onClick={handleSignOut}
      disabled={busy}
      className="text-muted hover:text-text flex items-center gap-1.5 text-sm disabled:opacity-50"
    >
      <LogOut className="size-4" />
      <span className="hidden sm:inline">{t("signOut")}</span>
    </button>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/cn";
import type { Role, UserRecord } from "@/lib/types";
import { createStaffAccount, setStaffActive } from "@/lib/actions/staff";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Field, Select, TextInput } from "@/components/ui/Field";

export function StaffManager({
  lotId,
  users,
}: {
  lotId: string;
  users: UserRecord[];
}) {
  const t = useTranslations("owner");
  const ta = useTranslations("auth");
  const te = useTranslations("errors");
  const router = useRouter();

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("attendant");

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <SectionHeader title={t("addStaff")} />

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("displayName")}>
            {(id) => (
              <TextInput
                id={id}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            )}
          </Field>
          <Field label={ta("email")}>
            {(id) => (
              <TextInput
                id={id}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="off"
              />
            )}
          </Field>
          <Field
            label={ta("password")}
            hint="At least 10 characters. Share it with the attendant directly."
          >
            {(id) => (
              <TextInput
                id={id}
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            )}
          </Field>
          <Field label={t("role")}>
            {(id) => (
              <Select
                id={id}
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
              >
                <option value="attendant">{t("roleAttendant")}</option>
                <option value="owner">{t("roleOwner")}</option>
              </Select>
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
          disabled={pending || !email || !displayName || password.length < 10}
          onClick={() => {
            setError(null);
            setMessage(null);
            startTransition(async () => {
              const result = await createStaffAccount({
                lotId,
                email,
                password,
                displayName,
                role,
              });
              if (!result.ok) {
                setError(
                  result.error === "invalidState"
                    ? "That email already has an account."
                    : te(result.error),
                );
                return;
              }
              setMessage(`${displayName} can now sign in.`);
              setEmail("");
              setDisplayName("");
              setPassword("");
              router.refresh();
            });
          }}
        >
          {t("addStaff")}
        </Button>
      </Card>

      <Card>
        <SectionHeader title={t("staff")} />
        <ul className="flex flex-col gap-1">
          {users.map((user) => (
            <li
              key={user.uid}
              className="border-border/60 flex items-center gap-3 border-b py-2.5 text-sm last:border-0"
            >
              <div className="min-w-0 flex-1">
                <p className="text-text truncate font-medium">
                  {user.displayName}
                </p>
                <p className="text-faint truncate text-xs">{user.email}</p>
              </div>

              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                  user.role === "owner"
                    ? "bg-accent text-accent-text"
                    : "bg-surface-3 text-muted",
                )}
              >
                {user.role === "owner" ? t("roleOwner") : t("roleAttendant")}
              </span>

              <Button
                size="sm"
                variant={user.active ? "ghost" : "secondary"}
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await setStaffActive({
                      lotId,
                      uid: user.uid,
                      active: !user.active,
                    });
                    if (!result.ok) {
                      setError(
                        result.error === "invalidState"
                          ? "You cannot deactivate your own account."
                          : te(result.error),
                      );
                      return;
                    }
                    router.refresh();
                  })
                }
              >
                {user.active ? t("deactivate") : t("reactivate")}
              </Button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

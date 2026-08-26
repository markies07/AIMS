"use client";

import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useTranslations } from "next-intl";

import { auth } from "@/lib/firebase/client";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, TextInput } from "@/components/ui/Field";

/**
 * Staff sign-in.
 *
 * The client SDK authenticates and yields an ID token, which is immediately
 * traded for an httpOnly session cookie on the server. The token itself is
 * never persisted in the browser, so there is nothing for script to steal.
 */
export function LoginForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const credential = await signInWithEmailAndPassword(
        auth,
        email,
        password,
      );
      const idToken = await credential.user.getIdToken();

      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(body.error ?? t("genericError"));
        setBusy(false);
        return;
      }

      const { role } = await response.json();

      // Only follow a same-origin relative path — an open redirect on a login
      // form is a phishing gift.
      const requested = searchParams.get("next");
      const fallback = role === "owner" ? "/owner" : "/staff";
      const target =
        requested && requested.startsWith("/") && !requested.startsWith("//")
          ? requested
          : fallback;

      router.replace(target);
      router.refresh();
    } catch (caught) {
      const code =
        typeof caught === "object" && caught && "code" in caught
          ? String((caught as { code: unknown }).code)
          : "";

      // Firebase distinguishes "no such user" from "wrong password"; the UI
      // deliberately does not, so the form cannot be used to enumerate staff.
      setError(
        code.includes("invalid-credential") ||
          code.includes("wrong-password") ||
          code.includes("user-not-found")
          ? t("invalidCredentials")
          : code.includes("user-disabled")
            ? t("accountDisabled")
            : t("genericError"),
      );
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-12">
      <Card>
        <h1 className="text-text text-xl font-bold tracking-tight">
          {t("signInTitle")}
        </h1>
        <p className="text-muted mt-1 text-sm">{t("signInSubtitle")}</p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <Field label={t("email")}>
            {(id) => (
              <TextInput
                id={id}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                required
                autoFocus
              />
            )}
          </Field>

          <Field label={t("password")}>
            {(id) => (
              <TextInput
                id={id}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            )}
          </Field>

          {error && (
            <p
              role="alert"
              className="bg-danger-surface text-danger rounded-control px-3 py-2 text-sm"
            >
              {error}
            </p>
          )}

          <Button type="submit" size="lg" fullWidth disabled={busy}>
            {busy ? t("signingIn") : t("signIn")}
          </Button>
        </form>
      </Card>

      <Link
        href="/"
        className="text-muted hover:text-text mt-6 text-center text-sm"
      >
        {t("publicLink")}
      </Link>
    </div>
  );
}

"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useActionState, useEffect } from "react";
import { changePasswordAction, type FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";

export function PasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const forced = searchParams.get("force") === "1";
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    changePasswordAction,
    {},
  );

  useEffect(() => {
    if (state.ok && !forced) {
      // Stay on the page; success banner shown below.
    }
  }, [state, forced]);

  return (
    <form action={formAction} className="space-y-4">
      {forced && (
        <Banner type="info" title="You must change your password.">
          Set a new password now using the temporary password from your admin.
        </Banner>
      )}
      {state.error && <Banner type="error">{state.error}</Banner>}
      {state.ok && state.message && (
        <Banner type="success">{state.message}</Banner>
      )}

      <Field
        label="Current password"
        htmlFor="currentPassword"
        required
        error={state.fieldErrors?.currentPassword}
      >
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          error={Boolean(state.fieldErrors?.currentPassword)}
        />
      </Field>

      <Field
        label="New password"
        htmlFor="newPassword"
        required
        error={state.fieldErrors?.newPassword}
        hint="At least 8 characters"
      >
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          error={Boolean(state.fieldErrors?.newPassword)}
        />
      </Field>

      <Field
        label="Re-enter new password"
        htmlFor="confirmPassword"
        required
        error={state.fieldErrors?.confirmPassword}
      >
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          error={Boolean(state.fieldErrors?.confirmPassword)}
        />
      </Field>

      <Button type="submit" size="lg" loading={pending} className="w-full">
        Change password
      </Button>
    </form>
  );
}

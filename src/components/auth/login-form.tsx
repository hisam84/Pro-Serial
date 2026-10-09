"use client";

import { useActionState } from "react";
import { loginAction, type FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { PasswordInput } from "@/components/ui/password-input";

export function LoginForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    loginAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Banner type="error">{state.error}</Banner>}

      <Field label="Username" htmlFor="username" required>
        <Input
          id="username"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="Enter username"
          required
          error={Boolean(state.fieldErrors?.username)}
        />
      </Field>

      <Field label="Password" htmlFor="password" required>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="current-password"
          placeholder="Enter password"
          required
          error={Boolean(state.fieldErrors?.password)}
        />
      </Field>

      <Button type="submit" loading={pending} size="lg" className="w-full">
        Sign in
      </Button>
    </form>
  );
}

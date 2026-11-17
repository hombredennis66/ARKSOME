"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  updateRecoveredPassword,
  type AuthFormState,
} from "@/app/(auth)/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";

export default function ResetPasswordPage() {
  const [state, formAction, pending] =
    useActionState<AuthFormState, FormData>(updateRecoveredPassword, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle>Choose a new password</CardTitle>
        <CardDescription>
          Enter and confirm your new ARKSOME password.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {state.error && (
          <Alert variant="error" className="mb-4">
            {state.error}
          </Alert>
        )}

        {state.message ? (
          <>
            <Alert variant="success">
              <AlertTitle>Password updated</AlertTitle>
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>

            <Link
              href="/login"
              className="mt-4 block text-center text-sm text-primary hover:underline"
            >
              Sign in with your new password
            </Link>
          </>
        ) : (
          <form action={formAction} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm_password">Confirm new password</Label>
              <Input
                id="confirm_password"
                name="confirm_password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>

            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Updating password…" : "Update password"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

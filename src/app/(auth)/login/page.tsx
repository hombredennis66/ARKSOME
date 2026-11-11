"use client";

import { use, useActionState } from "react";
import Link from "next/link";
import { signIn, type AuthFormState } from "@/app/(auth)/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; verified?: string }>;
}) {
  const { next, verified } = use(searchParams);
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(signIn, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Welcome back — pick up where you left off.</CardDescription>
      </CardHeader>

      <CardContent>
        {verified === "1" && (
          <Alert variant="success" className="mb-4">
            <AlertTitle>Email verified</AlertTitle>
            <AlertDescription>You can sign in now.</AlertDescription>
          </Alert>
        )}

        {state.error && (
          <Alert variant="error" className="mb-4">
            {state.error}
          </Alert>
        )}

        <form action={formAction} className="space-y-4">
          {next ? <input type="hidden" name="next" value={next} /> : null}

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
          <Link href="/register" className="text-primary hover:underline">
            Create an account
          </Link>
          <Link href="/forgot-password" className="text-muted-foreground hover:text-foreground">
            Forgot password?
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

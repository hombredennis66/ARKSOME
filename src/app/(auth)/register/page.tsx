"use client";

import { use, useActionState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { signUp, type AuthFormState } from "@/app/(auth)/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";

const PERKS = [
  "A feed worth scrolling — articles, short videos and community picks",
  "Daily activities, quizzes and check-ins",
  "Earn ARKSOME Coins (AC) for optional activities — internal points with no cash value",
];

export default function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = use(searchParams);
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(signUp, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
        <CardDescription>Free to join. No card, no cash, no tricks.</CardDescription>
      </CardHeader>

      <CardContent>
        <ul className="mb-5 space-y-2 rounded-lg bg-muted p-4">
          {PERKS.map((perk) => (
            <li key={perk} className="flex items-start gap-2 text-sm text-muted-foreground">
              <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
              <span>{perk}</span>
            </li>
          ))}
        </ul>

        {state.error && (
          <Alert variant="error" className="mb-4">
            {state.error}
          </Alert>
        )}

        {state.message ? (
          <>
            <Alert variant="success">
              <AlertTitle>Check your email</AlertTitle>
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
            <p className="mt-4 text-sm text-muted-foreground">
              Already verified?{" "}
              <Link href="/login" className="text-primary hover:underline">
                Sign in
              </Link>
              .
            </p>
          </>
        ) : (
          <>
            {ref && (
              <Alert className="mb-4">
                <AlertDescription>You&apos;re joining with a referral code.</AlertDescription>
              </Alert>
            )}

            <form action={formAction} className="space-y-4">
              {ref ? <input type="hidden" name="referral_code" value={ref} /> : null}

              <div className="space-y-1.5">
                <Label htmlFor="display_name">Display name</Label>
                <Input
                  id="display_name"
                  name="display_name"
                  autoComplete="name"
                  maxLength={60}
                  placeholder="How you appear on ARKSOME"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  name="username"
                  required
                  minLength={3}
                  maxLength={24}
                  pattern="[A-Za-z0-9_]+"
                  title="3–24 characters: letters, numbers and underscores"
                  autoComplete="username"
                  placeholder="your_handle"
                />
                <p className="text-xs text-muted-foreground">
                  3–24 characters: letters, numbers and underscores.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
                <p className="text-xs text-muted-foreground">At least 8 characters.</p>
              </div>

              {!ref && (
                <div className="space-y-1.5">
                  <Label htmlFor="referral_code">Referral code (optional)</Label>
                  <Input
                    id="referral_code"
                    name="referral_code"
                    maxLength={32}
                    placeholder="If a friend invited you"
                  />
                </div>
              )}

              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "Creating your account…" : "Create account"}
              </Button>
            </form>

            <p className="mt-4 text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

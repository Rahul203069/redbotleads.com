"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";

import { GoogleAuthButton } from "@/components/auth/google-auth-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";

type AuthShellProps = {
  error?: string;
  mode: "login" | "signup";
};

const errorCopy: Record<string, { title: string; description: string }> = {
  AccessDenied: {
    title: "Access denied",
    description: "Your Google account could not be used to access this workspace.",
  },
  Configuration: {
    title: "Auth configuration error",
    description: "Google sign-in is misconfigured. Check the auth environment variables.",
  },
  OAuthAccountNotLinked: {
    title: "Account already exists",
    description: "This email is already linked with a different sign-in method.",
  },
  OAuthCallback: {
    title: "Google sign-in failed",
    description: "The Google callback did not complete. Try again.",
  },
  default: {
    title: "Unable to sign in",
    description: "Something went wrong during authentication. Try again.",
  },
};

const bullets = [
  "Track buying signals across targeted subreddits.",
  "Qualify leads with AI summaries and pain points.",
  "Route high-intent matches into your lead inbox before the thread cools down.",
];

export function AuthShell({ error, mode }: AuthShellProps) {
  const { toast } = useToast();

  const errorMessage = useMemo(() => {
    if (!error) {
      return null;
    }

    return errorCopy[error] ?? errorCopy.default;
  }, [error]);

  useEffect(() => {
    if (!errorMessage) {
      return;
    }

    toast({
      title: errorMessage.title,
      description: errorMessage.description,
      variant: "destructive",
    });
  }, [errorMessage, toast]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0b0f0e] text-[#f3f5f4]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(123,241,121,0.14),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(245,196,81,0.08),transparent_24%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(39,49,46,0.45)_1px,transparent_1px),linear-gradient(90deg,rgba(39,49,46,0.45)_1px,transparent_1px)] [background-size:48px_48px]" />
      <div className="relative mx-auto grid min-h-screen w-full max-w-7xl grid-cols-1 px-6 py-8 lg:grid-cols-[1.15fr_0.85fr] lg:px-10 lg:py-10">
        <section className="flex flex-col justify-between rounded-[28px] border border-[#27312E] bg-[#111716]/80 p-8 shadow-[0_30px_80px_rgba(0,0,0,0.4)] backdrop-blur-sm lg:p-12">
          <div className="space-y-10">
            <div className="inline-flex w-fit items-center gap-3 rounded-full border border-[#27312E] bg-[#161D1B] px-4 py-2 text-xs font-medium uppercase tracking-[0.24em] text-[#9DA9A4]">
              <span className="h-2 w-2 rounded-full bg-[#7BF179] shadow-[0_0_18px_rgba(123,241,121,0.7)]" />
              Reddit Lead Intelligence
            </div>
            <div className="max-w-2xl space-y-5">
              <p className="text-sm uppercase tracking-[0.32em] text-[#7BF179]">Discovery-first workflow</p>
              <h1 className="max-w-xl text-4xl font-semibold tracking-[-0.04em] text-[#F3F5F4] sm:text-5xl">
                Track buyer intent across Reddit before the thread goes cold.
              </h1>
              <p className="max-w-xl text-base leading-7 text-[#9DA9A4] sm:text-lg">
                Monitor high-signal posts and comments, qualify them with AI, and route the strongest leads into one
                focused workflow.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <SignalCard label="Signal coverage" value="24/7" />
              <SignalCard label="Alert channels" value="Email + Slack" />
              <SignalCard label="Lead scoring" value="AI ranked" />
            </div>
          </div>

          <div className="mt-10 space-y-3">
            {bullets.map((bullet) => (
              <div key={bullet} className="flex items-start gap-3 rounded-2xl border border-[#27312E] bg-[#161D1B]/60 px-4 py-4">
                <span className="mt-1 h-2.5 w-2.5 rounded-full bg-[#7BF179]" />
                <p className="text-sm leading-6 text-[#c3cbc8]">{bullet}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="flex items-center justify-center px-0 py-8 lg:px-10 lg:py-0">
          <Card className="w-full max-w-md">
            <CardHeader className="space-y-3">
              <div className="inline-flex w-fit items-center rounded-full border border-[#2f3b37] bg-[#111716] px-3 py-1 text-xs font-medium text-[#7BF179]">
                {mode === "login" ? "Welcome back" : "Create your workspace"}
              </div>
              <CardTitle>{mode === "login" ? "Sign in to your lead desk" : "Start discovering leads"}</CardTitle>
              <CardDescription>
                {mode === "login"
                  ? "Use Google to access your campaigns, lead inbox, and alerts."
                  : "Create your account with Google. We will provision your workspace and session automatically."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <GoogleAuthButton mode={mode} />

              <div className="rounded-xl border border-[#27312E] bg-[#111716] p-4 text-sm leading-6 text-[#9DA9A4]">
                <p className="font-medium text-[#F3F5F4]">Why Google only for v1?</p>
                <p className="mt-1">
                  Faster onboarding, fewer auth edge cases, and no password-reset flow while the MVP stays focused on
                  discovery.
                </p>
              </div>

              <div className="flex items-center justify-between border-t border-[#27312E] pt-4 text-sm text-[#9DA9A4]">
                <span>{mode === "login" ? "Need an account?" : "Already have access?"}</span>
                <Link className="font-medium text-[#7BF179] transition hover:text-[#9bf79a]" href={mode === "login" ? "/signup" : "/login"}>
                  {mode === "login" ? "Go to sign up" : "Go to login"}
                </Link>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}

function SignalCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#27312E] bg-[#161D1B]/80 p-4">
      <div className="text-xs uppercase tracking-[0.24em] text-[#6F7C77]">{label}</div>
      <div className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-[#F3F5F4]">{value}</div>
    </div>
  );
}

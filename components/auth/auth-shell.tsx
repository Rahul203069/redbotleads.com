"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";

import { BrandLogo } from "@/components/app/brand-logo";
import { EmailPasswordAuthForm } from "@/components/auth/email-password-auth-form";
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

const bullets = ["Track intent signals.", "Qualify with AI.", "Move faster on outreach."];

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
    <main className="relative min-h-screen overflow-hidden bg-[#121212] text-[#fafafa]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(30,215,96,0.14),transparent_20%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.06),transparent_24%),linear-gradient(180deg,#121212_0%,#0d0d0d_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),transparent)]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-10 lg:px-10">
        <div className="grid w-full items-center gap-12 lg:grid-cols-[1fr_440px]">
          <section className="space-y-8">
            <div className="inline-flex w-fit items-center">
              <BrandLogo className="text-4xl font-semibold tracking-[-0.08em] sm:text-5xl" showMark />
            </div>

            <div className="max-w-xl space-y-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[#b3b3b3]">Workspace access</p>
              <h1 className="text-5xl font-semibold leading-[1.02] tracking-[-0.06em] text-white sm:text-6xl">
                {mode === "login" ? "Sign in and get back to work." : "Create your workspace."}
              </h1>
              <p className="max-w-lg text-base leading-7 text-[#b3b3b3] sm:text-lg">
                Clean access to your lead pipeline without extra noise.
              </p>
            </div>

            <div className="grid max-w-md gap-3">
              {bullets.map((bullet) => (
                <div
                  key={bullet}
                  className="flex items-center gap-3 rounded-[22px] bg-[#181818] px-4 py-4 shadow-[0_8px_24px_rgba(0,0,0,0.28)] transition-colors duration-200 hover:bg-[#1f1f1f]"
                >
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-[#1f1f1f] text-[#1ed760] shadow-[inset_0_0_0_1px_rgba(124,124,124,0.16)]">
                    <span className="h-2.5 w-2.5 rounded-full bg-current" />
                  </span>
                  <p className="text-sm leading-6 text-[#f5f5f5]">{bullet}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="flex justify-center lg:justify-end">
            <Card className="w-full max-w-[480px] rounded-[30px] border-0 bg-[#181818] shadow-[0_24px_64px_rgba(0,0,0,0.46)]">
              <CardHeader className="space-y-4 p-8 pb-6">
                <div className="inline-flex w-fit items-center rounded-full bg-[#1f1f1f] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#b3b3b3]">
                  {mode === "login" ? "Welcome back" : "New workspace"}
                </div>
                <div className="space-y-3">
                  <CardTitle className="text-3xl leading-tight tracking-[-0.05em] text-white">
                    {mode === "login" ? "Sign in to continue" : "Create your account"}
                  </CardTitle>
                  <CardDescription className="text-[15px] leading-7 text-[#b3b3b3]">
                    {mode === "login"
                      ? "Access campaigns, leads, and alerts with email or Google."
                      : "Start with email and password, or continue with Google."}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 p-8 pt-0">
                <EmailPasswordAuthForm mode={mode} />

                <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#71717a]">
                  <span className="h-px flex-1 bg-white/10" />
                  <span>or</span>
                  <span className="h-px flex-1 bg-white/10" />
                </div>

                <GoogleAuthButton mode={mode} />

                <div className="flex items-center justify-between border-t border-white/8 pt-5 text-sm text-[#b3b3b3]">
                  <span>{mode === "login" ? "Need an account?" : "Already have access?"}</span>
                  <Link
                    className="font-semibold text-white transition-colors duration-200 hover:text-[#1ed760]"
                    href={mode === "login" ? "/signup" : "/login"}
                  >
                    {mode === "login" ? "Create one" : "Sign in"}
                  </Link>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </main>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";

import { BrandLogo } from "@/components/app/brand-logo";
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
    <main className="relative min-h-screen overflow-hidden bg-[#050505] text-[#fafafa]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.06),transparent_18%),linear-gradient(180deg,#050505_0%,#09090b_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:40px_40px]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-10 lg:px-10">
        <div className="grid w-full items-center gap-12 lg:grid-cols-[1fr_440px]">
          <section className="space-y-8">
            <div className="inline-flex w-fit items-center">
              <BrandLogo className="text-4xl font-semibold tracking-[-0.08em] sm:text-5xl" />
            </div>

            <div className="max-w-xl space-y-5">
              <p className="text-sm font-medium uppercase tracking-[0.3em] text-[#d4d4d8]">Minimal auth</p>
              <h1 className="text-5xl font-semibold leading-[1.02] tracking-[-0.06em] text-white sm:text-6xl">
                {mode === "login" ? "Sign in and get back to work." : "Create your workspace."}
              </h1>
              <p className="max-w-lg text-base leading-7 text-[#a1a1aa] sm:text-lg">
                Clean access to your lead pipeline without extra noise.
              </p>
            </div>

            <div className="grid max-w-md gap-3">
              {bullets.map((bullet) => (
                <div
                  key={bullet}
                  className="flex items-center gap-3 rounded-2xl border border-[#27272a] bg-[#111113]/72 px-4 py-4 backdrop-blur-sm"
                >
                  <span className="h-2 w-2 rounded-full bg-white" />
                  <p className="text-sm leading-6 text-[#cbd5e1]">{bullet}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="flex justify-center lg:justify-end">
            <Card className="w-full max-w-[440px] rounded-[30px] border-[#27272a] bg-[#0b0b0c]/94 shadow-[0_30px_80px_rgba(0,0,0,0.58)] backdrop-blur-xl">
              <CardHeader className="space-y-4 p-8 pb-6">
                <div className="inline-flex w-fit items-center rounded-full border border-[#27272a] bg-[#111113] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#d4d4d8]">
                  {mode === "login" ? "Welcome back" : "New workspace"}
                </div>
                <div className="space-y-3">
                  <CardTitle className="text-3xl leading-tight tracking-[-0.05em] text-white">
                    {mode === "login" ? "Sign in to continue" : "Start with Google"}
                  </CardTitle>
                  <CardDescription className="text-[15px] leading-7 text-[#a1a1aa]">
                    {mode === "login"
                      ? "Access campaigns, leads, and alerts."
                      : "Provision your account and workspace in one step."}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 p-8 pt-0">
                <GoogleAuthButton mode={mode} />

                <div className="rounded-[22px] border border-[#27272a] bg-[#111113] p-5 text-sm leading-6 text-[#a1a1aa]">
                  Google-only auth keeps onboarding fast and avoids password reset complexity.
                </div>

                <div className="flex items-center justify-between border-t border-[#27272a] pt-5 text-sm text-[#a1a1aa]">
                  <span>{mode === "login" ? "Need an account?" : "Already have access?"}</span>
                  <Link
                    className="font-semibold text-white transition hover:text-[#d4d4d8]"
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

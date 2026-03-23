"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

type GoogleAuthButtonProps = {
  mode: "login" | "signup";
};

export function GoogleAuthButton({ mode }: GoogleAuthButtonProps) {
  const { toast } = useToast();
  const [pending, setPending] = useState(false);

  async function handleSignIn() {
    try {
      setPending(true);
      await signIn("google", { callbackUrl: "/app" });
    } catch {
      toast({
        title: "Sign-in failed",
        description: "Google sign-in could not be started. Try again.",
        variant: "destructive",
      });
      setPending(false);
    }
  }

  return (
    <Button
      className="h-14 w-full justify-between rounded-2xl border-white/12 bg-white px-5 text-base font-semibold text-black shadow-[0_18px_40px_rgba(255,255,255,0.12)] hover:bg-[#e4e4e7] focus-visible:ring-white/35 focus-visible:ring-offset-[#050505]"
      onClick={handleSignIn}
      size="lg"
      type="button"
    >
      <span className="flex items-center gap-3">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-black/8 text-[13px] font-bold text-black">G</span>
        <span>{pending ? "Redirecting..." : mode === "login" ? "Continue with Google" : "Sign up with Google"}</span>
      </span>
      <span className="text-lg leading-none text-black/60">{pending ? "..." : "->"}</span>
    </Button>
  );
}

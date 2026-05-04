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
      className="h-14 w-full justify-between rounded-full bg-[#1ed760] px-5 text-[13px] font-bold uppercase tracking-[0.16em] text-[#08110c] shadow-[0_18px_40px_rgba(30,215,96,0.22)] transition-colors duration-200 hover:bg-[#3be477] focus-visible:ring-[#1ed760]/40 focus-visible:ring-offset-[#181818]"
      onClick={handleSignIn}
      size="lg"
      type="button"
    >
      <span className="flex items-center gap-3">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-black/10 text-[12px] font-bold text-[#08110c] shadow-[inset_0_0_0_1px_rgba(8,17,12,0.08)]">
          G
        </span>
        <span>{pending ? "Redirecting..." : mode === "login" ? "Continue with Google" : "Sign up with Google"}</span>
      </span>
      <span className="text-lg leading-none text-[#08110c]/70">{pending ? "..." : "->"}</span>
    </Button>
  );
}

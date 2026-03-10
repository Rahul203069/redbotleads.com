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
    <Button className="w-full" onClick={handleSignIn} size="lg" type="button">
      <span className="grid h-5 w-5 place-items-center rounded-full bg-[#0b0f0e]/10 text-[11px] font-bold">G</span>
      {pending ? "Redirecting..." : mode === "login" ? "Continue with Google" : "Sign up with Google"}
    </Button>
  );
}

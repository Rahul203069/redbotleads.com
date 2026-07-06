"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { ArrowRight, Loader2 } from "lucide-react";

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
      className="h-12 w-full justify-between rounded-[16px]  border border-white/12 bg-blue-600 px-4 text-sm font-semibold text-[#fafafa] shadow-none transition-colors duration-200 hover:border-white/20 hover:bg-blue-500 focus-visible:ring-white/20 focus-visible:ring-offset-[#181818]"
      disabled={pending}
      onClick={handleSignIn}
      type="button"
    >
      <span className="flex items-center gap-3">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-white shadow-[inset_0_0_0_1px_rgba(8,17,12,0.08)]">
          <GoogleLogo className="h-[18px] w-[18px]" />
        </span>
        <span>{pending ? "Redirecting..." : mode === "login" ? "Continue with Google" : "Sign up with Google"}</span>
      </span>
      {pending ? (
        <Loader2 aria-hidden className="h-4 w-4 animate-spin text-[#b3b3b3]" />
      ) : (
        <ArrowRight aria-hidden className="h-4 w-4 text-[#b3b3b3]" />
      )}
    </Button>
  );
}

function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg aria-hidden className={className} viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M17.64 9.2045c0-.6382-.0573-1.2518-.1636-1.8409H9v3.4818h4.8436c-.2086 1.125-.8427 2.0782-1.7954 2.7164v2.2582h2.9082C16.6582 14.2527 17.64 11.9455 17.64 9.2045Z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.4673-.8059 5.9564-2.18l-2.9082-2.2582c-.8059.54-1.8368.8591-3.0482.8591-2.3441 0-4.3282-1.5832-5.0364-3.7105H.9573v2.3318C2.4382 15.9832 5.4818 18 9 18Z"
        fill="#34A853"
      />
      <path
        d="M3.9636 10.7104c-.18-.54-.2823-1.1168-.2823-1.7104 0-.5936.1023-1.1704.2823-1.7104V4.9577H.9573C.3477 6.1732 0 7.5477 0 9c0 1.4523.3477 2.8268.9573 4.0423l3.0063-2.3319Z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.5791c1.3214 0 2.5077.4541 3.4405 1.3459l2.5813-2.5814C13.4632.8918 11.4259 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9577l3.0063 2.3319C4.6718 5.1623 6.6559 3.5791 9 3.5791Z"
        fill="#EA4335"
      />
    </svg>
  );
}

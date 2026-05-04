"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type LogoutButtonProps = {
  className?: string;
};

export function LogoutButton({ className }: LogoutButtonProps) {
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    try {
      setPending(true);
      await signOut({ callbackUrl: "/login" });
    } catch {
      setPending(false);
    }
  }

  return (
    <Button
      aria-busy={pending}
      disabled={pending}
      onClick={handleSignOut}
      type="button"
      variant="secondary"
      className={cn("gap-3", className)}
    >
      {pending ? (
        <>
          <span
            aria-hidden="true"
            className="h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-current border-t-transparent"
          />
          Logging out...
        </>
      ) : (
        "Log out"
      )}
    </Button>
  );
}

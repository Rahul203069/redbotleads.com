"use client";

import { signOut } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type LogoutButtonProps = {
  className?: string;
};

export function LogoutButton({ className }: LogoutButtonProps) {
  return (
    <Button
      onClick={() => signOut({ callbackUrl: "/login" })}
      type="button"
      variant="secondary"
      className={cn(className)}
    >
      Log out
    </Button>
  );
}

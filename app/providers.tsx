"use client";

import { SessionProvider } from "next-auth/react";

import { Toaster } from "@/components/ui/toaster";
import { ToastContextProvider } from "@/components/ui/use-toast";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ToastContextProvider>
        {children}
        <Toaster />
      </ToastContextProvider>
    </SessionProvider>
  );
}

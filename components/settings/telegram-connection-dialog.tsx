"use client";

import { Check, CheckCircle2, Copy, ExternalLink, LoaderCircle, Smartphone, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { useActionState, useEffect, useMemo, useState } from "react";

import { connectTelegram, type SettingsActionState } from "@/actions/settings";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

const initialState: SettingsActionState = {
  status: "idle",
};

type PairingStatus = "creating" | "pending" | "connected" | "expired" | "error";

type PairingStatusResponse = {
  error?: string;
  status?: "pending" | "connected" | "expired";
  telegramUsername?: string | null;
};

export function TelegramConnectionDialog({ isConnected }: { isConnected: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [pairingStatus, setPairingStatus] = useState<PairingStatus>("creating");
  const [connectedUsername, setConnectedUsername] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [state, action, isPending] = useActionState(connectTelegram, initialState);
  const pairing = state.telegramPairing;

  useEffect(() => {
    if (isPending) {
      setPairingStatus("creating");
      return;
    }

    if (state.status === "success" && pairing) {
      setPairingStatus("pending");
      setConnectedUsername(null);
      setCopied(false);
      setNow(Date.now());
      return;
    }

    if (state.status === "error") {
      setPairingStatus("error");
    }
  }, [isPending, pairing, state.status]);

  useEffect(() => {
    if (!open || !pairing || pairingStatus !== "pending") return;

    const intervalId = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(intervalId);
  }, [open, pairing, pairingStatus]);

  useEffect(() => {
    if (!open || !pairing || pairingStatus !== "pending") return;

    let cancelled = false;
    let timeoutId: number | undefined;

    const poll = async () => {
      if (Date.now() >= new Date(pairing.expiresAt).getTime()) {
        if (!cancelled) setPairingStatus("expired");
        return;
      }

      try {
        const response = await fetch(
          `/api/telegram/pairing-status?pairingId=${encodeURIComponent(pairing.id)}`,
          { cache: "no-store" },
        );
        const result = (await response.json()) as PairingStatusResponse;

        if (!response.ok) {
          throw new Error(result.error || "Could not check the Telegram connection.");
        }

        if (cancelled) return;

        if (result.status === "connected") {
          setConnectedUsername(result.telegramUsername ?? null);
          setPairingStatus("connected");
          toast({
            title: "Telegram connected",
            description: "Lead alerts can now be delivered to your Telegram chat.",
          });
          router.refresh();
          return;
        }

        if (result.status === "expired") {
          setPairingStatus("expired");
          return;
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Telegram pairing status check failed", error);
        }
      }

      if (!cancelled) {
        timeoutId = window.setTimeout(poll, 2_000);
      }
    };

    void poll();

    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [open, pairing, pairingStatus, router, toast]);

  const secondsRemaining = useMemo(() => {
    if (!pairing) return 0;
    return Math.max(0, Math.ceil((new Date(pairing.expiresAt).getTime() - now) / 1_000));
  }, [now, pairing]);

  const copyConnectionLink = async () => {
    if (!pairing) return;

    try {
      await navigator.clipboard.writeText(pairing.startUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      toast({
        title: "Could not copy link",
        description: "Open Telegram using the button instead.",
        variant: "destructive",
      });
    }
  };

  const beginConnection = () => {
    setOpen(true);
    setPairingStatus("creating");
    setConnectedUsername(null);
    setCopied(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <form action={action} onSubmit={beginConnection}>
        <Button
          disabled={isPending}
          type="submit"
          className="w-full cursor-pointer rounded-full border-none bg-[#1ed760] px-5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#121212] shadow-none hover:bg-[#3be477] focus-visible:ring-[#1ed760]/70 sm:w-auto"
        >
          {isPending ? (
            <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
          ) : (
            <Smartphone aria-hidden="true" className="h-4 w-4" />
          )}
          {isPending ? "Preparing..." : isConnected ? "Reconnect Telegram" : "Connect Telegram"}
        </Button>
      </form>

      <DialogContent className="max-w-lg overflow-hidden rounded-[24px] border-[#303033] bg-[#121212] p-0">
        <DialogClose asChild>
          <button
            aria-label="Close Telegram connection dialog"
            className="absolute right-4 top-4 z-10 grid h-9 w-9 cursor-pointer place-items-center rounded-full bg-[#1f1f1f] text-[#b3b3b3] transition-colors hover:bg-[#292929] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            type="button"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </DialogClose>

        {pairingStatus === "creating" ? (
          <div className="grid min-h-72 place-items-center p-8 text-center">
            <div>
              <LoaderCircle aria-hidden="true" className="mx-auto h-8 w-8 animate-spin text-[#1ed760]" />
              <DialogTitle className="mt-5 text-xl">Preparing a secure connection</DialogTitle>
              <DialogDescription className="mt-2">
                Creating a one-time Telegram link for your account.
              </DialogDescription>
            </div>
          </div>
        ) : null}

        {pairingStatus === "pending" && pairing ? (
          <div className="p-5 sm:p-7">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#17251b] text-[#1ed760]">
                  <Smartphone aria-hidden="true" className="h-5 w-5" />
                </span>
                <div>
                  <DialogTitle className="text-xl">Connect Telegram with your phone</DialogTitle>
                  <DialogDescription className="mt-1">
                    Telegram does not need to be installed on this computer.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="mt-6 grid gap-5 sm:grid-cols-[220px_1fr] sm:items-center">
              <div className="mx-auto rounded-[20px] bg-white p-3 shadow-[0_16px_38px_rgba(0,0,0,0.35)]">
                <QRCodeSVG
                  bgColor="#ffffff"
                  fgColor="#111111"
                  level="M"
                  marginSize={1}
                  size={188}
                  title="Telegram connection QR code"
                  value={pairing.startUrl}
                />
              </div>

              <ol className="grid gap-3 text-sm leading-5 text-[#cbcbcb]">
                <li className="flex gap-3">
                  <StepNumber>1</StepNumber>
                  <span>Scan this QR code with your phone&apos;s camera, then open the link in Telegram.</span>
                </li>
                <li className="flex gap-3">
                  <StepNumber>2</StepNumber>
                  <span>Telegram opens the Redbot Leads bot. Tap <strong className="text-white">Start</strong>.</span>
                </li>
                <li className="flex gap-3">
                  <StepNumber>3</StepNumber>
                  <span>Keep this window open. It will confirm the connection automatically.</span>
                </li>
              </ol>
            </div>

            <div className="mt-5 flex items-center justify-between rounded-xl bg-[#1a1a1a] px-4 py-3 text-xs text-[#b3b3b3]">
              <span className="flex items-center gap-2">
                <LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 animate-spin text-[#1ed760]" />
                Waiting for Telegram
              </span>
              <span className="font-mono text-[#fdfdfd]">{formatDuration(secondsRemaining)}</span>
            </div>

            <DialogFooter className="mt-5 sm:items-center">
              <button
                className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full px-4 text-xs font-semibold text-[#cbcbcb] transition-colors hover:bg-[#1f1f1f] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                onClick={copyConnectionLink}
                type="button"
              >
                {copied ? <Check aria-hidden="true" className="h-4 w-4" /> : <Copy aria-hidden="true" className="h-4 w-4" />}
                {copied ? "Link copied" : "Copy phone link"}
              </button>
              <a
                className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full bg-[#2AABEE] px-5 text-xs font-bold text-white transition-colors hover:bg-[#45b8ef] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2AABEE]/70"
                href={pairing.startUrl}
                rel="noreferrer"
                target="_blank"
              >
                Open Telegram
                <ExternalLink aria-hidden="true" className="h-4 w-4" />
              </a>
            </DialogFooter>
          </div>
        ) : null}

        {pairingStatus === "connected" ? (
          <ConnectionResult
            description={
              connectedUsername
                ? `@${connectedUsername} is ready to receive lead alerts.`
                : "Your Telegram chat is ready to receive lead alerts."
            }
            title="Telegram connected"
          />
        ) : null}

        {pairingStatus === "expired" ? (
          <ConnectionRetry
            action={action}
            description="For your security, connection links expire after 10 minutes. Generate a fresh QR code and try again."
            onSubmit={beginConnection}
            title="Connection link expired"
          />
        ) : null}

        {pairingStatus === "error" ? (
          <ConnectionRetry
            action={action}
            description={state.message || "We could not create the Telegram connection. Please try again."}
            onSubmit={beginConnection}
            title="Could not connect Telegram"
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function StepNumber({ children }: { children: React.ReactNode }) {
  return (
    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#252525] text-[11px] font-bold text-white">
      {children}
    </span>
  );
}

function ConnectionResult({ description, title }: { description: string; title: string }) {
  return (
    <div className="grid min-h-80 place-items-center p-8 text-center">
      <div>
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#17251b] text-[#1ed760]">
          <CheckCircle2 aria-hidden="true" className="h-7 w-7" />
        </span>
        <DialogTitle className="mt-5 text-xl">{title}</DialogTitle>
        <DialogDescription className="mx-auto mt-2 max-w-sm">{description}</DialogDescription>
        <DialogClose asChild>
          <Button className="mt-6 min-w-32 cursor-pointer rounded-full bg-[#1ed760] text-[#121212] hover:bg-[#3be477]">
            Done
          </Button>
        </DialogClose>
      </div>
    </div>
  );
}

function ConnectionRetry({
  action,
  description,
  onSubmit,
  title,
}: {
  action: (payload: FormData) => void;
  description: string;
  onSubmit: () => void;
  title: string;
}) {
  return (
    <div className="grid min-h-80 place-items-center p-8 text-center">
      <div>
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#2a1f15] text-[#f5b862]">
          <Smartphone aria-hidden="true" className="h-7 w-7" />
        </span>
        <DialogTitle className="mt-5 text-xl">{title}</DialogTitle>
        <DialogDescription className="mx-auto mt-2 max-w-sm">{description}</DialogDescription>
        <form action={action} onSubmit={onSubmit}>
          <Button className="mt-6 cursor-pointer rounded-full bg-[#1ed760] text-[#121212] hover:bg-[#3be477]" type="submit">
            Generate new QR code
          </Button>
        </form>
      </div>
    </div>
  );
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

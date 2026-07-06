"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";

import { resetProfilePassword, type PasswordResetActionState } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";

const initialState: PasswordResetActionState = {
  status: "idle",
};

export function PasswordResetForm({ hasPassword }: { hasPassword: boolean }) {
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState(resetProfilePassword, initialState);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const shouldShowCurrentPassword = hasPassword || Boolean(state.fieldErrors?.currentPassword);

  useEffect(() => {
    if (state.status === "success" && state.message) {
      toast({
        title: "Password updated",
        description: state.message,
      });
      formRef.current?.reset();
    }

    if (state.status === "error" && state.message) {
      toast({
        title: "Could not update password",
        description: state.message,
        variant: "destructive",
      });
    }
  }, [state, toast]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="grid gap-5 rounded-[22px] bg-[#1f1f1f] p-5 shadow-[rgba(0,0,0,0.3)_0px_8px_8px]"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-[#121212] text-[#1ed760] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]">
              <KeyRound aria-hidden className="h-5 w-5" />
            </span>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">
                Security
              </div>
              <h2 className="mt-1 text-[22px] font-bold tracking-[-0.04em] text-[#fdfdfd]">
                {hasPassword ? "Reset password" : "Set password"}
              </h2>
            </div>
          </div>
          <p className="mt-4 max-w-2xl text-[14px] leading-6 text-[#cbcbcb]">
            {hasPassword
              ? "Enter your current password before choosing a new one."
              : "Add a password so you can sign in with email, while Google sign-in stays available."}
          </p>
        </div>
        <span
          className={
            hasPassword
              ? "w-fit rounded-full bg-[#121212] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#1ed760]"
              : "w-fit rounded-full bg-[#121212] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#facc15]"
          }
        >
          {hasPassword ? "Password active" : "No password"}
        </span>
      </div>

      {state.status === "error" && state.message ? (
        <div className="rounded-[18px] bg-[#241313] px-4 py-3 text-sm leading-6 text-[#fee2e2]" role="alert">
          {state.message}
        </div>
      ) : null}

      <div className="grid gap-4">
        {shouldShowCurrentPassword ? (
          <PasswordField
            autoComplete="current-password"
            error={state.fieldErrors?.currentPassword}
            id="profile-current-password"
            label="Current password"
            name="currentPassword"
            onToggleVisibility={() => setShowCurrentPassword((current) => !current)}
            showValue={showCurrentPassword}
          />
        ) : null}

        <PasswordField
          autoComplete="new-password"
          error={state.fieldErrors?.newPassword}
          id="profile-new-password"
          label="New password"
          name="newPassword"
          onToggleVisibility={() => setShowNewPassword((current) => !current)}
          showValue={showNewPassword}
        />

        <PasswordField
          autoComplete="new-password"
          error={state.fieldErrors?.confirmPassword}
          id="profile-confirm-password"
          label="Confirm new password"
          name="confirmPassword"
          onToggleVisibility={() => setShowConfirmPassword((current) => !current)}
          showValue={showConfirmPassword}
        />
      </div>

      <div className="flex flex-col gap-4 border-t border-white/8 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-6 text-[#b3b3b3]">
          Use at least 8 characters. This updates future email/password sign-ins.
        </p>
        <Button
          className="h-11 rounded-full border-none bg-[#1ed760] px-5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#121212] shadow-none hover:bg-[#3be477]"
          disabled={isPending}
          type="submit"
        >
          {isPending ? (
            <>
              <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : hasPassword ? (
            "Reset password"
          ) : (
            "Set password"
          )}
        </Button>
      </div>
    </form>
  );
}

function PasswordField({
  autoComplete,
  error,
  id,
  label,
  name,
  onToggleVisibility,
  showValue,
}: {
  autoComplete: string;
  error?: string;
  id: string;
  label: string;
  name: string;
  onToggleVisibility: () => void;
  showValue: boolean;
}) {
  return (
    <label className="grid gap-2" htmlFor={id}>
      <span className="text-sm font-medium text-[#fdfdfd]">{label}</span>
      <span className="relative block">
        <Input
          aria-describedby={error ? `${id}-error` : undefined}
          aria-invalid={Boolean(error)}
          autoComplete={autoComplete}
          className="h-12 rounded-[16px] bg-[#121212] pr-12 text-base sm:text-sm"
          id={id}
          name={name}
          type={showValue ? "text" : "password"}
        />
        <button
          aria-label={showValue ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          className="absolute inset-y-0 right-0 grid h-12 w-12 place-items-center rounded-r-[16px] text-[#a1a1aa] transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
          onClick={onToggleVisibility}
          type="button"
        >
          {showValue ? <EyeOff aria-hidden className="h-4 w-4" /> : <Eye aria-hidden className="h-4 w-4" />}
        </button>
      </span>
      {error ? (
        <span className="text-sm leading-5 text-[#fda4af]" id={`${id}-error`} role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
}

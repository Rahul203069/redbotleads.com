"use client";

import { type FormEvent, useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";

import { signUpWithPassword, type AuthActionState } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";

type EmailPasswordAuthFormProps = {
  mode: "login" | "signup";
};

const initialState: AuthActionState = {
  status: "idle",
};

export function EmailPasswordAuthForm({ mode }: EmailPasswordAuthFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const pendingSignupCredentialsRef = useRef<{ email: string; password: string } | null>(null);
  const [signupState, signupAction, signupPending] = useActionState(signUpWithPassword, initialState);
  const [loginPending, setLoginPending] = useState(false);
  const [signupRedirecting, setSignupRedirecting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [signupSignInError, setSignupSignInError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const isPending = loginPending || signupPending || signupRedirecting;
  const formError =
    mode === "login"
      ? loginError
      : signupSignInError ?? (signupState.status === "error" ? signupState.message : null);

  useEffect(() => {
    if (mode !== "signup" || signupState.status !== "success" || signupRedirecting) {
      return;
    }

    const credentials = pendingSignupCredentialsRef.current;

    if (!credentials) {
      window.setTimeout(() => {
        setSignupSignInError("Account created, but automatic sign-in could not start. Sign in with your new password.");
      }, 0);
      return;
    }

    const { email, password } = credentials;

    async function signInAfterSignup() {
      setSignupRedirecting(true);
      setSignupSignInError(null);

      const result = await signIn("credentials", {
        callbackUrl: "/app",
        email,
        password,
        redirect: false,
      });

      if (result?.ok) {
        router.push("/app");
        router.refresh();
        return;
      }

      setSignupRedirecting(false);
      setSignupSignInError("Account created, but automatic sign-in failed. Sign in with your new password.");
      toast({
        title: "Sign-in failed",
        description: "Your account was created. Sign in with your new password to continue.",
        variant: "destructive",
      });
    }

    void signInAfterSignup();
  }, [mode, router, signupRedirecting, signupState.status, toast]);

  async function handleLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError(null);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    if (!email || !password) {
      setLoginError("Enter your email and password.");
      return;
    }

    setLoginPending(true);

    const result = await signIn("credentials", {
      callbackUrl: "/app",
      email,
      password,
      redirect: false,
    });

    if (result?.ok) {
      router.push("/app");
      router.refresh();
      return;
    }

    setLoginPending(false);
    setLoginError("Email or password is incorrect.");
    toast({
      title: "Unable to sign in",
      description: "Check your email and password, then try again.",
      variant: "destructive",
    });
  }

  function handleSignupSubmit(event: FormEvent<HTMLFormElement>) {
    const formData = new FormData(event.currentTarget);

    pendingSignupCredentialsRef.current = {
      email: String(formData.get("email") ?? "").trim(),
      password: String(formData.get("password") ?? ""),
    };
    setSignupSignInError(null);
  }

  return (
    <form
      ref={formRef}
      action={mode === "signup" ? signupAction : undefined}
      className="grid gap-4"
      onSubmit={mode === "login" ? handleLoginSubmit : handleSignupSubmit}
    >
      {formError ? (
        <div className="rounded-[18px] bg-[#2a1214] px-4 py-3 text-sm leading-6 text-[#fecdd3]" role="alert">
          {formError}
        </div>
      ) : null}

      <label className="grid gap-2" htmlFor={`${mode}-email`}>
        <span className="text-sm font-semibold text-[#f5f5f5]">Email</span>
        <Input
          autoComplete="email"
          className="h-12 rounded-[16px] bg-[#121212] text-base sm:text-sm"
          id={`${mode}-email`}
          name="email"
          placeholder="you@company.com"
          type="email"
          aria-describedby={signupState.fieldErrors?.email ? `${mode}-email-error` : undefined}
          aria-invalid={mode === "signup" && Boolean(signupState.fieldErrors?.email)}
        />
        {mode === "signup" && signupState.fieldErrors?.email ? (
          <span className="text-sm leading-5 text-[#fda4af]" id={`${mode}-email-error`} role="alert">
            {signupState.fieldErrors.email}
          </span>
        ) : null}
      </label>

      <label className="grid gap-2" htmlFor={`${mode}-password`}>
        <span className="text-sm font-semibold text-[#f5f5f5]">Password</span>
        <span className="relative block">
          <Input
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            className="h-12 rounded-[16px] bg-[#121212] pr-12 text-base sm:text-sm"
            id={`${mode}-password`}
            name="password"
            type={showPassword ? "text" : "password"}
            aria-describedby={signupState.fieldErrors?.password ? `${mode}-password-error` : undefined}
            aria-invalid={mode === "signup" && Boolean(signupState.fieldErrors?.password)}
          />
          <button
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 grid h-12 w-12 place-items-center rounded-r-[16px] text-[#a1a1aa] transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
            onClick={() => setShowPassword((current) => !current)}
            type="button"
          >
            {showPassword ? <EyeOff aria-hidden className="h-4 w-4" /> : <Eye aria-hidden className="h-4 w-4" />}
          </button>
        </span>
        {mode === "signup" && signupState.fieldErrors?.password ? (
          <span className="text-sm leading-5 text-[#fda4af]" id={`${mode}-password-error`} role="alert">
            {signupState.fieldErrors.password}
          </span>
        ) : null}
      </label>

      {mode === "signup" ? (
        <label className="grid gap-2" htmlFor="signup-confirm-password">
          <span className="text-sm font-semibold text-[#f5f5f5]">Confirm password</span>
          <span className="relative block">
            <Input
              autoComplete="new-password"
              className="h-12 rounded-[16px] bg-[#121212] pr-12 text-base sm:text-sm"
              id="signup-confirm-password"
              name="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              aria-describedby={signupState.fieldErrors?.confirmPassword ? "signup-confirm-password-error" : undefined}
              aria-invalid={Boolean(signupState.fieldErrors?.confirmPassword)}
            />
            <button
              aria-label={showConfirmPassword ? "Hide password confirmation" : "Show password confirmation"}
              className="absolute inset-y-0 right-0 grid h-12 w-12 place-items-center rounded-r-[16px] text-[#a1a1aa] transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
              onClick={() => setShowConfirmPassword((current) => !current)}
              type="button"
            >
              {showConfirmPassword ? <EyeOff aria-hidden className="h-4 w-4" /> : <Eye aria-hidden className="h-4 w-4" />}
            </button>
          </span>
          {signupState.fieldErrors?.confirmPassword ? (
            <span className="text-sm leading-5 text-[#fda4af]" id="signup-confirm-password-error" role="alert">
              {signupState.fieldErrors.confirmPassword}
            </span>
          ) : null}
        </label>
      ) : null}

      <Button
        className="mt-1 h-12 w-full justify-between rounded-[16px] border-none bg-[#1ed760] px-4 text-sm font-bold text-[#08110c] shadow-[0_18px_40px_rgba(30,215,96,0.18)] hover:bg-[#3be477] focus-visible:ring-[#1ed760]/40"
        disabled={isPending}
        type="submit"
      >
        <span>
          {isPending
            ? mode === "login"
              ? "Signing in..."
              : "Creating account..."
            : mode === "login"
              ? "Sign in"
              : "Create account"}
        </span>
        {isPending ? (
          <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
        ) : (
          <ArrowRight aria-hidden className="h-4 w-4" />
        )}
      </Button>
    </form>
  );
}

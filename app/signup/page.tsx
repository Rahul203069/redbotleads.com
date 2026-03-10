import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { auth } from "@/lib/auth";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();

  if (session) {
    redirect("/app");
  }

  const params = await searchParams;

  return <AuthShell error={params.error} mode="signup" />;
}

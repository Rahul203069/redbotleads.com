import { redirect } from "next/navigation";

import { AppSidebar } from "@/components/app/app-sidebar";
import { auth } from "@/lib/auth";

export default async function AuthenticatedAppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  const userLabel = session.user.name ?? session.user.email ?? "Authenticated user";

  return (
    <div className="min-h-screen bg-[#0b0f0e] px-4 py-4 text-[#F3F5F4] lg:px-5 lg:py-5">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] w-full max-w-[1600px] grid-cols-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="lg:h-[calc(100vh-2.5rem)] lg:sticky lg:top-5">
          <AppSidebar userLabel={userLabel} />
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}

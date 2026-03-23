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
    <div className="min-h-screen bg-transparent px-4 py-4 text-[#F3F5F4] lg:px-0 lg:py-0">
      <div className="grid min-h-screen w-full grid-cols-1 gap-4 lg:grid-cols-[304px_minmax(0,1fr)] lg:gap-0">
        <div className="lg:sticky lg:top-0 lg:h-screen lg:pl-4 lg:pr-0 lg:py-4 xl:pl-6">
          <AppSidebar userLabel={userLabel} />
        </div>
        <main className="min-w-0">
          <div className="min-h-[calc(100vh-2rem)] rounded-[32px] border border-[#27272a] bg-[linear-gradient(180deg,rgba(15,15,17,0.94),rgba(9,9,10,0.98))] shadow-[0_32px_90px_rgba(0,0,0,0.48)] lg:my-4 lg:mr-4 lg:ml-3 xl:mr-6 xl:ml-5">
            <div className="px-5 py-5 lg:px-8 lg:py-8">
              <div className="min-w-0 max-w-[1240px]">{children}</div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

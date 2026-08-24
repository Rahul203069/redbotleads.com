import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getSaasConfig } from "@/lib/saas-config";

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const config = await getSaasConfig();
  if (config.appMode !== "LIVE") redirect("/settings/notifcation");

  redirect("/inbox#delivery-health");
}

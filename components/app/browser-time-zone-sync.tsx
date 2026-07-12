"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { BROWSER_TIME_ZONE_COOKIE, normalizeTimeZone } from "@/lib/time-zone";

export function BrowserTimeZoneSync({ initialTimeZone }: { initialTimeZone: string }) {
  const router = useRouter();

  useEffect(() => {
    const browserTimeZone = normalizeTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);

    if (browserTimeZone === normalizeTimeZone(initialTimeZone)) {
      return;
    }

    document.cookie = `${BROWSER_TIME_ZONE_COOKIE}=${encodeURIComponent(browserTimeZone)}; Path=/; Max-Age=31536000; SameSite=Lax`;
    router.refresh();
  }, [initialTimeZone, router]);

  return null;
}
